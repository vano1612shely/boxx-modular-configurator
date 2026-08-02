import CameraControlsImpl from 'camera-controls'
import { Box3, MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { pinPose } from './pin-pose'

beforeAll(() => {
  CameraControlsImpl.install({ THREE })
})

const FRAME = 1 / 60

/** A 24 x 3.2 x 10 m unit, and a 5 x 3.4 x 4 m room in one corner of it. */
const BUILDING_BOX = new Box3(new Vector3(-12, 0, -5), new Vector3(12, 3.2, 5))
const ROOM_BOX = new Box3(new Vector3(6, 0, 1), new Vector3(11, 3.4, 5))

function rig(): CameraControlsImpl {
  const camera = new PerspectiveCamera(50, 1.6, 0.1, 1000)
  const controls = new CameraControlsImpl(camera)
  controls.minPolarAngle = MathUtils.degToRad(15)
  controls.maxPolarAngle = MathUtils.degToRad(85)
  controls.minDistance = 0.4
  controls.maxDistance = 60
  controls.smoothTime = 0.3
  return controls
}

/** Mid-flight from the overview into the corner room, `frames` frames in. */
function flyingIntoRoom(frames: number): CameraControlsImpl {
  const controls = rig()
  controls.setBoundary(BUILDING_BOX)
  controls.setLookAt(0, 12, 30, 0, 1.6, 0, false)
  controls.update(FRAME)

  controls.setBoundary(ROOM_BOX)
  controls.setLookAt(8, 4, 8, 8.5, 1.7, 3, true)
  for (let frame = 0; frame < frames; frame++) controls.update(FRAME)

  return controls
}

describe('pinPose', () => {
  // setBoundary clamps only the end target, so the current one is still outside
  // the room box for the length of the flight. A clamping setter answers "stay
  // put" with a point on the box face, and the camera follows it in one frame.
  it('holds the pose while the target is still outside a freshly shrunk boundary', () => {
    for (const frames of [1, 5, 12, 20, 30]) {
      const controls = flyingIntoRoom(frames)
      const seen = controls.camera.position.clone()
      const target = controls.getTarget(new Vector3(), false)

      pinPose(controls)
      controls.update(0)

      expect(controls.getTarget(new Vector3(), true).distanceTo(target)).toBeLessThan(1e-9)
      expect(controls.camera.position.distanceTo(seen)).toBeLessThan(1e-6)
    }
  })

  // The polar floor is 3 degrees only while the top view is on, and reverts the
  // moment the mode changes — under a camera that is legitimately still below
  // it. A clamping setter snaps it back up in one frame.
  it('holds the pose while the polar angle is below the restored floor', () => {
    const controls = rig()
    controls.minPolarAngle = MathUtils.degToRad(3)
    controls.setLookAt(0, 20.63, 0.96, 0, 0, 0, false)
    controls.update(FRAME)

    controls.minPolarAngle = MathUtils.degToRad(15)
    controls.setLookAt(0, 12, 30, 0, 1.6, 0, true)
    controls.update(FRAME)

    const phi = controls.getSpherical(new Spherical(), false).phi
    expect(phi).toBeLessThan(controls.minPolarAngle)
    const seen = controls.camera.position.clone()

    pinPose(controls)
    controls.update(0)

    expect(controls.getSpherical(new Spherical(), true).phi).toBeCloseTo(phi, 9)
    expect(controls.camera.position.distanceTo(seen)).toBeLessThan(1e-6)
  })

  it('stops target, angles, distance and offset together, and they stay stopped', () => {
    const controls = flyingIntoRoom(6)
    controls.setFocalOffset(1.2, 0.6, 0, true)
    controls.update(FRAME)

    pinPose(controls)
    controls.update(0)
    const held = controls.camera.position.clone()
    const offset = controls.getFocalOffset(new Vector3(), false)

    for (let frame = 0; frame < 120; frame++) controls.update(FRAME)

    expect(controls.camera.position.distanceTo(held)).toBeLessThan(1e-6)
    expect(controls.getFocalOffset(new Vector3(), true).distanceTo(offset)).toBeLessThan(1e-9)
  })

  it('leaves the radius inside the range it was flying through', () => {
    const controls = flyingIntoRoom(9)
    const radius = controls.getSpherical(new Spherical(), false).radius

    pinPose(controls)

    const end = controls.getSpherical(new Spherical(), true)
    expect(end.radius).toBeCloseTo(radius, 9)
    expect(end.radius).toBeGreaterThanOrEqual(controls.minDistance)
    expect(end.radius).toBeLessThanOrEqual(controls.maxDistance)
  })
})
