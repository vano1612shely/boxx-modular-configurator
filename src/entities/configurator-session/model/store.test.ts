import { beforeEach, describe, expect, it } from 'vitest'

import { useConfiguratorSession, type BuildingBounds } from './store'

const BOUNDS: BuildingBounds = { min: [-5, 0, -5], max: [5, 3, 5] }

function session() {
  return useConfiguratorSession.getState()
}

/** How many camera flights an action asked for. */
function requests(run: () => void): number {
  const before = session().viewRequestId
  run()
  return session().viewRequestId - before
}

beforeEach(() => {
  session().reset()
  useConfiguratorSession.setState({ buildingBounds: null })
})

describe('move-to requests', () => {
  // The rig consumes the pose and clears it. If asking did not count as a
  // request, the rig would not re-run and the camera would never go.
  it('asks for a flight', () => {
    expect(requests(() => session().requestMoveTo([1, 2, 3], [0, 0, 0]))).toBe(1)
    expect(session().moveToTarget).toEqual({ position: [1, 2, 3], target: [0, 0, 0] })
  })

  // Putting a consumed pose down is not asking to go anywhere. A bump here
  // would re-run the rig, find no pose, and fly straight back to the view
  // preset the visitor had just left.
  it('does not ask for one when the pose is put down', () => {
    session().requestMoveTo([1, 2, 3], [0, 0, 0])
    expect(requests(() => session().clearMoveTo())).toBe(0)
    expect(session().moveToTarget).toBeNull()
  })

  it('is dropped by any action that reframes the scene', () => {
    for (const act of [
      () => session().setViewMode('top'),
      () => session().selectFloor('floor-2'),
      () => session().focusRoom('room-1'),
      () => session().exitRoomFocus(),
    ]) {
      session().requestMoveTo([1, 2, 3], [0, 0, 0])
      act()
      expect(session().moveToTarget).toBeNull()
    }
  })
})

describe('reset', () => {
  it('drops every choice the visitor made', () => {
    session().focusRoom('room-1')
    session().setViewMode('side-left')
    session().toggleCeiling()
    session().selectFloor('floor-2')
    session().setInteractionLock(true)
    session().requestMoveTo([1, 2, 3], [0, 0, 0])

    session().reset()

    expect(session()).toMatchObject({
      focusedRoomKey: null,
      viewMode: 'dollhouse',
      showCeiling: false,
      selectedFloorKey: null,
      interactionLock: false,
      moveToTarget: null,
    })
  })

  it('reframes, so the camera does not stay pointed at the last building', () => {
    expect(requests(() => session().reset())).toBe(1)
  })

  // BuildingModel publishes bounds only when they differ from what the store
  // holds, and reset runs in a parent effect — after the child's. Clearing them
  // here would land after the new model had already measured itself, and it
  // would never measure again.
  it('leaves the measured bounds alone', () => {
    useConfiguratorSession.setState({ buildingBounds: BOUNDS })
    session().reset()
    expect(session().buildingBounds).toEqual(BOUNDS)
  })
})
