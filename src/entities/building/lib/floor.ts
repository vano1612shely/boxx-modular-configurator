import type { RoomZone } from '../model/types'

/**
 * The walkable floor level of a room.
 *
 * Shared by the building overview (where furniture stands on the real glb) and
 * the focused room (where it stands on the generated slab), so the generator
 * pins its floor's top face to exactly this value. Anything else and the drag
 * plane would sit off the visible floor and every placement would feel
 * slippery, while still looking correct in a screenshot.
 */
export function roomFloorTopY(room: RoomZone): number {
  return room.shell.floorY
}
