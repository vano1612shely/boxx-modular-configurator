import { Object3D, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import {
  toolbarPositioner,
  TOOLBAR_GAP,
  TOOLBAR_MARGIN_X,
  TOOLBAR_REACH,
  TOOLBAR_REACH_OPEN,
} from './toolbar-position'

const SIZE = { width: 1280, height: 800 }
const DESK = { width: 1.6, depth: 0.8 }
const HEIGHT = 0.75

function anchorAt(x: number, y: number, z: number): Object3D {
  const el = new Object3D()
  el.position.set(x, y, z)
  el.updateMatrixWorld(true)
  return el
}

/** Straight down from `above` metres, which is how a visitor looks into a room. */
function overhead(above = 6, at = new Vector3(0, 0, 0)): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, SIZE.width / SIZE.height, 0.1, 100)
  camera.position.set(at.x, above, at.z + 0.001)
  camera.lookAt(at)
  camera.updateMatrixWorld(true)
  return camera
}

/** Where the piece itself lands on screen, by the same projection. */
function screenY(el: Object3D, camera: PerspectiveCamera): number {
  const point = new Vector3().setFromMatrixPosition(el.matrixWorld).project(camera)
  return -(point.y * (SIZE.height / 2)) + SIZE.height / 2
}

const place = (footprint = DESK, reach = TOOLBAR_REACH) =>
  toolbarPositioner(footprint, HEIGHT, reach)

describe('toolbarPositioner', () => {
  // The bug: seen from overhead, world "up" points at the lens and projects to
  // almost nothing, so a bar offset in the world sat on the model.
  it('clears the piece even when the camera is straight overhead', () => {
    const camera = overhead()
    const el = anchorAt(0, HEIGHT, 0)
    const [, y] = place()(el, camera, SIZE)

    expect(y).toBeLessThan(screenY(el, camera) - TOOLBAR_GAP)
  })

  it('gives a wider piece a wider berth', () => {
    // Far enough back that both still fit above, so this compares gaps rather
    // than one gap against a flip.
    const camera = overhead(14)
    const el = anchorAt(0, HEIGHT, 0)
    const pieceY = screenY(el, camera)

    const small = pieceY - place({ width: 0.4, depth: 0.4 })(el, camera, SIZE)[1]
    const large = pieceY - place({ width: 3, depth: 3 })(el, camera, SIZE)[1]

    expect(large).toBeGreaterThan(small)
  })

  // The other bug: clamping a piece near the top of the frame pushed the bar
  // back down onto it. Below is the only place left with room.
  it('flips below the piece when there is no room above', () => {
    const camera = overhead()
    // Far enough forward that the piece projects near the top of the frame.
    const el = anchorAt(0, HEIGHT, -3)
    const pieceY = screenY(el, camera)
    const [, y] = place()(el, camera, SIZE)

    expect(pieceY).toBeLessThan(300)
    expect(y).toBeGreaterThan(pieceY + TOOLBAR_GAP)
  })

  it('needs more room above once the slider is open, and flips sooner', () => {
    const camera = overhead()
    const el = anchorAt(0, HEIGHT, -1.6)

    const shut = place(DESK, TOOLBAR_REACH)(el, camera, SIZE)[1]
    const open = place(DESK, TOOLBAR_REACH_OPEN)(el, camera, SIZE)[1]

    expect(open).toBeGreaterThanOrEqual(shut)
  })

  it('keeps the bar inside the frame however far off the piece is', () => {
    const camera = overhead()
    for (const z of [-40, -8, 0, 8, 40]) {
      for (const x of [-40, 0, 40]) {
        const [px, py] = place()(anchorAt(x, HEIGHT, z), camera, SIZE)
        expect(px).toBeGreaterThanOrEqual(TOOLBAR_MARGIN_X)
        expect(px).toBeLessThanOrEqual(SIZE.width - TOOLBAR_MARGIN_X)
        expect(py).toBeGreaterThanOrEqual(0)
        expect(py).toBeLessThanOrEqual(SIZE.height)
      }
    }
  })

  // project() mirrors a point behind the near plane through the origin, which
  // would park the bar on the opposite edge from the piece it belongs to.
  it('does not send the bar to the far side for a piece behind the camera', () => {
    const camera = new PerspectiveCamera(50, SIZE.width / SIZE.height, 0.1, 100)
    camera.position.set(0, 1.5, 0)
    camera.lookAt(new Vector3(0, 1.5, -5))
    camera.updateMatrixWorld(true)

    const behindRight = anchorAt(4, HEIGHT, 5)
    const [x] = place()(behindRight, camera, SIZE)

    expect(x).toBeGreaterThan(SIZE.width / 2)
  })

  it('still answers on a viewport too short for its own margins', () => {
    const camera = overhead()
    const [x, y] = place()(anchorAt(0, HEIGHT, 0), camera, { width: 320, height: 200 })

    expect(Number.isFinite(x)).toBe(true)
    expect(Number.isFinite(y)).toBe(true)
  })
})
