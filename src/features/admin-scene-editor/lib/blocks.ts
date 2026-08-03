// Kept out of the model hook so vitest can import it: that file pulls in
// `@payloadcms/ui`, and with it CSS vitest cannot load.

export type EditorBox = {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

/** Which collection of volumes a ref addresses. */
export type BlockScope = 'roof' | 'floor'

/** Index into `sceneConfig.roofBlocks`, or into `sceneConfig.floors`. */
export type BlockRef = { scope: BlockScope; index: number }

export function sameBlockRef(a: BlockRef, b: BlockRef): boolean {
  return a.scope === b.scope && a.index === b.index
}

/** Stable across both collections, so a pick cannot confuse them. */
export function blockRefKey(ref: BlockRef): string {
  return `${ref.scope}:${ref.index}`
}

/** Orders every axis so min <= max, however the corners were dragged. */
export function normalizeBox(box: EditorBox): EditorBox {
  return {
    min: {
      x: Math.min(box.min.x, box.max.x),
      y: Math.min(box.min.y, box.max.y),
      z: Math.min(box.min.z, box.max.z),
    },
    max: {
      x: Math.max(box.min.x, box.max.x),
      y: Math.max(box.min.y, box.max.y),
      z: Math.max(box.min.z, box.max.z),
    },
  }
}

export function defaultYRange(modelHeight: number): [number, number] {
  const h = Math.max(modelHeight, 2.5)
  return [h * 0.82, h + 0.6]
}

export type PlaneRect = { minX: number; minZ: number; maxX: number; maxZ: number }

/** Metres a storey volume reaches past the model, so its sides cut no wall. */
const STOREY_PAD = 1.5

/**
 * Where the next storey goes.
 *
 * The first one splits the model in half, which is the right guess for the
 * two-storey case the feature exists for; each one after it stands on the last
 * and repeats its height. The sides are drawn well clear of the model: a
 * storey is separated from another storey in height alone, and a side that
 * lands mid-wall cuts a hole rather than a section.
 */
export function nextStoreyBox(
  previous: EditorBox | null,
  modelHeight: number,
  footprint: PlaneRect | null,
): EditorBox {
  const height = Math.max(modelHeight, 2.5)
  const from = previous ? previous.max.y : 0
  const rise = previous ? Math.max(previous.max.y - previous.min.y, 0.5) : height / 2

  const rect = footprint ?? { minX: -6, minZ: -6, maxX: 6, maxZ: 6 }

  return {
    min: { x: rect.minX - STOREY_PAD, y: from, z: rect.minZ - STOREY_PAD },
    max: { x: rect.maxX + STOREY_PAD, y: from + rise, z: rect.maxZ + STOREY_PAD },
  }
}
