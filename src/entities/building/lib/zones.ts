import { areaIn, type AreaUnit } from '@/shared/lib'
import { ZONE_TINTS } from '@/shared/three/scene-tokens'

import type { Room, RoomType, Zone } from '../model/types'
import { pointInPolygon, polygonSignedArea, type Point2 } from './polygon'
import { connectedGroups, regionAround, regionFrom, type Region } from './region'

/** Rooms are undivided until somebody cuts one, which is most of them. */
export function isDivided(room: Room): boolean {
  return room.zones.length > 0
}

export function zoneOf(room: Room, key: string | null): Zone | null {
  if (key === null) return null
  return room.zones.find((zone) => zone.key === key) ?? null
}

/** The zone a point stands in, or null in an undivided room or a gap. */
export function zoneAt(room: Room, x: number, z: number): Zone | null {
  return room.zones.find((zone) => pointInPolygon({ x, z }, zone.polygon)) ?? null
}

/**
 * Floor area of a zone, in the unit asked for.
 *
 * The room's own rule, applied to a smaller outline: an authored figure wins
 * over the trace, and each unit is measured in its own right rather than
 * converted. Unrounded — the caller rounds once, at the point of display.
 */
export function zoneArea(zone: Zone, unit: AreaUnit): number {
  return areaIn(
    unit,
    { sqft: zone.areaSqFt, sqm: zone.areaSqM },
    Math.abs(polygonSignedArea(zone.polygon)),
  )!
}

/** The tint nobody in this room has taken, so no two zones look alike. */
export function nextZoneTint(taken: ReadonlyArray<string>): string {
  return ZONE_TINTS.find((tint) => !taken.includes(tint)) ?? ZONE_TINTS[0]
}

/**
 * What a divided room is called when nobody has named it.
 *
 * "Conference + Kitchen" says what the space is far better than either half
 * does, and it stays right when a zone is renamed. An explicit room name always
 * wins — this is only the fallback the editor offers.
 */
export function zoneNamesJoined(zones: ReadonlyArray<Zone>): string {
  return zones.map((zone) => zone.name).join(' + ')
}

/** Whether a package with these compatible types may stand in this zone. */
export function zoneAccepts(zone: Zone, compatibleRoomTypes: ReadonlyArray<RoomType>): boolean {
  return compatibleRoomTypes.length === 0 || compatibleRoomTypes.includes(zone.roomType)
}

function acceptingPolygons(room: Room, compatibleRoomTypes: ReadonlyArray<RoomType>): Point2[][] {
  if (!isDivided(room)) return [room.floorPolygon]
  return room.zones
    .filter((zone) => zoneAccepts(zone, compatibleRoomTypes))
    .map((zone) => zone.polygon)
}

/**
 * The floor a package may be moved over, given where it already stands.
 *
 * Zones it is at home in are joined into one surface with no line between
 * them; zones it is not stop it exactly as a wall does. Anchored on its
 * current position, because two friendly zones with an unfriendly one between
 * them are two separate places and there is no way across.
 */
export function reachableFloor(
  room: Room,
  compatibleRoomTypes: ReadonlyArray<RoomType>,
  x: number,
  z: number,
): Region {
  const polygons = acceptingPolygons(room, compatibleRoomTypes)
  if (polygons.length === 0) return regionFrom([room.floorPolygon])
  return regionAround(polygons, x, z)
}

/** The whole of what a package may occupy, for "does this even fit" questions. */
export function acceptingFloor(
  room: Room,
  compatibleRoomTypes: ReadonlyArray<RoomType>,
): Region {
  const polygons = acceptingPolygons(room, compatibleRoomTypes)
  return regionFrom(polygons.length ? polygons : [room.floorPolygon])
}

/**
 * Zones of the room a package could be offered in at all.
 *
 * Grouped by reachability so the panel can say "this seats six, and there are
 * two places in this room it could go" without implying they are one place.
 */
export function reachableGroups(
  room: Room,
  compatibleRoomTypes: ReadonlyArray<RoomType>,
): Point2[][][] {
  return connectedGroups(acceptingPolygons(room, compatibleRoomTypes))
}
