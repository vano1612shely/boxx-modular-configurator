import type { Footprint } from './footprint-from-meta'

export type HalfExtents = { halfW: number; halfD: number }

/**
 * How far a turned rectangle reaches along each axis, from its own middle.
 *
 * A rectangle turned about its centre projects both of its sides onto both
 * axes, so the reach is the sum of the two projections. True at any angle, not
 * only the right ones — which is the whole reason it is written out rather than
 * swapping width and depth at 90 degrees.
 */
export function rotatedHalfExtents(
  footprint: { width: number; depth: number },
  rotationYDeg: number,
): HalfExtents {
  const rad = (rotationYDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    halfW: (cos * footprint.width + sin * footprint.depth) / 2,
    halfD: (sin * footprint.width + cos * footprint.depth) / 2,
  }
}

/** One piece of an arrangement: its own floor rectangle, and where it was put. */
export type PlacedBox = {
  footprint: Footprint
  x: number
  z: number
  rotationYDeg: number
}

/**
 * The floor rectangle a whole arrangement covers, and where its middle sits.
 *
 * The middle is returned because it is rarely (0, 0): an admin arranging a table
 * with chairs down one side is not going to balance the result about the origin,
 * and both the placement search and the pieces' own offsets are expressed
 * against the middle of a footprint. Handing back both is what lets a room be
 * asked for the space the group actually needs.
 *
 * Each piece is a rectangle turned about its own centre, which is where it is
 * drawn from — the same recentring every package gets. A turned rectangle's
 * axis-aligned reach is the sum of its two sides' projections, so this holds at
 * any angle and not only the right ones.
 */
export function groupBounds(pieces: ReadonlyArray<PlacedBox>): {
  footprint: Footprint
  centre: { x: number; z: number }
} | null {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const piece of pieces) {
    const { halfW, halfD } = rotatedHalfExtents(piece.footprint, piece.rotationYDeg)

    minX = Math.min(minX, piece.x - halfW)
    maxX = Math.max(maxX, piece.x + halfW)
    minZ = Math.min(minZ, piece.z - halfD)
    maxZ = Math.max(maxZ, piece.z + halfD)
  }

  if (!Number.isFinite(minX)) return null

  const round = (value: number) => Math.round(value * 1000) / 1000

  return {
    footprint: { width: round(maxX - minX), depth: round(maxZ - minZ) },
    centre: { x: round((minX + maxX) / 2), z: round((minZ + maxZ) / 2) },
  }
}
