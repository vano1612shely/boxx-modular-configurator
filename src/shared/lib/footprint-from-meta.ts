export type MeasuredMeta = {
  bboxMin?: unknown
  bboxMax?: unknown
} | null | undefined

export type Footprint = { width: number; depth: number }

/** Meters. */
const MIN_SIDE = 0.01

function axis(value: unknown, index: number): number | null {
  if (!Array.isArray(value)) return null
  const n = value[index]
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

export function footprintFromMeta(meta: MeasuredMeta): Footprint | null {
  if (!meta) return null

  const minX = axis(meta.bboxMin, 0)
  const maxX = axis(meta.bboxMax, 0)
  const minZ = axis(meta.bboxMin, 2)
  const maxZ = axis(meta.bboxMax, 2)
  if (minX === null || maxX === null || minZ === null || maxZ === null) return null

  const width = Math.abs(maxX - minX)
  const depth = Math.abs(maxZ - minZ)
  if (width < MIN_SIDE || depth < MIN_SIDE) return null

  return { width: Math.round(width * 1000) / 1000, depth: Math.round(depth * 1000) / 1000 }
}
