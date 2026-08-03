import CameraControlsImpl from 'camera-controls'
import { PerspectiveCamera, Spherical, Vector3 } from 'three'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { clampOffsetToLimit } from './clamp-offset'
import { offsetLimit, panSpeedFactor } from './pan-resistance'

beforeAll(() => {
  CameraControlsImpl.install({ THREE })
})

const FOV = 50

function rig(): CameraControlsImpl {
  const camera = new PerspectiveCamera(FOV, 1.6, 0.1, 1000)
  camera.position.set(0, 0, 20)
  const controls = new CameraControlsImpl(camera)
  controls.minDistance = 0.4
  controls.maxDistance = 60
  return controls
}

function radiusOf(controls: CameraControlsImpl): number {
  return controls.getSpherical(new Spherical(), true).radius
}

function reachOf(controls: CameraControlsImpl): number {
  const offset = controls.getFocalOffset(new Vector3(), true)
  return Math.hypot(offset.x, offset.y)
}

/** What the rig would set truckSpeed to: zero means the pan is switched off. */
function panSpeed(controls: CameraControlsImpl): number {
  return panSpeedFactor(reachOf(controls), offsetLimit(radiusOf(controls), FOV))
}

describe('clampOffsetToLimit', () => {
  it('leaves an offset that is already inside the bound alone', () => {
    const controls = rig()
    void controls.dollyTo(20, false)
    const inside = offsetLimit(20, FOV) * 0.5
    void controls.setFocalOffset(inside, 0, 0, false)

    expect(clampOffsetToLimit(controls, FOV)).toBe(false)
    expect(reachOf(controls)).toBeCloseTo(inside, 9)
  })

  // The bug: pan, zoom in, rotate, zoom back — and the pan is dead until a view
  // preset zeroes the offset. Zooming moves the bound rather than the offset, so
  // the offset ends up outside it, and the resistance is zero out there — which
  // panning cannot undo, panning being the thing it switches off.
  it('rescues a pan that a zoom stranded outside the bound', () => {
    const controls = rig()
    void controls.dollyTo(20, false)
    void controls.setFocalOffset(offsetLimit(20, FOV) * 0.9, 0, 0, false)
    expect(panSpeed(controls)).toBeGreaterThan(0)

    // Closing in shrinks the bound underneath an offset that does not move.
    void controls.dollyTo(4, false)
    expect(reachOf(controls)).toBeGreaterThan(offsetLimit(radiusOf(controls), FOV))
    expect(panSpeed(controls)).toBe(0)

    expect(clampOffsetToLimit(controls, FOV)).toBe(true)
    expect(reachOf(controls)).toBeLessThanOrEqual(offsetLimit(radiusOf(controls), FOV) + 1e-9)
    // Landing on the limit would be no better than being past it: that is the
    // one point where resistance is total.
    expect(panSpeed(controls)).toBe(1)
  })

  it('keeps the direction it was panned in', () => {
    const controls = rig()
    void controls.dollyTo(20, false)
    const far = offsetLimit(20, FOV)
    void controls.setFocalOffset(far * 0.6, far * -0.8, 0, false)
    void controls.dollyTo(3, false)

    clampOffsetToLimit(controls, FOV)

    const offset = controls.getFocalOffset(new Vector3(), true)
    expect(offset.x).toBeGreaterThan(0)
    expect(offset.y).toBeLessThan(0)
    expect(offset.y / offset.x).toBeCloseTo(-0.8 / 0.6, 6)
  })

  it('does nothing when the view was never panned', () => {
    const controls = rig()
    void controls.dollyTo(2, false)
    expect(clampOffsetToLimit(controls, FOV)).toBe(false)
  })
})
