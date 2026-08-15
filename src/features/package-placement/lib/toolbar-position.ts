import { MathUtils, Vector3, type Camera, type Object3D } from 'three'

import type { PackageFootprint } from '@/entities/furniture-package'

import type { Insets } from './scene-insets'

/**
 * Half the bar's width, so a clamp on its centre keeps both its ends in view.
 *
 * Measured at 132 with both labels showing, which is the widest it gets; the
 * few pixels over that are what stop it grazing the sidebar it was clamped
 * against. Narrower on a phone, where the labels are icons.
 */
export const TOOLBAR_MARGIN_X = 140
/** Clear air between the piece and the bar, on top of the piece's own size. */
export const TOOLBAR_GAP = 18
/**
 * How tall the bar is, and how much again the angle slider adds beyond it —
 * both measured in the browser rather than derived from the classes, since only
 * the flip decision and the frame clamp read them and being a few pixels out
 * costs nothing.
 *
 * The slider's row is counted whether it is open or not. It opens on the far
 * side of the bar from the piece, so reserving it changes nothing about where
 * the bar rests — but it is the difference between a slider that has somewhere
 * to open and one that opens off the bottom of the screen.
 */
export const TOOLBAR_REACH = 48
export const TOOLBAR_SLIDER_REACH = 56

/**
 * The insets to work to when nothing on the page has been measured.
 *
 * A floor, not an answer: the real ones come from the panels themselves, and
 * these only have to keep the bar off the edges of a page whose chrome has for
 * some reason not been found.
 */
export const FLOOR_INSETS: Insets = { top: 16, right: 16, bottom: 16, left: 16 }

/**
 * Room the lower position must have to spare before the bar will move down to it.
 *
 * Zooming in walks the piece's top edge off the frame and its bottom edge off
 * the other end, and for a few frames in between there is room below and none
 * above. Without a deadband the bar dropped and came straight back — one flip
 * on the way in and another right after it, which is exactly as distracting as
 * it sounds. Costing more to enter than to stay means a window that narrow
 * never opens the door at all.
 */
const FLIP_SLACK = 56

const ANCHOR = new Vector3()
const CORNER = new Vector3()
const CAMERA_POS = new Vector3()
const CAMERA_DIR = new Vector3()
const TO_ANCHOR = new Vector3()

export type ScreenSize = { width: number; height: number }
type Screen = { x: number; y: number }

/**
 * Where the toolbar sits, given where the piece is and what else is on screen.
 *
 * Three things this has to get right, and anchoring it in the world got none.
 *
 * The clearance is measured on screen, and vertically. Putting the bar a
 * quarter of a metre above the piece buys nothing when the camera is overhead:
 * world "up" points at the lens, projects to almost no pixels, and the bar lands
 * on the model it belongs to. So the piece's own box is projected — all eight
 * corners, because a camera overhead sees its footprint and one at eye level
 * sees its height — and the bar is put just clear of the topmost pixel of it.
 * Clearing a *radius* around the centre instead, which is what this did, pushes
 * the bar as far up as the piece is wide, which on a desk is most of the frame.
 *
 * When there is no room above, the bar goes below the piece instead of being
 * clamped down onto it — but only when below is genuinely better. Zoomed right
 * in, neither side fits, and the bar then goes above and overlaps the piece:
 * that costs a corner of a model the visitor is a foot away from, where the
 * other branch cost the scene's own controls and the bottom of the screen.
 *
 * And it stays out from under the panels drawn over the scene, which is what
 * `insets` carries — the room facts across the top, the furniture sidebar down
 * the right, the view bar along the bottom.
 *
 * Returns the bar's edge **facing the piece** — its bottom when the bar is
 * above, its top when the bar is below — and reports which of the two through
 * `onSide`, since the caller has to anchor by that same edge and grow the
 * slider away from the piece rather than into it.
 */
export function toolbarPositioner(
  footprint: PackageFootprint,
  height: number,
  insets: Insets,
  onSide: (below: boolean) => void,
): (el: Object3D, camera: Camera, size: ScreenSize) => number[] {
  // The side is worked out every frame and changes on almost none of them, so
  // it is reported on the ones where it changes. The caller renders on it, and
  // the frame loop is the wrong place to be asking for sixty of those a second.
  let below = false
  let reported: boolean | null = null

  return (el, camera, size) => {
    const anchor = ANCHOR.setFromMatrixPosition(el.matrixWorld)
    const cameraPos = CAMERA_POS.setFromMatrixPosition(camera.matrixWorld)

    // Behind the near plane, project() mirrors the point through the origin,
    // which would pin the bar to the opposite edge from the item it belongs to.
    const inFront =
      TO_ANCHOR.subVectors(anchor, cameraPos).dot(camera.getWorldDirection(CAMERA_DIR)) > 0

    const toScreen = (point: Vector3): Screen => {
      const projected = point.project(camera)
      const ndcX = inFront ? projected.x : -projected.x
      const ndcY = inFront ? projected.y : -projected.y
      return {
        x: ndcX * (size.width / 2) + size.width / 2,
        y: -(ndcY * (size.height / 2)) + size.height / 2,
      }
    }

    const centre = toScreen(CORNER.copy(anchor))

    let highestPixel = centre.y
    let lowestPixel = centre.y
    const halfWidth = footprint.width / 2
    const halfDepth = footprint.depth / 2
    for (const dx of [-halfWidth, halfWidth]) {
      for (const dz of [-halfDepth, halfDepth]) {
        for (const dy of [-height, 0]) {
          const corner = toScreen(CORNER.set(anchor.x + dx, anchor.y + dy, anchor.z + dz))
          highestPixel = Math.min(highestPixel, corner.y)
          lowestPixel = Math.max(lowestPixel, corner.y)
        }
      }
    }

    const half = Math.min(TOOLBAR_MARGIN_X, size.width / 2)
    const left = Math.min(insets.left + half, size.width / 2)
    const right = Math.max(size.width - insets.right - half, left)

    // The stack hangs off the edge being returned, so that edge cannot come
    // within the stack's own height of the inset it is hanging towards.
    const stack = TOOLBAR_REACH + TOOLBAR_SLIDER_REACH
    const top = Math.min(insets.top, size.height / 2)
    const bottom = Math.max(size.height - insets.bottom, top)

    const idealAbove = highestPixel - TOOLBAR_GAP
    const idealBelow = lowestPixel + TOOLBAR_GAP
    const fitsAbove = idealAbove >= top + stack
    const roomBelow = bottom - stack - idealBelow

    below = !fitsAbove && roomBelow >= (below ? 0 : FLIP_SLACK)
    if (below !== reported) {
      reported = below
      onSide(below)
    }

    return [
      MathUtils.clamp(centre.x, left, right),
      below
        ? MathUtils.clamp(idealBelow, top, Math.max(bottom - stack, top))
        : MathUtils.clamp(idealAbove, Math.min(top + stack, bottom), bottom),
    ]
  }
}
