import { rotatedHalfExtents } from '@/shared/lib'

/** One piece of the arrangement, as far as looking for clashes goes. */
export type ArrangedPiece = {
  footprint: { width: number; depth: number }
  x: number
  z: number
  rotationYDeg: number
}

/**
 * Metres two pieces may share before it is worth saying anything.
 *
 * A chair tucked under a table is the arrangement working, not a mistake, and
 * their rectangles already overlap by two thirds of the chair. What this looks
 * for is the other thing — one model standing *inside* another because both
 * were dropped in at the origin and nobody has moved them — so the bar is set
 * above what tucking costs and below swallowing a piece whole.
 *
 * Set from the real case: a 0.5 m chair pushed under a 2 x 1.2 m table shares
 * about 0.7 of itself, and a piece left on top of another shares all of it.
 */
const SHARE_ALLOWED = 0.85

function overlapArea(a: ArrangedPiece, b: ArrangedPiece): number {
  const ea = rotatedHalfExtents(a.footprint, a.rotationYDeg)
  const eb = rotatedHalfExtents(b.footprint, b.rotationYDeg)

  const acrossX = Math.min(a.x + ea.halfW, b.x + eb.halfW) - Math.max(a.x - ea.halfW, b.x - eb.halfW)
  const acrossZ = Math.min(a.z + ea.halfD, b.z + eb.halfD) - Math.max(a.z - ea.halfD, b.z - eb.halfD)
  if (acrossX <= 0 || acrossZ <= 0) return 0

  return acrossX * acrossZ
}

function area(piece: ArrangedPiece): number {
  const { halfW, halfD } = rotatedHalfExtents(piece.footprint, piece.rotationYDeg)
  return Math.max(halfW * halfD * 4, 1e-6)
}

/**
 * Which pieces are standing in each other, by index.
 *
 * The arranger draws these in a warning colour, which is the whole point of
 * having a scene rather than a list of numbers: two models dropped in at once
 * both start at the origin, and without seeing it an admin has no way to know
 * the chairs are inside the table.
 *
 * Axis-aligned boxes around the turned rectangles, not the models themselves. A
 * hint has to be cheap enough to run on every frame of a drag, and being a
 * little eager about an L-shaped piece costs a warning nobody has to obey.
 */
export function clashingPieces(pieces: ReadonlyArray<ArrangedPiece>): Set<number> {
  const clashing = new Set<number>()

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const shared = overlapArea(pieces[i], pieces[j])
      if (shared === 0) continue

      const smaller = Math.min(area(pieces[i]), area(pieces[j]))
      if (shared / smaller < SHARE_ALLOWED) continue

      clashing.add(i)
      clashing.add(j)
    }
  }

  return clashing
}
