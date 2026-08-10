import type { Room } from '../model/types'

// The generated floor slab pins its top face to this value; the furniture drag
// plane uses it too, so the two must stay identical.
export function roomFloorTopY(room: Room): number {
  return room.shell.floorY
}
