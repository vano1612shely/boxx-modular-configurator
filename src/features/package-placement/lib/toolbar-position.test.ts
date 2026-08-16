import { Object3D, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import type { Insets } from './scene-insets'
import {
  toolbarPositioner,
  FLOOR_INSETS,
  TOOLBAR_GAP,
  TOOLBAR_MARGIN_X,
  TOOLBAR_REACH,
  TOOLBAR_SLIDER_REACH,
} from './toolbar-position'

/** Bar plus the slider's reserved row, which is what actually has to fit. */
const STACK = TOOLBAR_REACH + TOOLBAR_SLIDER_REACH

const SIZE = { width: 1280, height: 800 }
const DESK = { width: 1.6, depth: 0.8 }
const HEIGHT = 0.75

/** What the desktop layout actually measures: facts across the top, sidebar right. */
const INSETS: Insets = { top: 160, right: 416, bottom: 136, left: 16 }

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

function project(point: Vector3, camera: PerspectiveCamera): number {
  const p = point.clone().project(camera)
  return -(p.y * (SIZE.height / 2)) + SIZE.height / 2
}

/** Where the piece itself lands on screen, by the same projection. */
function screenY(el: Object3D, camera: PerspectiveCamera): number {
  return project(new Vector3().setFromMatrixPosition(el.matrixWorld), camera)
}

/** The topmost pixel the piece covers — what the bar actually has to clear. */
function topPixelOf(
  el: Object3D,
  camera: PerspectiveCamera,
  footprint = DESK,
): number {
  const anchor = new Vector3().setFromMatrixPosition(el.matrixWorld)
  let top = project(anchor, camera)

  for (const dx of [-footprint.width / 2, footprint.width / 2]) {
    for (const dz of [-footprint.depth / 2, footprint.depth / 2]) {
      for (const dy of [-HEIGHT, 0]) {
        top = Math.min(top, project(new Vector3(anchor.x + dx, anchor.y + dy, anchor.z + dz), camera))
      }
    }
  }

  return top
}

/** Runs the positioner once and answers with both the side and the anchor. */
function place(
  el: Object3D,
  camera: PerspectiveCamera,
  {
    footprint = DESK,
    insets = INSETS,
    size = SIZE,
  }: { footprint?: typeof DESK; insets?: Insets; size?: typeof SIZE } = {},
) {
  let below: boolean | null = null
  const [x, y] = toolbarPositioner(footprint, HEIGHT, insets, (next) => {
    below = next
  })(el, camera, size)
  return { below, x, y }
}

describe('toolbarPositioner', () => {
  // The bug: seen from overhead, world "up" points at the lens and projects to
  // almost nothing, so a bar offset in the world sat on the model.
  it('clears the piece even when the camera is straight overhead', () => {
    const camera = overhead()
    const el = anchorAt(0, HEIGHT, 0)

    expect(place(el, camera).y).toBeLessThan(screenY(el, camera) - TOOLBAR_GAP)
  })

  // The complaint: the bar hung most of a frame above a desk. It was clearing a
  // circle drawn round the piece's centre, so half the *width* of a wide piece
  // was being spent going upwards, where only its height is in the way.
  it('sits one gap above the piece, however wide the piece is', () => {
    const camera = overhead(8)
    const el = anchorAt(0, HEIGHT, 0)

    for (const footprint of [{ width: 0.4, depth: 0.4 }, DESK, { width: 4, depth: 1 }]) {
      const { y } = place(el, camera, { footprint })
      expect(topPixelOf(el, camera, footprint) - y).toBeCloseTo(TOOLBAR_GAP, 6)
    }
  })

  it('still gives a wider piece a wider berth from its centre', () => {
    const camera = overhead(8)
    const el = anchorAt(0, HEIGHT, 0)
    const pieceY = screenY(el, camera)

    const small = pieceY - place(el, camera, { footprint: { width: 0.4, depth: 0.4 } }).y
    const large = pieceY - place(el, camera, { footprint: { width: 3, depth: 3 } }).y

    expect(large).toBeGreaterThan(small)
  })

  // The other bug: clamping a piece near the top of the frame pushed the bar
  // back down onto it. Below is the only place left with room.
  it('flips below the piece when there is no room above', () => {
    const camera = overhead()
    const el = anchorAt(0, HEIGHT, -3)
    const { below, y } = place(el, camera)

    expect(screenY(el, camera)).toBeLessThan(300)
    expect(below).toBe(true)
    expect(y).toBeGreaterThan(screenY(el, camera) + TOOLBAR_GAP)
  })

  // Zooming in walks the piece's top edge off the frame and its bottom edge off
  // the other end, and for a few frames in between there was room below and
  // none above — so the bar dropped and came straight back.
  it('does not flip and unflip its way through a zoom', () => {
    const flips: boolean[] = []
    // Built once and driven across the whole sweep, since the deadband is state
    // it carries — the same as a real zoom through one selection.
    const positioner = toolbarPositioner(DESK, HEIGHT, INSETS, (next) => flips.push(next))

    for (const z of [-2, -1.2, 0, 1.2]) {
      flips.length = 0
      const el = anchorAt(0, HEIGHT, z)
      for (let step = 0; step <= 60; step++) positioner(el, overhead(9 - step * 0.13), SIZE)

      // It may leave the side it started on. It may not come back to it.
      expect(flips.length).toBeLessThanOrEqual(1)
    }
  })

  it('keeps the bar and the room its slider needs inside the insets', () => {
    for (const above of [0.9, 1.6, 3, 6, 14]) {
      const camera = overhead(above)

      for (const z of [-4, -3, -2.4, -1.6, 0, 2, 6]) {
        const { below, y } = place(anchorAt(0, HEIGHT, z), camera)
        const top = below ? y : y - STACK
        const bottom = below ? y + STACK : y

        expect(top).toBeGreaterThanOrEqual(INSETS.top)
        expect(bottom).toBeLessThanOrEqual(SIZE.height - INSETS.bottom)
      }
    }
  })

  // Zoomed right in, the piece fills the frame and neither side clears it. The
  // bar took the lower one and landed on the view controls and past the bottom
  // edge; overlapping a model the visitor is a foot away from is cheaper.
  it('stays above and overlaps a piece that fills the frame', () => {
    const el = anchorAt(0, HEIGHT, 0)
    const filled = place(el, overhead(0.9))

    expect(filled.below).toBe(false)
    expect(filled.y).toBeCloseTo(INSETS.top + STACK, 6)
    expect(filled.y).toBeLessThan(SIZE.height - INSETS.bottom - STACK)
  })

  // The sidebar and the room facts are drawn over the canvas, not beside it, so
  // the canvas is the whole window and its edges say nothing about free space.
  it('stays out from under the panels drawn over the scene', () => {
    const camera = overhead(6)

    for (const x of [-40, -4, 0, 4, 40]) {
      for (const z of [-40, -4, 0, 4, 40]) {
        const { x: px, y } = place(anchorAt(x, HEIGHT, z), camera)

        expect(px - TOOLBAR_MARGIN_X).toBeGreaterThanOrEqual(INSETS.left)
        expect(px + TOOLBAR_MARGIN_X).toBeLessThanOrEqual(SIZE.width - INSETS.right)
        expect(y).toBeGreaterThanOrEqual(INSETS.top)
        expect(y).toBeLessThanOrEqual(SIZE.height - INSETS.bottom)
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

    const { x } = place(anchorAt(4, HEIGHT, 5), camera, { insets: FLOOR_INSETS })

    expect(x).toBeGreaterThan(SIZE.width / 2)
  })

  it('still answers on a viewport too short for its own insets', () => {
    const { x, y } = place(anchorAt(0, HEIGHT, 0), overhead(), {
      size: { width: 320, height: 200 },
    })

    expect(Number.isFinite(x)).toBe(true)
    expect(Number.isFinite(y)).toBe(true)
  })
})
