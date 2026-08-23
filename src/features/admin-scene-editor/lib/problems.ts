import { draftZones } from './zones-draft'

/** Something that would be wrong with the building if it were saved as it stands. */
export type EditorProblem = { where: string; what: string }

type DraftRoom = { name?: string | null; zones?: unknown }

/**
 * What is wrong with the building as it stands, in the words of the panel.
 *
 * Names, and for a reason: a room and a zone are named things, and the visitor
 * reads those names on the chips in the scene and on the lines of their quote.
 * The old way of stopping a blank one was to fill it in — the key went in where
 * the name should be — which meant the field could not be emptied and so could
 * not be retyped either. Refusing the save instead lets a name be cleared and
 * rewritten, and says plainly why the button is off while it is blank.
 *
 * A room with no name is named by its position for the message, because "Room 3
 * needs a name" is findable and "needs a name" is not.
 */
export function findProblems(rooms: ReadonlyArray<DraftRoom>): EditorProblem[] {
  const found: EditorProblem[] = []

  rooms.forEach((room, index) => {
    const named = typeof room.name === 'string' && room.name.trim() !== ''
    const where = named ? (room.name as string) : `Room ${index + 1}`
    if (!named) found.push({ where, what: 'needs a name' })

    for (const zone of draftZones(room.zones)) {
      if (zone.name.trim() === '') {
        found.push({ where: `${where} › ${zone.key}`, what: 'needs a name' })
      }
    }
  })

  return found
}
