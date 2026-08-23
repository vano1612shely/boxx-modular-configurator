import { beforeEach, describe, expect, it } from 'vitest'

import { useConfiguration } from './store'

function config() {
  return useConfiguration.getState()
}

function place() {
  return config().addPackage({ packageId: 1, roomKey: 'office-1', x: 0, z: 0, rotationYDeg: 0 })
}

beforeEach(() => {
  config().clear()
})

describe('opening a building', () => {
  /**
   * The complaint: furnish the eight-office model, go back to the quiz, ask for
   * one office. The two models share room keys, so the furniture did not vanish
   * — it found a room of the same name in a building of another shape and hung
   * in the air where the old room had been.
   */
  it('empties a configuration that was chosen for another building', () => {
    config().adoptBuilding(8)
    place()
    config().setExteriorVariant('entrance-1', 'v2')

    config().adoptBuilding(9)

    expect(config().placed).toEqual([])
    expect(config().exterior).toEqual({})
    expect(config().buildingId).toBe(9)
  })

  // Resolving the same building again — a reload, a re-render, coming back from
  // a room — must not throw away what the visitor has done.
  it('keeps everything when the same building is opened again', () => {
    config().adoptBuilding(8)
    const instanceId = place()

    config().adoptBuilding(8)

    expect(config().placed.map((p) => p.instanceId)).toEqual([instanceId])
  })

  it('drops a selection and a drag along with the furniture', () => {
    config().adoptBuilding(8)
    const instanceId = place()
    config().startDrag(instanceId)
    config().setDragPose({ instanceId, x: 1, z: 1, rotationYDeg: 0 })

    config().adoptBuilding(9)

    expect(config()).toMatchObject({
      selectedInstanceId: null,
      draggingInstanceId: null,
      dragPose: null,
    })
  })
})

describe('dragging a piece', () => {
  /**
   * The whole reason the live pose is not in `placed`.
   *
   * A pointer move used to rewrite the configuration, and everything reading it
   * — the furniture panel, the quote, the view bar — re-rendered for each one.
   * Identity is the assertion because identity is what React compares.
   */
  it('leaves the configuration untouched while the piece is in the air', () => {
    const instanceId = place()
    const before = config().placed

    config().startDrag(instanceId)
    config().setDragPose({ instanceId, x: 1, z: 2, rotationYDeg: 30 })
    config().setDragPose({ instanceId, x: 3, z: 4, rotationYDeg: 45 })

    expect(config().placed).toBe(before)
    expect(config().dragPose).toEqual({ instanceId, x: 3, z: 4, rotationYDeg: 45 })
  })

  it('writes it once, when the piece is put down', () => {
    const instanceId = place()
    config().startDrag(instanceId)
    config().setDragPose({ instanceId, x: 3, z: 4, rotationYDeg: 45 })
    config().dropDrag({ x: 3, z: 4, rotationYDeg: 45 })

    expect(config().placed[0]).toMatchObject({ instanceId, x: 3, z: 4, rotationYDeg: 45 })
    expect(config()).toMatchObject({ draggingInstanceId: null, dragPose: null, dragValid: true })
  })

  // A drop with nowhere legal to land: the piece goes back to where it was, and
  // the configuration must not be rewritten to say the same thing.
  it('puts an unplaceable piece back without touching the configuration', () => {
    const instanceId = place()
    const before = config().placed

    config().startDrag(instanceId)
    config().setDragPose({ instanceId, x: 9, z: 9, rotationYDeg: 0 })
    config().dropDrag(null)

    expect(config().placed).toBe(before)
    expect(config().draggingInstanceId).toBeNull()
  })

  // Grabbing a second piece must not land the first one's pose on it.
  it('drops the pose of the piece let go of', () => {
    const first = place()
    config().startDrag(first)
    config().setDragPose({ instanceId: first, x: 5, z: 5, rotationYDeg: 0 })

    const second = place()
    config().startDrag(second)

    expect(config().dragPose).toBeNull()
  })
})

describe('opening a saved order', () => {
  const SAVED = {
    buildingId: 8,
    placed: [
      { instanceId: 'order-0', packageId: 1, roomKey: 'office-1', x: 1, z: 2, rotationYDeg: 90 },
    ],
    exterior: { 'entrance-1': 'ramp' },
  }

  it('replaces whatever was there rather than adding to it', () => {
    config().adoptBuilding(9)
    place()
    config().setExteriorVariant('entrance-1', 'steps')

    config().hydrate(SAVED)

    expect(config().buildingId).toBe(8)
    expect(config().placed).toEqual(SAVED.placed)
    expect(config().exterior).toEqual({ 'entrance-1': 'ramp' })
  })

  // On a page that cannot be edited, a selection would draw an outline and a
  // toolbar around a piece nobody picked.
  it('leaves nothing selected and nothing in the air', () => {
    config().hydrate(SAVED)

    expect(config()).toMatchObject({
      selectedInstanceId: null,
      draggingInstanceId: null,
      dragPose: null,
      dragValid: true,
    })
  })

  /**
   * The complaint this guards against: furnish a building, send the request,
   * follow the link on the thank-you page into the 3D view of the order, press
   * Back — and find the building empty.
   *
   * The order page and the configurator share this store, and /order is a
   * client-side navigation away from /configurator, so a visitor can be looking
   * at a saved order with a session still in progress underneath. Emptying the
   * store on the way out is what loses it; the order is laid over what was
   * there and lifted off again instead.
   */
  it('gives back the configuration it was laid over', () => {
    config().adoptBuilding(9)
    const instanceId = place()
    config().setExteriorVariant('entrance-1', 'steps')

    const displaced = {
      buildingId: config().buildingId,
      placed: config().placed,
      exterior: config().exterior,
    }

    config().hydrate(SAVED)
    config().hydrate(displaced)

    expect(config().buildingId).toBe(9)
    expect(config().placed.map((p) => p.instanceId)).toEqual([instanceId])
    expect(config().exterior).toEqual({ 'entrance-1': 'steps' })
  })

  // Nothing configured yet is a configuration too, and putting it back must not
  // leave the order's building behind for the configurator's guard to find.
  it('gives back an empty store as empty, with no building open', () => {
    const displaced = { buildingId: null, placed: [], exterior: {} }

    config().hydrate(SAVED)
    config().hydrate(displaced)

    expect(config().buildingId).toBeNull()
    expect(config().placed).toEqual([])
  })
})

describe('a fitted arrangement', () => {
  function pin() {
    return config().addPackage({
      packageId: 7,
      roomKey: 'kitchen-1',
      x: 2,
      z: 3,
      rotationYDeg: 0,
      pinned: true,
    })
  }

  const placedAt = (instanceId: string) =>
    config().placed.find((p) => p.instanceId === instanceId)

  /**
   * Selection raises a floating toolbar offering to turn and remove the piece.
   * A kitchen is exactly the thing that does not turn, and landing on it with
   * the toolbar already up would offer the one action it refuses.
   */
  it('is not selected when it is put in', () => {
    pin()
    expect(config().selectedInstanceId).toBeNull()
  })

  it('cannot be moved', () => {
    const id = pin()
    config().movePackage(id, 9, 9)
    expect(placedAt(id)).toMatchObject({ x: 2, z: 3 })
  })

  it('cannot be turned', () => {
    const id = pin()
    config().rotatePackage(id, 90)
    expect(placedAt(id)?.rotationYDeg).toBe(0)
  })

  it('cannot be picked up', () => {
    const id = pin()
    config().startDrag(id)
    expect(config().draggingInstanceId).toBeNull()
  })

  // The panel lists it beside the chairs, and the row is a label rather than a
  // button. This is the guard behind that, for every other way in.
  it('cannot be selected', () => {
    const id = pin()
    config().selectPackage(id)
    expect(config().selectedInstanceId).toBeNull()
  })

  // Not a general refusal: clearing the selection while a kitchen stands has to
  // keep working, or the scene could never let go of an ordinary piece again.
  it('does not stop anything else being selected or dropped', () => {
    pin()
    const chair = place()
    expect(config().selectedInstanceId).toBe(chair)

    config().selectPackage(null)
    expect(config().selectedInstanceId).toBeNull()
  })

  it('is removed like anything else', () => {
    const id = pin()
    config().removePackage(id)
    expect(config().placed).toHaveLength(0)
  })
})
