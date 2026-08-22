import type { Point2, Room, Zone } from '@/entities/building'
import { polygonCentroid } from '@/entities/building'

import { roomEntry, type RoomEntry } from './room-entry'

/** One thing to press in the building view, and where it hangs. */
export type RoomMarker = {
  /** Unique across the building: the room's key, and the zone's where there is one. */
  key: string
  room: Room
  /** The half of the room this stands for, or null for the whole of it. */
  zone: Zone | null
  name: string
  /** Middle of the floor it stands for, in the XZ plane. */
  at: Point2
  entry: RoomEntry
}

/**
 * What the building view offers to press, one entry per place worth going to.
 *
 * A divided room gets a marker per zone rather than one for the room. The two
 * halves of a conference-and-restroom are separate places with separate uses
 * and separate catalogues — a single marker over the middle of both named the
 * room and then landed the visitor in a mode that was neither half, leaving the
 * choice to be made a second time from inside. Pressing a zone goes in with
 * that zone already picked, which is what the marker said it would do.
 *
 * The whole of a divided room is still reachable — the zone bar in the room
 * steps back out to it, which is where a piece of furniture lying across the
 * line between two halves gets added from.
 *
 * A room nobody has cut keeps its single marker, and so does a restroom: a
 * restroom is never gone into, so its halves — if some old record has any —
 * would be offering a way in that does not exist.
 */
export function roomMarkers(rooms: ReadonlyArray<Room>): RoomMarker[] {
  return rooms.flatMap<RoomMarker>((room) => {
    const entry = roomEntry(room)

    if (entry !== 'focus' || room.zones.length === 0) {
      return [
        {
          key: room.key,
          room,
          zone: null,
          name: room.name,
          at: polygonCentroid(room.floorPolygon),
          entry,
        },
      ]
    }

    return room.zones.map((zone) => ({
      key: `${room.key}/${zone.key}`,
      room,
      zone,
      name: zone.name,
      at: polygonCentroid(zone.polygon),
      entry,
    }))
  })
}
