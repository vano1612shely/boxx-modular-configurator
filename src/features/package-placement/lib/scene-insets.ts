/** Marks a panel drawn over the scene that the furniture bar must not hide behind. */
export const SCENE_CHROME_ATTR = 'data-scene-chrome'

export type Insets = { top: number; right: number; bottom: number; left: number }

/** A panel's box, in coordinates relative to the canvas's top-left corner. */
export type PanelRect = { top: number; right: number; bottom: number; left: number }

export type CanvasSize = { width: number; height: number }

/**
 * Largest share of the canvas one panel may claim from an edge.
 *
 * A panel sitting in the middle of the screen — an open dialog — has a huge
 * reach from every edge, and treating that as an inset would leave nowhere for
 * the bar to be. The desktop furniture sidebar is the widest real one at a
 * little under half the canvas, so anything past half is not an edge panel.
 */
const MAX_SHARE = 0.5

/**
 * How far the chrome reaches in from each edge of the canvas.
 *
 * The panels over the scene are all anchored to an edge, but several of them
 * sit in a corner and so reach in from two. Each is counted against the edge it
 * is *cheapest* to clear: the room facts are 330px wide and 160px deep in the
 * top-left, so the bar passes underneath them rather than being pushed right of
 * them, and the sidebar down the right is cleared sideways rather than by
 * giving up the whole height of the frame.
 *
 * Measured rather than declared, because the answer differs by breakpoint — the
 * view bar lifts clear of the furniture sheet on a phone, and the sidebar is
 * not there at all — and a table of constants for that goes stale the first
 * time somebody moves a panel.
 */
export function measureInsets(
  canvas: CanvasSize,
  panels: ReadonlyArray<PanelRect>,
  floor: Insets,
): Insets {
  const insets = { ...floor }

  for (const panel of panels) {
    const overlapX = Math.min(panel.right, canvas.width) - Math.max(panel.left, 0)
    const overlapY = Math.min(panel.bottom, canvas.height) - Math.max(panel.top, 0)
    // Nothing of it is over the scene, so it hides nothing.
    if (overlapX <= 0 || overlapY <= 0) continue

    const reach = {
      top: panel.bottom,
      right: canvas.width - panel.left,
      bottom: canvas.height - panel.top,
      left: panel.right,
    }
    const limit = {
      top: canvas.height * MAX_SHARE,
      right: canvas.width * MAX_SHARE,
      bottom: canvas.height * MAX_SHARE,
      left: canvas.width * MAX_SHARE,
    }

    let cheapest: keyof Insets | null = null
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      if (reach[edge] <= 0 || reach[edge] > limit[edge]) continue
      if (cheapest === null || reach[edge] < reach[cheapest]) cheapest = edge
    }

    if (cheapest !== null) insets[cheapest] = Math.max(insets[cheapest], reach[cheapest])
  }

  return insets
}

/** Reads the chrome out of the document, in canvas coordinates. */
export function readChrome(canvas: Element): { size: CanvasSize; panels: PanelRect[] } {
  const box = canvas.getBoundingClientRect()
  const panels: PanelRect[] = []

  for (const element of canvas.ownerDocument.querySelectorAll(`[${SCENE_CHROME_ATTR}]`)) {
    const rect = element.getBoundingClientRect()
    // Collapsed panels still answer with a box; an empty one hides nothing.
    if (rect.width <= 0 || rect.height <= 0) continue
    panels.push({
      top: rect.top - box.top,
      right: rect.right - box.left,
      bottom: rect.bottom - box.top,
      left: rect.left - box.left,
    })
  }

  return { size: { width: box.width, height: box.height }, panels }
}
