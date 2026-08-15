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
      () => session().recenter(),
    ]) {
      session().requestMoveTo([1, 2, 3], [0, 0, 0])
      act()
      expect(session().moveToTarget).toBeNull()
    }
  })
})

describe('the opening view', () => {
  // The client's rule: a building opens as a plan is read, straight down.
  it('looks down at the plan before anybody has pressed anything', () => {
    expect(session()).toMatchObject({ viewMode: 'top', pickedView: 'top' })
  })
})

describe('room focus', () => {
  it('goes in on the dollhouse and comes out looking down', () => {
    session().setViewMode('dollhouse')
    session().focusRoom('room-1')
    expect(session().viewMode).toBe('dollhouse')

    session().exitRoomFocus()
    expect(session()).toMatchObject({ focusedRoomKey: null, viewMode: 'top' })
  })
})

describe('the view the bar names', () => {
  // The client's rule: a view is lit only when that exact button was pressed.
  it('follows the button that was pressed', () => {
    session().setViewMode('dollhouse')
    expect(session().pickedView).toBe('dollhouse')
  })

  // The whole complaint: after dragging the model the bar went on insisting on
  // a view the camera had long since left.
  it('names nothing the moment the model is moved by hand', () => {
    session().setViewMode('dollhouse')
    session().noteManualView()
    expect(session().pickedView).toBeNull()
  })

  // The one thing that must NOT happen: relabelling is not a reason to fly.
  // viewMode is in the rig's dependencies and also sets the polar floor, so
  // writing either mid-drag would jerk the model out from under the finger.
  it('costs the camera nothing', () => {
    session().setViewMode('dollhouse')
    expect(requests(() => session().noteManualView())).toBe(0)
    expect(session().viewMode).toBe('dollhouse')
  })

  it('is cleared by a quarter turn, which is not that view’s button', () => {
    session().setViewMode('dollhouse')
    session().rotateView(1)
    expect(session().pickedView).toBeNull()
    expect(session().viewMode).toBe('dollhouse')
  })

  // …except from the top, which is not a bearing: the eye is straight over the
  // subject either way, so the plan turned a quarter is still the plan.
  it('survives a quarter turn taken from the top view', () => {
    session().setViewMode('top')
    session().rotateView(1)
    session().rotateView(1)
    expect(session().pickedView).toBe('top')
  })

  // Including inside a room, where the turn is the same turn.
  it('survives it inside a room too', () => {
    session().focusRoom('room-1')
    session().setViewMode('top')
    session().rotateView(-1)
    expect(session().pickedView).toBe('top')
  })

  it('is restored by pressing the same pill again', () => {
    session().setViewMode('dollhouse')
    session().noteManualView()
    expect(requests(() => session().setViewMode('dollhouse'))).toBe(1)
    expect(session().pickedView).toBe('dollhouse')
  })
})

describe('recenter', () => {
  // The complaint it answers: closed in on one room of the plan, with nothing
  // on screen saying where the rest of the building went.
  it('puts the whole building back overhead, and flies there', () => {
    session().selectFloor('floor-2')
    session().previewRoom('room-2')

    expect(requests(() => session().recenter())).toBe(1)
    expect(session()).toMatchObject({
      viewMode: 'top',
      pickedView: 'top',
      selectedFloorKey: null,
      previewRoomKey: null,
    })
  })

  // Pressing it on a view that is already centred still has to move: the pose
  // is only the default's if nobody has zoomed or panned since, and the store
  // cannot tell — the camera does not report back.
  it('asks for the flight even when nothing about the subject changed', () => {
    expect(requests(() => session().recenter())).toBe(1)
  })
})

describe('the roof', () => {
  // Nobody presses this any more; the rig writes it off the live tilt. What
  // matters is that it lands without a camera flight — it is reported every
  // frame, and a bump would refly the preset on the frame it crossed.
  it('is reported without asking the camera to move', () => {
    expect(requests(() => session().setRoofShown(true))).toBe(0)
    expect(session().roofShown).toBe(true)
  })
})

describe('rotateView', () => {
  // Sharing `viewRequestId` would re-apply the whole preset, which zeroes the
  // focal offset and dollies back — the visitor's zoom and pan, gone on every
  // press of a button that only means "turn a bit".
  it('does not ask for a preset flight', () => {
    expect(requests(() => session().rotateView(1))).toBe(0)
  })

  it('counts its own requests and remembers the direction', () => {
    const before = session().rotateRequestId
    session().rotateView(-1)
    expect(session().rotateRequestId).toBe(before + 1)
    expect(session().rotateDirection).toBe(-1)
  })

  // The bar keeps naming the preset last picked; a turned camera is not that
  // preset, but it is not a different one either.
  it('leaves the view mode alone', () => {
    session().setViewMode('dollhouse')
    session().rotateView(1)
    expect(session().viewMode).toBe('dollhouse')
  })
})

describe('room preview', () => {
  it('looks straight down at the room and asks for the flight', () => {
    expect(requests(() => session().previewRoom('room-2'))).toBe(1)
    expect(session()).toMatchObject({ previewRoomKey: 'room-2', viewMode: 'top' })
  })

  // Every click on empty ground goes through here, and reframing the camera on
  // each of them would be a jolt with no cause.
  it('costs nothing to clear when nothing is previewed', () => {
    expect(requests(() => session().clearPreview())).toBe(0)
  })

  it('reframes when there was something to clear', () => {
    session().previewRoom('room-2')
    expect(requests(() => session().clearPreview())).toBe(1)
    expect(session().previewRoomKey).toBeNull()
  })

  // A preview is a step towards somewhere, so anything that decides where to
  // look ends it — including picking a view, which is a statement about the
  // building and not about one room.
  it('ends with any other decision about the view', () => {
    for (const act of [
      () => session().focusRoom('room-1'),
      () => session().exitRoomFocus(),
      () => session().setViewMode('dollhouse'),
      () => session().selectFloor('floor-2'),
      () => session().recenter(),
    ]) {
      session().previewRoom('room-2')
      act()
      expect(session().previewRoomKey).toBeNull()
    }
  })
})

describe('reset', () => {
  it('drops every choice the visitor made', () => {
    session().focusRoom('room-1')
    session().setViewMode('dollhouse')
    session().setRoofShown(true)
    session().selectFloor('floor-2')
    session().setInteractionLock(true)
    session().requestMoveTo([1, 2, 3], [0, 0, 0])

    session().reset()

    expect(session()).toMatchObject({
      focusedRoomKey: null,
      viewMode: 'top',
      pickedView: 'top',
      roofShown: false,
      selectedFloorKey: null,
      interactionLock: false,
      moveToTarget: null,
    })
  })

  it('reframes, so the camera does not stay pointed at the last building', () => {
    expect(requests(() => session().reset())).toBe(1)
  })

  // Picking a different size is not a reason to put someone who asked for
  // metres back into feet, so the unit is deliberately outside VISITOR_STATE.
  it('keeps the unit the visitor chose', () => {
    session().setAreaUnit('sqm')
    session().reset()
    expect(session().areaUnitOverride).toBe('sqm')
  })

  // Nor is reading a figure in other units a reason to move the camera.
  it('does not fly the camera to change units', () => {
    expect(requests(() => session().setAreaUnit('sqm'))).toBe(0)
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
