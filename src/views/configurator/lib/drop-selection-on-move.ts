import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'

/**
 * Everywhere the visitor can be, as one comparable thing.
 *
 * All five, because all five move what is on screen and any one of them left
 * out is a way to walk off and leave a toolbar behind:
 *
 * - the room being stood in, and the half of it being furnished
 * - a room framed from above without going in — a camera move all the same
 * - the storey on show, which hides every other storey's furniture outright
 * - an entrance whose choices are open, which flies the eye outside
 *
 * Deliberately not here: the view mode, the roof, the panel, the interaction
 * lock. Those change how the same place looks, and losing a selection because
 * the roof faded would be worse than the bug this exists to fix.
 */
function placeOnScreen(state: {
  focusedRoomKey: string | null
  previewRoomKey: string | null
  activeZoneKey: string | null
  selectedFloorKey: string | null
  openSlotKey: string | null
}) {
  return [
    state.focusedRoomKey,
    state.previewRoomKey,
    state.activeZoneKey,
    state.selectedFloorKey,
    state.openSlotKey,
  ].join('/')
}

/**
 * Drops the selected furniture when the visitor goes somewhere else.
 *
 * Picking a piece puts a toolbar over it. Walking away used to leave that
 * toolbar behind, hanging over a part of the building no longer on screen, and
 * the only way to be rid of it was to find bare floor and click it.
 *
 * One rule watching where the visitor is, rather than the same line added to
 * each of the several things that move them: a new way to move should not have
 * to remember this. The session knows where the visitor is and the
 * configuration knows what they picked; neither should have to know about the
 * other, so the two are joined at the screen, where they already are.
 *
 * Returns the unsubscribe.
 */
export function dropSelectionOnMove(): () => void {
  return useConfiguratorSession.subscribe((state, previous) => {
    if (placeOnScreen(state) === placeOnScreen(previous)) return
    useConfiguration.getState().selectPackage(null)
  })
}
