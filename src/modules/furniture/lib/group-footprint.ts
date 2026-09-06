import { footprintFromMeta, groupBounds, type MeasuredMeta, type PlacedBox } from '@/shared/lib'

/** One piece of a group, as far as measuring the whole is concerned. */
export type MemberBox = {
  meta: MeasuredMeta
  x: number
  z: number
  rotationYDeg: number
}

/**
 * The floor a group covers, read off the models its pieces are made of.
 *
 * The arithmetic itself is `groupBounds`, which the arranger in the admin panel
 * uses too — one answer, so what the admin lines up and what the room is asked
 * to clear are the same rectangle. This half is only the part that needs the
 * database: turning a model's recorded bounding box into a piece's own size. A
 * piece whose model was never measured is left out rather than counted as a
 * point, which would pull the group's middle towards it.
 */
export function groupFootprint(members: ReadonlyArray<MemberBox>) {
  const pieces: PlacedBox[] = []

  for (const member of members) {
    const footprint = footprintFromMeta(member.meta)
    if (!footprint) continue

    pieces.push({ footprint, x: member.x, z: member.z, rotationYDeg: member.rotationYDeg })
  }

  return groupBounds(pieces)
}
