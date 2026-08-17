import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'

/** Which part of the building is on screen, as one comparable thing. */
function placeOnScreen(state: { focusedRoomKey: string | null; activeZoneKey: string | null }) {
  return `${state.focusedRoomKey ?? ''}/${state.activeZoneKey ?? ''}`
}

/**
 * Drops the selected furniture when the visitor goes somewhere else.
 *
 * Picking a piece puts a toolbar over it. Walking away — into a zone, out to
 * the building, round the zone bar, or through the panel's own zone rail — used
 * to leave that toolbar behind, hanging over a part of the room no longer on
 * screen, and the only way to be rid of it was to find bare floor and click it.
 *
 * One rule watching where the visitor is, rather than the same line added to
 * each of the five things that move them: a sixth way to move should not have
 * to remember this. The session knows where the visitor is and the
 * configuration knows what they picked; neither should have to know about the
 * other, so the two are joined here, where they already are.
 *
 * Returns the unsubscribe.
 */
export function dropSelectionOnMove(): () => void {
  return useConfiguratorSession.subscribe((state, previous) => {
    if (placeOnScreen(state) === placeOnScreen(previous)) return
    useConfiguration.getState().selectPackage(null)
  })
}
