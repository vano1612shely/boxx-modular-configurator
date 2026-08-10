import type { Room } from '@/entities/building'

export type PlaceLabel = { key: string; name: string }

export type PlaceGroup<T> = {
  key: string
  name: string
  packages: T[]
}

/**
 * Every heading the quote can carry, in the building's own order.
 *
 * A room is one place until it is divided, and then it is one per zone: the
 * customer asked for a kitchen's worth of furniture and a conference room's
 * worth, and a single list headed with both names at once would hide which is
 * which. Undivided rooms are unchanged, which is nearly all of them.
 */
export function placesOf(rooms: ReadonlyArray<Room>): PlaceLabel[] {
  return rooms.flatMap((room) =>
    room.zones.length === 0
      ? [{ key: room.key, name: room.name }]
      : room.zones.map((zone) => ({ key: placeKeyOf(room.key, zone.key), name: zone.name })),
  )
}

export function placeKeyOf(roomKey: string, zoneKey: string | null): string {
  return zoneKey === null ? roomKey : `${roomKey}/${zoneKey}`
}

/**
 * Groups placements by place, in the building's own order rather than the order
 * things happened to be dropped in.
 *
 * A placement whose place the scene no longer describes still has to appear, or
 * the quote would silently list less than the customer configured.
 */
export function groupByPlace<T extends { placeKey: string }>(
  items: T[],
  places: PlaceLabel[],
): Array<PlaceGroup<T>> {
  const byPlace = new Map<string, T[]>()
  for (const item of items) {
    const bucket = byPlace.get(item.placeKey)
    if (bucket) bucket.push(item)
    else byPlace.set(item.placeKey, [item])
  }

  const known = places.flatMap((place) => {
    const packages = byPlace.get(place.key)
    byPlace.delete(place.key)
    return packages ? [{ key: place.key, name: place.name, packages }] : []
  })

  const orphaned = [...byPlace].map(([key, packages]) => ({ key, name: key, packages }))

  return [...known, ...orphaned]
}
