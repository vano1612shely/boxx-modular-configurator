import type { Room } from '@/entities/building'

/** Going in and standing in it, or bringing it close and looking down into it. */
export type RoomEntry = 'focus' | 'preview'

/**
 * What pressing a room's marker does.
 *
 * Going into a room is a mode, not a camera move: the building's own model is
 * hidden wholesale and a shell is generated from the outline to stand inside,
 * the furniture panel opens, and there is one way back out.
 *
 * A restroom wants none of that, and for a reason worth writing down — its
 * fittings are part of the building's model, which going in is precisely what
 * hides. Focus would replace the thing worth looking at with a bare box with a
 * door in it. So it is brought close and looked down into instead: the same
 * framing the room mode uses, without the mode, which is also what leaves it
 * unfurnishable without a single guard anywhere downstream.
 *
 * This is the only place that decision is made. `focusRoom` has exactly one
 * caller in the app, and it goes through here — so a restroom's key can never
 * reach `focusedRoomKey`, and the fourteen things that switch on it stay right
 * by construction rather than by being told about restrooms one at a time.
 */
export function roomEntry(room: Room): RoomEntry {
  return room.isRestroom ? 'preview' : 'focus'
}
