import type { RoomPart } from '@/entities/building'

/** A row of the fittings list: one fitting, or one group of them. */
export type PartRow = {
  /** Stable across renders: the group key, or the part's own. */
  id: string
  label: string
  /** Every part the row stands for, in list order. */
  keys: string[]
  grouped: boolean
}

export type Point3 = { x: number; y: number; z: number }

/** A group key nothing in the list has taken. */
export function freeGroupKey(parts: ReadonlyArray<RoomPart>): string {
  const taken = new Set(parts.map((part) => part.groupKey).filter(Boolean))
  let n = taken.size + 1
  while (taken.has(`group-${n}`)) n += 1
  return `group-${n}`
}

/**
 * Every part that moves when this one does.
 *
 * A water cooler is a base, a bottle and two levers, and once they have been
 * merged an admin is arranging a water cooler rather than four objects that
 * have to be kept lined up by hand.
 */
export function groupMates(parts: ReadonlyArray<RoomPart>, key: string): string[] {
  const part = parts.find((row) => row.key === key)
  if (!part) return []
  if (!part.groupKey) return [part.key]
  return parts.filter((row) => row.groupKey === part.groupKey).map((row) => row.key)
}

/**
 * A selection grown to whole groups, in list order and without repeats.
 *
 * Picking one lever of a cooler selects the cooler: a group that could be
 * half-selected would let half of it be dragged away, which is the thing
 * merging was meant to stop.
 */
export function expandSelection(
  parts: ReadonlyArray<RoomPart>,
  keys: ReadonlyArray<string>,
): string[] {
  const wanted = new Set<string>()
  for (const key of keys) for (const mate of groupMates(parts, key)) wanted.add(mate)
  return parts.filter((part) => wanted.has(part.key)).map((part) => part.key)
}

/**
 * The list as the panel shows it: a group takes one row.
 *
 * Named after the first of its members, which for a cooler merged from its base
 * upwards is the base — the part an admin would have called it by anyway.
 */
export function partRows(parts: ReadonlyArray<RoomPart>): PartRow[] {
  const rows: PartRow[] = []
  const seen = new Set<string>()

  for (const part of parts) {
    if (!part.groupKey) {
      rows.push({ id: part.key, label: partName(part), keys: [part.key], grouped: false })
      continue
    }
    if (seen.has(part.groupKey)) continue
    seen.add(part.groupKey)

    const members = parts.filter((row) => row.groupKey === part.groupKey)
    rows.push({
      id: part.groupKey,
      label: partName(members[0]),
      keys: members.map((row) => row.key),
      grouped: true,
    })
  }

  return rows
}

/** What one fitting calls itself, before a row decides how to show it. */
export function partName(part: RoomPart): string {
  if (part.name) return part.name
  if (part.source === 'node') return part.nodePath ?? 'Building part'
  const file = (part.modelUrl ?? '').split('/').pop() ?? ''
  return decodeURIComponent(file) || 'Model'
}

/**
 * Where a selection's handles stand: the middle of what is selected.
 *
 * The middle of the box the parts sit in rather than their average, so a cooler
 * with three small levers on one side does not pull its own puck off centre.
 * Height is the lowest of them, because a group stands on whatever its lowest
 * piece stands on.
 */
export function selectionCentre(
  parts: ReadonlyArray<RoomPart>,
  keys: ReadonlyArray<string>,
): Point3 | null {
  const picked = parts.filter((part) => keys.includes(part.key))
  if (picked.length === 0) return null

  /**
   * Pieces of the building are left out of the measurement.
   *
   * One of those stands where the building has it and carries no position of
   * its own — the field reads (0, 0, 0) and means nothing. Averaged in, it
   * drags the handles of anything merged with it into the corner of the room,
   * and puts the puck for a built-in counter at the room's origin rather than
   * under the counter.
   */
  const placed = picked.filter((part) => part.source === 'model')
  const chosen = placed.length > 0 ? placed : picked

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let minY = Infinity

  for (const part of chosen) {
    minX = Math.min(minX, part.position[0])
    maxX = Math.max(maxX, part.position[0])
    minZ = Math.min(minZ, part.position[2])
    maxZ = Math.max(maxZ, part.position[2])
    minY = Math.min(minY, part.position[1])
  }

  return { x: (minX + maxX) / 2, y: minY, z: (minZ + maxZ) / 2 }
}

/** A facing folded back into [0, 360), so it cannot grow without bound. */
export function normaliseYaw(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * The shortest way round from one facing to another, in [−180, 180).
 *
 * The ring hands back an angle already folded into [0, 360), and subtracting a
 * stored facing from it is only the turn the admin made while both are in the
 * same lap. Cross zero — 350° to 10° — and the difference reads as −340: the
 * fitting turns the right way but the group swings all the way round the wrong
 * side of its own centre, once per frame, which is what "it shakes" looks like.
 */
export function shortestTurn(from: number, to: number): number {
  return normaliseYaw(to - from + 180) - 180
}

/**
 * A point turned about another, in the same sense as a fitting's own facing.
 *
 * three's Y rotation takes (x, z) to (x cos + z sin, −x sin + z cos), and a
 * group has to turn the same way its members do or the bottle would orbit one
 * way while facing the other.
 */
export function rotatedAround(
  centre: { x: number; z: number },
  point: { x: number; z: number },
  deltaDeg: number,
): { x: number; z: number } {
  const angle = (deltaDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - centre.x
  const dz = point.z - centre.z
  return { x: centre.x + dx * cos + dz * sin, z: centre.z - dx * sin + dz * cos }
}
