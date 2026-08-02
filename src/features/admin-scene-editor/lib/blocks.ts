// Kept out of the model hook so vitest can import it: that file pulls in
// `@payloadcms/ui`, and with it CSS vitest cannot load.

export type EditorBox = {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

/** Index into `sceneConfig.roofBlocks`. */
export type BlockRef = { index: number }

export function sameBlockRef(a: BlockRef, b: BlockRef): boolean {
  return a.index === b.index
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
