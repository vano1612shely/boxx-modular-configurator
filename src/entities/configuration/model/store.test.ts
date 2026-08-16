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
