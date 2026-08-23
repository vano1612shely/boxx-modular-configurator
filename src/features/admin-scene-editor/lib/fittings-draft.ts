import type { RoomPart } from '@/entities/building'
import { roomParts } from '@/entities/building'

/**
 * A room's arrangements as the editor holds them.
 *
 * The same shape the scene reads, with one difference that matters: a set with
 * no parts in it survives. The mapper drops those, and rightly — an empty
 * arrangement would put a tile in the panel that costs money and puts nothing
 * in the room — but the editor is where a set is empty for the first minute of
 * its life, and reading it back through the mapper would delete it between
 * "add a kitchen" and "add its first appliance".
 */
export type DraftSet = {
  key: string
  packageId: number
  parts: RoomPart[]
}

export function draftSets(value: unknown): DraftSet[] {
  if (!Array.isArray(value)) return []

  const sets: DraftSet[] = []
  for (const entry of value) {
    const set = entry as Partial<DraftSet> | null
    if (!set || typeof set.key !== 'string' || !set.key) continue
    if (typeof set.packageId !== 'number' || !Number.isFinite(set.packageId)) continue
    sets.push({ key: set.key, packageId: set.packageId, parts: roomParts(set.parts) })
  }
  return sets
}

/**
 * A centimetre, for the height of a fitting.
 *
 * The floor grid is 5 cm, which is right for walls and outlines and wrong for
 * this: a worktop is 0.92 m, and on a 5 cm grid the nearest a microwave can get
 * to standing on it is 3 cm through it or 3 cm above it.
 */
const HEIGHT_STEP = 0.01

/**
 * Where a height drag has put a fitting, in the only frame it is stored in.
 *
 * Three things at once, and each of them is a bug that has been written before
 * somewhere. The grip offset is subtracted, so the fitting does not jump to
 * centre itself on the pointer. The room's floor is subtracted, because a part
 * stores its height above *this room's* floor and not a level in the building —
 * which is what keeps a microwave on its worktop when a storey is re-levelled.
 * And nothing goes below the floor: a fitting sunk into the slab is nobody's
 * intention and is hard to find again once it is in there.
 */
export function heightAboveFloor(worldY: number, grabDY: number, floorY: number): number {
  const above = (worldY - grabDY - floorY) / HEIGHT_STEP
  return Math.max(Math.round(above) * HEIGHT_STEP, 0)
}

/** A key nothing in this list has taken. Keys are the identity — indexes shift. */
export function freeKeyIn(rows: ReadonlyArray<{ key: string }>, prefix: string): string {
  let n = rows.length + 1
  while (rows.some((row) => row.key === `${prefix}-${n}`)) n += 1
  return `${prefix}-${n}`
}
