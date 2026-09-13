import type { AreaUnit } from '@/shared/lib'
import { formatArea } from '@/shared/lib'

import type { Room, Zone } from '../model/types'
import type { SummaryFact } from './building-summary'
import { roomArea } from './room-framing'
import { zoneArea } from './zones'

/** What a room is for, in words. A key with no entry falls back to the key, which is at least true. */
export type RoomTypeNames = Record<string, string>

/**
 * The facts a room answers for, once the visitor is standing in it.
 *
 * A zone answers for itself once one is picked. Whole-room facts for a divided
 * room leave the type out: calling a conference-and-kitchen room "Kitchen"
 * because that is what its `roomType` happens to say would be a plain untruth,
 * and the zone list below already says what the halves are.
 */
export function roomFacts(
  room: Room,
  zone: Zone | null,
  unit: AreaUnit,
  typeNames: RoomTypeNames,
): SummaryFact[] {
  const named = (key: string) => typeNames[key] ?? key

  if (zone) {
    return [
      { label: 'Type', value: named(zone.roomType) },
      { label: 'Approx. floor area', value: formatArea(zoneArea(zone, unit), unit), inUnits: true },
    ]
  }

  return [
    // A restroom's catalogue type is required by the schema and answers a
    // question nobody asked of it — which furniture fits somewhere nothing is
    // furnished. Whichever row an admin happened to pick stays unsaid — unless
    // they picked something that is plainly not a restroom, which is how a
    // corridor is made: look-only like a restroom, and named for what it is.
    ...(room.isRestroom
      ? [{ label: 'Type', value: room.roomType === 'restroom' ? 'Restroom' : named(room.roomType) }]
      : room.zones.length > 0
        ? room.zones.map((each) => ({ label: each.name, value: named(each.roomType) }))
        : [{ label: 'Type', value: named(room.roomType) }]),
    // Always present: a room has an outline, so there is always an area to
    // measure even when nobody has written one down.
    { label: 'Approx. floor area', value: formatArea(roomArea(room, unit), unit), inUnits: true },
  ]
}
