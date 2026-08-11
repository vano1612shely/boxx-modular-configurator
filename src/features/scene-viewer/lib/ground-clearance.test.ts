import CameraControlsImpl from 'camera-controls'
import { PerspectiveCamera } from 'three'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  eyeHeight,
  groundOffsetLimit,
  GROUND_MARGIN,
  maxPolarForClearance,
  type EyePose,
} from './ground-clearance'

beforeAll(() => {
  CameraControlsImpl.install({ THREE })
})

/** Where camera-controls itself puts the eye for a pose — the thing to match. */
function actualEyeHeight(pose: EyePose, offsetY: number, theta: number): number {
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000)
  const controls = new CameraControlsImpl(camera)
  controls.minDistance = 0.01
  controls.maxDistance = 1000

  void controls.setTarget(0, pose.targetY, 0, false)
  void controls.rotateTo(theta, pose.phi, false)
  void controls.dollyTo(pose.radius, false)
  void controls.setFocalOffset(0.7, offsetY, pose.offsetZ ?? 0, false)
  controls.update(1)

  return camera.position.y
}

const AT_THE_HORIZON: EyePose = { radius: 20, phi: (85 * Math.PI) / 180, targetY: 1.5 }

describe('eyeHeight', () => {
  // The whole fix rests on this composition, and it is the library's, not ours:
  // orbit first, then the offset along the camera's own columns. Derived by
  // reading `update()`, checked here against the library actually running.
  it('agrees with camera-controls', () => {
    const cases: Array<[EyePose, number, number]> = [
      [AT_THE_HORIZON, 5, 0],
      [AT_THE_HORIZON, 5, 2.1],
      [AT_THE_HORIZON, -3, 1],
      [{ radius: 8, phi: 0.3, targetY: 0 }, 4, 0.4],
      [{ radius: 30, phi: Math.PI / 2, targetY: 6 }, 9, -1.3],
      [{ radius: 12, phi: 1.2, targetY: 2, offsetZ: 1.5 }, 2, 0.9],
    ]

    for (const [pose, offsetY, theta] of cases) {
      expect(eyeHeight(pose, offsetY)).toBeCloseTo(actualEyeHeight(pose, offsetY, theta), 6)
    }
  })

  // Sliding the view up on screen is what pushes the eye down; the library
  // negates the up column before adding it.
  it('is lowered by a downward slide and raised by an upward one', () => {
    expect(eyeHeight(AT_THE_HORIZON, 4)).toBeLessThan(eyeHeight(AT_THE_HORIZON, 0))
    expect(eyeHeight(AT_THE_HORIZON, -4)).toBeGreaterThan(eyeHeight(AT_THE_HORIZON, 0))
  })

  // Straight down: the offset slides across the ground, not towards it.
  it('is barely touched by the offset at the pole', () => {
    const overhead: EyePose = { radius: 20, phi: 0, targetY: 0 }
    expect(eyeHeight(overhead, 8)).toBeCloseTo(eyeHeight(overhead, 0), 9)
  })
})

describe('groundOffsetLimit', () => {
  // The reported bug, in numbers: at the authored 85° polar cap and a building's
  // orbit distance, the pan bound alone allows about 5 m of downward slide, and
  // 3.2 m of it is already below the ground.
  it('stops short of the ground', () => {
    const limit = groundOffsetLimit(AT_THE_HORIZON, 0)

    expect(limit).toBeGreaterThan(0)
    expect(eyeHeight(AT_THE_HORIZON, limit)).toBeCloseTo(GROUND_MARGIN, 6)
    expect(eyeHeight(AT_THE_HORIZON, limit + 1)).toBeLessThan(GROUND_MARGIN)
  })

  it('follows the ground up and down', () => {
    expect(groundOffsetLimit(AT_THE_HORIZON, 2)).toBeLessThan(
      groundOffsetLimit(AT_THE_HORIZON, 0),
    )
    expect(groundOffsetLimit(AT_THE_HORIZON, -5)).toBeGreaterThan(
      groundOffsetLimit(AT_THE_HORIZON, 0),
    )
  })

  // A wider bound at the same angle is not a licence to slide further down: the
  // eye is higher, so there is more room, and that is the only reason.
  it('grows with the height the orbit already bought', () => {
    const near = groundOffsetLimit({ ...AT_THE_HORIZON, radius: 5 }, 0)
    const far = groundOffsetLimit({ ...AT_THE_HORIZON, radius: 40 }, 0)
    expect(far).toBeGreaterThan(near)
  })

  // Nothing to bound: sliding the view cannot lower the eye when looking down.
  it('is unbounded at the pole', () => {
    expect(groundOffsetLimit({ radius: 20, phi: 0, targetY: 1 }, 0)).toBe(Infinity)
  })

  // An orbit that is already too low has no downward slide to give. Negative
  // would read as "slide this far down", which is the opposite of the truth.
  it('never goes negative when the eye is already under', () => {
    expect(groundOffsetLimit({ radius: 2, phi: Math.PI / 2, targetY: -3 }, 0)).toBe(0)
  })
})

describe('maxPolarForClearance', () => {
  const GROUND = 0.4

  /** Eye height for a plain orbit, which is what this limit governs. */
  const eyeAt = (radius: number, phi: number, targetY: number) =>
    eyeHeight({ radius, phi, targetY }, 0)

  it('lets the orbit tip all the way when the eye cannot reach the floor', () => {
    // Target a metre and a half up, orbiting closer than that: even level with
    // the target the eye stays above the floor.
    expect(maxPolarForClearance(0.5, 1.5, GROUND)).toBe(Math.PI)
  })

  it('lands exactly where the eye meets the floor, at the radius asked about', () => {
    const limit = maxPolarForClearance(4, 1.2, GROUND)

    expect(limit).toBeGreaterThan(0)
    expect(eyeAt(4, limit, 1.2)).toBeCloseTo(GROUND + GROUND_MARGIN, 6)
  })

  // The case the visitor actually hits: looking at something standing on the
  // floor, where tipping the orbit is the only thing lowering the eye. One
  // authored angle cannot serve both radii here.
  it('tightens as the visitor zooms in on something at floor level', () => {
    const far = maxPolarForClearance(12, GROUND, GROUND)
    const near = maxPolarForClearance(2, GROUND, GROUND)

    expect(near).toBeLessThan(far)
    expect(eyeAt(2, near, GROUND)).toBeCloseTo(GROUND + GROUND_MARGIN, 6)
    expect(eyeAt(12, far, GROUND)).toBeCloseTo(GROUND + GROUND_MARGIN, 6)
  })

  // Above the floor by more than the orbit is long, tipping past level still
  // leaves the eye clear — the limit is a height question, not an angle one.
  it('allows past level when the target sits well above the floor', () => {
    expect(maxPolarForClearance(4, 1.2, GROUND)).toBeGreaterThan(Math.PI / 2)
  })

  it('refuses to tip at all when even looking straight down would be too low', () => {
    // Target already under the floor and the orbit too short to lift the eye out.
    expect(maxPolarForClearance(0.1, -1, GROUND)).toBe(0)
  })

  it('holds the eye clear at every angle it allows', () => {
    for (const radius of [0.5, 2, 6, 20]) {
      for (const targetY of [-0.5, 0.4, 1.2, 3]) {
        const limit = maxPolarForClearance(radius, targetY, GROUND)
        if (limit === 0) continue
        for (const t of [0.25, 0.5, 0.9, 1]) {
          expect(eyeAt(radius, limit * t, targetY)).toBeGreaterThanOrEqual(
            GROUND + GROUND_MARGIN - 1e-6,
          )
        }
      }
    }
  })

  it('answers for a degenerate radius rather than returning NaN', () => {
    expect(maxPolarForClearance(0, 1, GROUND)).toBe(Math.PI)
  })
})
