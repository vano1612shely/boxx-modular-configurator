import CameraControlsImpl from 'camera-controls'
import { MathUtils, PerspectiveCamera, Spherical } from 'three'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { GROUND_MARGIN } from './ground-clearance'
import { holdAboveGround } from './hold-above-ground'

beforeAll(() => {
  CameraControlsImpl.install({ THREE })
})

/** A walkable level that is nowhere near y=0, as no real one ever is. */
const FLOOR = 0.2
const AUTHORED = MathUtils.degToRad(85)

/** Closest a focused room lets the visitor orbit. */
const ROOM_MIN_DISTANCE = 0.4

function rig() {
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000)
  const controls = new CameraControlsImpl(camera)
  controls.minDistance = ROOM_MIN_DISTANCE
  controls.maxDistance = 1000
  controls.maxPolarAngle = AUTHORED
  return { camera, controls }
}

const SPHERICAL = new Spherical()
const phiOf = (controls: CameraControlsImpl, end: boolean) =>
  controls.getSpherical(SPHERICAL, end).phi

/**
 * The pose the top view leaves behind: aimed at the bottom of the subject
 * rather than its middle, which is what makes tipping over from there the one
 * approach that reaches the floor at all.
 */
function tippedOver(controls: CameraControlsImpl, radius: number) {
  void controls.setTarget(0, FLOOR, 0, false)
  void controls.rotateTo(0, AUTHORED, false)
  void controls.dollyTo(radius, false)
  controls.update(1)
}

describe('holdAboveGround', () => {
  // The report, in the order the visitor does it: tip over, then zoom.
  it('keeps the eye clear through a dolly that no rotation asked for', () => {
    const { camera, controls } = rig()

    tippedOver(controls, 12)
    expect(camera.position.y).toBeGreaterThan(FLOOR + GROUND_MARGIN)

    void controls.dollyTo(0.6, false)
    controls.update(1)
    // Left to itself the tilt stays put and the eye rides it down to the slab:
    // camera-controls consults maxPolarAngle inside rotateTo, and no rotation
    // was asked for, so tightening that number alone changes nothing here.
    expect(camera.position.y - FLOOR).toBeLessThan(0.06)

    holdAboveGround(controls, FLOOR, AUTHORED)
    controls.update(1)

    expect(camera.position.y).toBeGreaterThanOrEqual(FLOOR + GROUND_MARGIN - 1e-6)
    // It gave way on the tilt, not on the zoom: the visitor still arrived.
    expect(controls.getSpherical(SPHERICAL, true).radius).toBeCloseTo(0.6, 6)
  })

  // Frame by frame, in the order the app runs them — the controls update, the
  // frame is drawn, and only then does the hold get a look at the pose. So what
  // is on screen is always one damping step stale. Sweeping the shapes a zoom
  // comes in rather than picking one, because the transient is where a limit
  // that is right at both ends can still be wrong in the middle: measured worst
  // across these is 7 mm inside the margin, which is 34 cm of floor left.
  it('never lets the eye reach the floor across a whole damped zoom', () => {
    // Slid views included: the tilt and the slide lower the eye together, so
    // bounding either one alone leaves the pair of them a way through.
    for (const from of [2, 12, 40]) {
      for (const to of [ROOM_MIN_DISTANCE, 1.5, 6]) {
        for (const offsetY of [0, 0.3]) {
          const { camera, controls } = rig()
          tippedOver(controls, from)
          void controls.setFocalOffset(0, offsetY, 0, false)
          holdAboveGround(controls, FLOOR, AUTHORED)
          controls.update(1)

          void controls.dollyTo(to, true)
          let lowest = Infinity
          for (let frame = 0; frame < 300; frame += 1) {
            controls.update(1 / 60)
            lowest = Math.min(lowest, camera.position.y - FLOOR)
            holdAboveGround(controls, FLOOR, AUTHORED)
          }

          expect(controls.getSpherical(SPHERICAL, false).radius).toBeCloseTo(to, 3)
          expect(lowest).toBeGreaterThan(GROUND_MARGIN - 0.01)
        }
      }
    }
  })

  it('leaves a pose that already clears the floor exactly where it is', () => {
    const { controls } = rig()
    // Eye level in a room, looking at head height from across it.
    void controls.setTarget(0, FLOOR + 1.2, 0, false)
    void controls.rotateTo(0.4, MathUtils.degToRad(60), false)
    void controls.dollyTo(6, false)
    controls.update(1)

    holdAboveGround(controls, FLOOR, AUTHORED)

    expect(phiOf(controls, false)).toBeCloseTo(MathUtils.degToRad(60), 9)
    expect(controls.maxPolarAngle).toBe(AUTHORED)
  })

  // A correction moves the pose on screen, and only that. Cancelling the rest
  // of a rotation the visitor is still making would take back travel the floor
  // never had a claim on.
  it('does not cancel a tip that is already on its way further up', () => {
    const { controls } = rig()
    tippedOver(controls, 0.6)
    const heading = MathUtils.degToRad(20)
    void controls.rotateTo(0, heading, true)

    const limit = holdAboveGround(controls, FLOOR, AUTHORED)

    expect(limit).toBeLessThan(AUTHORED)
    expect(phiOf(controls, false)).toBeCloseTo(limit, 9)
    expect(phiOf(controls, true)).toBeCloseTo(heading, 9)
  })

  // Leaving a room is a shrunken radius and a wide destination in the same
  // frame. The pose on screen has to be pulled up; the pose being flown to is
  // legal at the radius it will arrive at, and judging it by the radius being
  // left behind would land the flight somewhere nobody asked for.
  it('does not pull in a destination that clears the floor at its own radius', () => {
    const { controls } = rig()
    tippedOver(controls, 0.6)

    const destination = MathUtils.degToRad(60)
    void controls.rotateTo(0, destination, true)
    void controls.dollyTo(25, true)

    holdAboveGround(controls, FLOOR, AUTHORED)

    expect(phiOf(controls, true)).toBeCloseTo(destination, 9)
    expect(phiOf(controls, false)).toBeLessThan(destination)
  })

  // Zooming back out is not a promise to put the tilt back: the visitor is
  // where the floor left them, and returning travel they did not ask for would
  // be a second unrequested move to undo the first.
  it('does not hand the tilt back when the visitor pulls out again', () => {
    const { controls } = rig()
    tippedOver(controls, 0.6)
    const held = holdAboveGround(controls, FLOOR, AUTHORED)

    void controls.dollyTo(12, false)
    controls.update(1)
    holdAboveGround(controls, FLOOR, AUTHORED)

    expect(phiOf(controls, false)).toBeCloseTo(held, 9)
    expect(controls.maxPolarAngle).toBe(AUTHORED)
  })

  // minPolarAngle wins inside rotateTo, so a limit below it is a pose the
  // library will refuse — asking anyway, every frame, would be a silent spin.
  it('settles rather than thrashing when the floor cannot be cleared at all', () => {
    const { controls } = rig()
    controls.minPolarAngle = MathUtils.degToRad(30)
    // A target well under the walkable level, close enough that no tilt lifts
    // the eye out of it.
    void controls.setTarget(0, FLOOR - 5, 0, false)
    void controls.rotateTo(0, AUTHORED, false)
    void controls.dollyTo(0.5, false)
    controls.update(1)

    expect(holdAboveGround(controls, FLOOR, AUTHORED)).toBe(0)
    const settled = phiOf(controls, false)
    expect(settled).toBeCloseTo(controls.minPolarAngle, 9)

    holdAboveGround(controls, FLOOR, AUTHORED)
    expect(phiOf(controls, false)).toBe(settled)
    expect(phiOf(controls, true)).toBe(settled)
  })
})
