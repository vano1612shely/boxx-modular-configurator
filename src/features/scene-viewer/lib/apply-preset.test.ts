import CameraControlsImpl from 'camera-controls'
import { MathUtils, PerspectiveCamera } from 'three'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import type { CameraPreset } from '@/entities/building'

import { applyPreset } from './apply-preset'

beforeAll(() => {
  CameraControlsImpl.install({ THREE })
})

const MIN_POLAR = MathUtils.degToRad(15)
const MAX_POLAR = MathUtils.degToRad(85)
const FRAME = 1 / 60

/** A 12 x 3.2 x 8 m unit: side views at 24.7 m, its top view at 20.6 m. */
const BACK: CameraPreset = { position: [0, 3.52, -24.63], target: [0, 1.44, 0] }
const RIGHT: CameraPreset = { position: [26.63, 3.52, 0], target: [0, 1.44, 0] }
const TOP: CameraPreset = { position: [0, 20.63, 0.96], target: [0, 0, 0] }

function rig(): CameraControlsImpl {
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000)
  camera.position.set(14, 10, 14)
  const controls = new CameraControlsImpl(camera)
  controls.minPolarAngle = MIN_POLAR
  controls.maxPolarAngle = MAX_POLAR
  controls.minDistance = 2
  controls.maxDistance = 40
  controls.smoothTime = 0.3
  return controls
}

/** Azimuth actually walked, summed frame by frame, once the flight has landed. */
function flightTravel(controls: CameraControlsImpl): number {
  let travelled = 0
  let previous = controls.azimuthAngle

  for (let frame = 0; frame < 300; frame++) {
    controls.update(FRAME)
    travelled += Math.abs(controls.azimuthAngle - previous)
    previous = controls.azimuthAngle
  }

  const landed = controls.getSpherical(new THREE.Spherical(), true)
  expect(controls.azimuthAngle).toBeCloseTo(landed.theta, 6)
  return travelled
}

describe('applyPreset', () => {
  it('never spins more than half a turn, from any resting azimuth', () => {
    for (let resting = -Math.PI; resting <= Math.PI; resting += 0.21) {
      for (const preset of [BACK, RIGHT, TOP]) {
        const controls = rig()
        controls.rotateTo(resting, MathUtils.degToRad(45), false)
        controls.update(FRAME)

        applyPreset(controls, preset, true)
        expect(flightTravel(controls)).toBeLessThanOrEqual(Math.PI + 1e-6)
      }
    }
  })

  // The case that reads as the camera losing its bearings: resting just short
  // of the back view, clicking Back, and watching a full revolution.
  it('reaches the back view in 8 degrees, not 352', () => {
    const controls = rig()
    controls.rotateTo(-3, MathUtils.degToRad(45), false)
    controls.update(FRAME)

    applyPreset(controls, BACK, true)
    expect(MathUtils.radToDeg(flightTravel(controls))).toBeCloseTo(8.1, 1)
  })

  it('unwinds an accumulated azimuth instead of replaying every turn', () => {
    const controls = rig()
    // Six turns of orbiting: camera-controls accumulates and never normalizes.
    controls.rotateTo(6 * Math.PI * 2 + 0.4, MathUtils.degToRad(45), false)
    controls.update(FRAME)

    applyPreset(controls, RIGHT, true)
    expect(flightTravel(controls)).toBeLessThanOrEqual(Math.PI + 1e-6)
  })

  it('lands inside the polar range, so the first drag does not jerk it back', () => {
    for (const preset of [BACK, RIGHT, TOP]) {
      const controls = rig()
      applyPreset(controls, preset, true)

      const end = controls.getSpherical(new THREE.Spherical(), true)
      expect(end.phi).toBeGreaterThanOrEqual(MIN_POLAR - 1e-9)
      expect(end.phi).toBeLessThanOrEqual(MAX_POLAR + 1e-9)
    }
  })

  // setLookAt applies no distance clamp of its own.
  it('lands inside the distance range', () => {
    const controls = rig()
    controls.maxDistance = 20

    applyPreset(controls, RIGHT, true)
    const end = controls.getSpherical(new THREE.Spherical(), true)
    expect(end.radius).toBeCloseTo(20, 9)
  })

  it('clears a pan, and places rather than flies when told not to transition', () => {
    const controls = rig()
    controls.setFocalOffset(1.5, 0.8, 0, false)

    applyPreset(controls, BACK, false)
    expect(controls.getFocalOffset(new THREE.Vector3(), false).lengthSq()).toBe(0)

    // Placed, not flying: nothing is left for update() to walk through.
    const now = controls.getSpherical(new THREE.Spherical(), false)
    const end = controls.getSpherical(new THREE.Spherical(), true)
    expect(now.theta).toBeCloseTo(end.theta, 12)
    expect(now.phi).toBeCloseTo(end.phi, 12)
    expect(now.radius).toBeCloseTo(end.radius, 12)
    expect(controls.getTarget(new THREE.Vector3(), false).toArray()).toEqual(BACK.target)
  })

  it('keeps the target setLookAt set, through both re-issued calls', () => {
    const controls = rig()
    applyPreset(controls, RIGHT, true)

    const target = controls.getTarget(new THREE.Vector3(), true)
    expect(target.toArray()).toEqual(RIGHT.target)
  })
})
