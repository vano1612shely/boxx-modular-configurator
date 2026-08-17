import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession } from '@/entities/configurator-session'

import { dropSelectionOnMove } from './drop-selection-on-move'

const session = () => useConfiguratorSession.getState()
const configuration = () => useConfiguration.getState()

/** A piece of furniture, picked up. */
function pickSomething() {
  configuration().selectPackage('instance-1')
  expect(configuration().selectedInstanceId).toBe('instance-1')
}

describe('dropSelectionOnMove', () => {
  let stop: () => void

  beforeEach(() => {
    useConfiguration.getState().adoptBuilding(1)
    session().reset()
    stop = dropSelectionOnMove()
  })

  afterEach(() => stop())

  /**
   * The one that got away the first time.
   *
   * Clicking a room's floor out in the building view frames it from above
   * without going in — a camera move under its own name, `previewRoom`, and
   * neither of the two fields this rule was first written against. So the
   * visitor pressed a room, the eye flew to it, and the toolbar of a piece two
   * rooms over stayed on screen.
   */
  it('lets go when a room is framed from the outside', () => {
    pickSomething()

    session().previewRoom('room-5')

    expect(configuration().selectedInstanceId).toBeNull()
  })

  it('lets go again when that framing is dropped', () => {
    session().previewRoom('room-5')
    pickSomething()

    session().clearPreview()

    expect(configuration().selectedInstanceId).toBeNull()
  })

  // Another storey is not another view of the same place — the furniture on
  // every other one is cut away entirely.
  it('lets go when the storey changes', () => {
    pickSomething()

    session().selectFloor('floor-2')

    expect(configuration().selectedInstanceId).toBeNull()
  })

  // Opening an entrance's choices flies the eye outside the building.
  it('lets go when an entrance is opened', () => {
    pickSomething()

    session().openExteriorSlot('spot-1')

    expect(configuration().selectedInstanceId).toBeNull()
  })

  // The report: in the whole-room view, clicking a zone to zoom into it left
  // the toolbar of a piece in the other half sitting on screen, and the only
  // way to be rid of it was to hunt for bare floor.
  it('lets go when a zone is picked', () => {
    session().focusRoom('room-1')
    pickSomething()

    session().setActiveZone('kitchen')

    expect(configuration().selectedInstanceId).toBeNull()
  })

  it('lets go when the zone is stepped back to the whole room', () => {
    session().focusRoom('room-1')
    session().setActiveZone('kitchen')
    pickSomething()

    session().setActiveZone(null)

    expect(configuration().selectedInstanceId).toBeNull()
  })

  // The same toolbar over the whole building, which is where "Back to
  // building" used to leave it.
  it('lets go on the way out of the room', () => {
    session().focusRoom('room-1')
    pickSomething()

    session().exitRoomFocus()

    expect(configuration().selectedInstanceId).toBeNull()
  })

  it('lets go on the way into a room', () => {
    pickSomething()

    session().focusRoom('room-1')

    expect(configuration().selectedInstanceId).toBeNull()
  })

  /**
   * The other half of the rule, and the one that would make it a nuisance: a
   * piece is added, selected, and then nudged about. None of that is going
   * anywhere, and losing the toolbar mid-adjustment would be worse than the bug.
   */
  it('holds on while the visitor stays put', () => {
    session().focusRoom('room-1')
    session().setActiveZone('kitchen')
    pickSomething()

    session().setInteractionLock(true)
    session().setPanelCollapsed(true)
    session().setActiveZone('kitchen')
    // Looking at the same place differently: turning the view, dropping the
    // roof, dragging the piece about. None of it goes anywhere.
    session().setViewMode('dollhouse')
    session().setRoofShown(true)
    session().rotateView(1)
    session().noteManualView()

    expect(configuration().selectedInstanceId).toBe('instance-1')
  })

  it('stops watching once it is stopped', () => {
    session().focusRoom('room-1')
    pickSomething()

    stop()
    session().setActiveZone('kitchen')

    expect(configuration().selectedInstanceId).toBe('instance-1')
  })
})
