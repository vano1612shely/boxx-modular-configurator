export type RoomLabel = { key: string; name: string }

export type RoomGroup<T> = {
  key: string
  name: string
  packages: T[]
}

/**
 * Groups placements by room, in the building's own room order rather than the
 * order things happened to be dropped in.
 *
 * A placement whose room the scene no longer describes still has to appear, or
 * the quote would silently list less than the customer configured.
 */
export function groupByRoom<T extends { roomKey: string }>(
  items: T[],
  rooms: RoomLabel[],
): Array<RoomGroup<T>> {
  const byRoom = new Map<string, T[]>()
  for (const item of items) {
    const bucket = byRoom.get(item.roomKey)
    if (bucket) bucket.push(item)
    else byRoom.set(item.roomKey, [item])
  }

  const known = rooms.flatMap((room) => {
    const packages = byRoom.get(room.key)
    byRoom.delete(room.key)
    return packages ? [{ key: room.key, name: room.name, packages }] : []
  })

  const orphaned = [...byRoom].map(([key, packages]) => ({ key, name: key, packages }))

  return [...known, ...orphaned]
}
