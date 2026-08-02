import type { RoomZone } from '../model/types'

// The generated floor slab pins its top face to this value; the furniture drag
// plane uses it too, so the two must stay identical.
export function roomFloorTopY(room: RoomZone): number {
  return room.shell.floorY
}
