import { MathUtils, Vector3, type Camera, type Object3D } from 'three'

import type { PackageFootprint } from '@/entities/furniture-package'

export const TOOLBAR_MARGIN_X = 130
/**
 * Room for the header bar, and no more.
 *
 * It used to reserve the whole header *column*, because a bar for an off-frame
 * piece parked at this margin and landed on the room's facts panel. Now that a
 * bar with no room above it flips below the piece instead of parking, a margin
 * that deep made it flip for a piece in the middle of the screen — the reserved
 * strip reached further down than any bar would ever have needed.
 */
export const TOOLBAR_MARGIN_TOP = 96
export const TOOLBAR_MARGIN_BOTTOM = 16
/** Clear air between the piece and the bar, on top of the piece's own size. */
export const TOOLBAR_GAP = 18
/**
 * How much room the bar needs above its anchor, and how much again once the
 * slider is open above it — both measured in the browser rather than derived
 * from the classes, since only the flip decision reads them and being a few
 * pixels out costs nothing.
 */
export const TOOLBAR_REACH = 48
export const TOOLBAR_REACH_OPEN = 104

const ANCHOR = new Vector3()
const CORNER = new Vector3()
const CAMERA_POS = new Vector3()
const CAMERA_DIR = new Vector3()
const TO_ANCHOR = new Vector3()

export type ScreenSize = { width: number; height: number }
type Screen = { x: number; y: number }

/**
 * Where the toolbar sits, given where the piece is and how tall the bar is.
 *
 * Two things this has to get right, and anchoring it in the world got neither.
 *
 * The gap is measured on screen. Putting the bar a quarter of a metre above the
 * piece buys nothing when the camera is overhead: world "up" points at the lens,
 * projects to almost no pixels, and the bar lands on the model it belongs to.
 * So the piece's own box is projected — all eight corners, because a camera
 * overhead sees its footprint and one at eye level sees its height — and the bar
 * is put clear of whatever that actually covers.
 *
 * And when there is no room above, the bar goes *below* the piece instead of
 * being clamped down onto it. Clamping is what put it back on top of a piece
 * near the top of the frame, which is exactly where furniture ends up once the
 * camera looks down into a room.
 *
 * Returns the bar's **bottom edge**, which is the one the caller anchors by.
 */
export function toolbarPositioner(
  footprint: PackageFootprint,
  height: number,
  reach: number,
): (el: Object3D, camera: Camera, size: ScreenSize) => number[] {
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

    let radius = 0
    const halfWidth = footprint.width / 2
    const halfDepth = footprint.depth / 2
    for (const dx of [-halfWidth, halfWidth]) {
      for (const dz of [-halfDepth, halfDepth]) {
        for (const dy of [-height, 0]) {
          const corner = toScreen(CORNER.set(anchor.x + dx, anchor.y + dy, anchor.z + dz))
          radius = Math.max(radius, Math.hypot(corner.x - centre.x, corner.y - centre.y))
        }
      }
    }

    const marginX = Math.min(TOOLBAR_MARGIN_X, size.width / 2)
    const marginTop = Math.min(TOOLBAR_MARGIN_TOP, size.height / 2)
    const marginBottom = Math.min(TOOLBAR_MARGIN_BOTTOM, size.height / 2)

    const gap = radius + TOOLBAR_GAP
    // The bar's top has to clear the header, so its bottom cannot come higher
    // than the margin plus its own height.
    const floor = Math.min(marginTop + reach, size.height - marginBottom)
    const above = centre.y - gap

    return [
      MathUtils.clamp(centre.x, marginX, size.width - marginX),
      MathUtils.clamp(above >= floor ? above : centre.y + gap + reach, floor, size.height - marginBottom),
    ]
  }
}
