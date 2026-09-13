import type { FittedSet, Room, RoomPart, Zone } from '../model/types'
import type { Point2 } from './polygon'
import { pointInPolygon } from './polygon'

/**
 * The middle of an arrangement, in the building's own XZ.
 *
 * Used as the placement's coordinates, so the record a fitted set leaves behind
 * is an ordinary one: the quote works out which half of a divided room a thing
 * is in from where it stands, and a set that reported (0, 0) would be quoted
 * under whatever room happens to sit at the building's origin.
 *
 * The mean of the parts rather than the middle of their bounding box, because
 * the sizes of the parts are not known until their models are loaded and this
 * has to answer before that — and for the question it answers, "roughly where
 * is this kitchen" is the whole of what is needed.
 */
export function partsCentre(parts: ReadonlyArray<RoomPart>): Point2 {
  if (parts.length === 0) return { x: 0, z: 0 }

  let x = 0
  let z = 0
  for (const part of parts) {
    x += part.position[0]
    z += part.position[2]
  }
  return { x: x / parts.length, z: z / parts.length }
}

/**
 * A stable name for the geometry a part draws, whatever it is made of.
 *
 * Two parts naming the same model, in this room or another, describe the same
 * shape — so whatever is expensive to work out about it is worked out once. A
 * node is named by the building it belongs to as well as by its path, because a
 * path is only meaningful inside one file.
 */
export function partGeometryKey(part: RoomPart, buildingModelUrl: string): string {
  if (part.source === 'node') return `${buildingModelUrl}#${part.nodePath}`

  // The path matters here too. A kitchen imported as its nine fittings is nine
  // parts naming one file, and keying them by the file alone made them one
  // shape: the first to be measured answered for all of them, so a bin stopped
  // furniture with the outline of a fridge.
  const url = part.modelUrl ?? ''
  return part.nodePath ? `${url}#${part.nodePath}` : url
}

/**
 * Which arrangement a placement in this room refers to, or null.
 *
 * Looked up by the package rather than stored on the placement, so a saved
 * order needs nothing it did not already have: an order line names a package
 * and a room, and that pair is what the building answers with an arrangement.
 *
 * A room may offer the same package in more than one place — a long building
 * has a kitchen at each end of one open room — and then the placement's own
 * position tells them apart: a fitted placement stands at the middle of its
 * parts, so the nearest arrangement is the one it was put from. Without a
 * position, the first; that is every caller that has only a package to ask
 * with, and it is right whenever a room offers a package once.
 */
export function fittedSetOf(room: Room, packageId: number, at?: Point2 | null): FittedSet | null {
  const offered = room.fittedSets.filter((set) => set.packageId === packageId)
  if (offered.length === 0) return null
  if (offered.length === 1 || !at) return offered[0]

  let nearest = offered[0]
  let least = Infinity
  for (const set of offered) {
    const centre = partsCentre(set.parts)
    const distance = (centre.x - at.x) ** 2 + (centre.z - at.z) ** 2
    if (distance < least) {
      least = distance
      nearest = set
    }
  }
  return nearest
}

/** The zone an arrangement stands in — null in an undivided room, or off every zone. */
export function zoneOfSet(room: Room, set: FittedSet): Zone | null {
  const centre = partsCentre(set.parts)
  return room.zones.find((zone) => pointInPolygon(centre, zone.polygon)) ?? null
}

/**
 * The arrangements on offer where the visitor is standing.
 *
 * In a divided room a set belongs to the half it stands in, so a kitchen
 * arranged along the kitchen end is not offered from the conference end. A set
 * whose middle lands in no zone at all is offered in the whole room only — it
 * is somebody's mistake, and hiding it everywhere would make it unfindable.
 */
export function fittedSetsIn(room: Room, zone: Zone | null): FittedSet[] {
  if (!zone) return room.fittedSets
  return room.fittedSets.filter((set) => pointInPolygon(partsCentre(set.parts), zone.polygon))
}
