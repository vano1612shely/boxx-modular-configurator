import { describe, expect, it } from 'vitest'

import type { RoomShellConfig, RoomVertex, WallSide } from '../model/types'
import { autoAssignSides, computeSideAxes } from './room-shell'
import { resolveRoomVisibility } from './room-visibility'

function room(points: Array<[number, number]>, sides?: WallSide[]): RoomVertex[] {
  const auto = autoAssignSides(points.map(([x, z]) => ({ x, z })))
  return points.map(([x, z], i) => ({ x, z, side: sides?.[i] ?? auto[i] }))
}

function shellFor(polygon: RoomVertex[]): RoomShellConfig {
  return {
    floorY: 0,
    wallHeight: 2.5,
    wallThickness: 0.12,
    floorThickness: 0.12,
    ceilingThickness: 0.1,
    sideAxes: computeSideAxes(polygon),
      sunDirection: null,
  }
}

/** 6 x 4 room centred on the origin. */
const RECT = room([
  [-3, -2],
  [3, -2],
  [3, 2],
  [-3, 2],
])

/** Side facing -Z / +X / +Z / -X, whatever auto-assign called them. */
const sideFacing = (polygon: RoomVertex[], x: number, z: number): WallSide => {
  const axes = computeSideAxes(polygon)
  return (Object.keys(axes) as WallSide[]).find(
    (side) => axes[side].x === x && axes[side].z === z,
  )!
}

describe('resolveRoomVisibility', () => {
  const shell = shellFor(RECT)

  it('hides the wall standing between the camera and the room', () => {
    const south = sideFacing(RECT, 0, 1)
    const { hiddenSides } = resolveRoomVisibility(RECT, shell, { x: 0, y: 1.5, z: 20 })

    expect(hiddenSides).toContain(south)
    expect(hiddenSides).not.toContain(sideFacing(RECT, 0, -1))
  })

  it('hides both near walls from a corner view', () => {
    const { hiddenSides } = resolveRoomVisibility(RECT, shell, { x: 20, y: 1.5, z: 20 })

    expect(hiddenSides).toHaveLength(2)
    expect(hiddenSides).toContain(sideFacing(RECT, 0, 1))
    expect(hiddenSides).toContain(sideFacing(RECT, 1, 0))
  })

  it('never strips the room down to a single wall', () => {
    for (let angle = 0; angle < 360; angle += 15) {
      const radians = (angle * Math.PI) / 180
      const { hiddenSides } = resolveRoomVisibility(RECT, shell, {
        x: Math.cos(radians) * 20,
        y: 1.5,
        z: Math.sin(radians) * 20,
      })
      expect(hiddenSides.length).toBeLessThanOrEqual(2)
    }
  })

  it('keeps every wall and the ceiling while the camera is inside', () => {
    const inside = resolveRoomVisibility(RECT, shell, { x: 0, y: 1.5, z: 0 })

    expect(inside.hiddenSides).toEqual([])
    expect(inside.ceilingHidden).toBe(false)
  })

  it('drops a wall the moment the camera clears its plane, not its floor', () => {
    // The headline rule. This camera is almost exactly edge-on to the south
    // wall — it covers none of the floor and is barely turned towards the
    // viewer — but the camera IS behind it, so its outside is in view.
    const south = sideFacing(RECT, 0, 1)
    // South wall inner face at z = 2, outer face a thickness beyond it.
    const outer = 2 + shell.wallThickness

    const behind = resolveRoomVisibility(RECT, shell, { x: 60, y: 1.5, z: outer + 0.01 })
    const infront = resolveRoomVisibility(RECT, shell, { x: 60, y: 1.5, z: outer - 0.01 })

    expect(behind.hiddenSides).toContain(south)
    expect(infront.hiddenSides).not.toContain(south)
  })

  it('does not flip a wall back and forth while the camera sits on its plane', () => {
    // Parked exactly on the plane: whichever state it was in must survive, or
    // the wall strobes through every camera animation.
    const south = sideFacing(RECT, 0, 1)
    const onPlane = { x: 0, y: 1.5, z: 2 + shell.wallThickness }

    expect(resolveRoomVisibility(RECT, shell, onPlane, [south]).hiddenSides).toContain(south)
    expect(resolveRoomVisibility(RECT, shell, onPlane, []).hiddenSides).not.toContain(south)
  })

  it('hides a recessed wall from the side it actually faces', () => {
    // The classic failure of a geometry-derived facing test: this "north" wall
    // is mostly a 3m recess whose back face points +Z, so a length-weighted
    // mean normal would hide it when the camera is SOUTH — backwards.
    const notched = room(
      [
        [0, 0],
        [0.5, 0],
        [0.5, 3],
        [3.5, 3],
        [3.5, 0],
        [4, 0],
        [4, 6],
        [0, 6],
      ],
      ['w1', 'w1', 'w1', 'w1', 'w1', 'w2', 'w3', 'w4'],
    )
    const config = shellFor(notched)

    const fromNorth = resolveRoomVisibility(notched, config, { x: 2, y: 1.5, z: -20 })
    const fromSouth = resolveRoomVisibility(notched, config, { x: 2, y: 1.5, z: 20 })

    expect(fromNorth.hiddenSides).toContain('w1')
    expect(fromSouth.hiddenSides).not.toContain('w1')
  })

  it('ignores sides the outline does not actually use', () => {
    const triangle = room([
      [0, 0],
      [6, 0],
      [0, 6],
    ])
    const { hiddenSides } = resolveRoomVisibility(triangle, shellFor(triangle), { x: 3, y: 1.5, z: -20 })

    const used = new Set(triangle.map((vertex) => vertex.side))
    for (const side of hiddenSides) expect(used.has(side)).toBe(true)
  })
})

describe('resolveRoomVisibility — the ceiling only blocks from above', () => {
  const shell = shellFor(RECT)

  it('lifts the ceiling in top view, where the camera is over the footprint', () => {
    // Straight down the middle: inside the outline in XZ, but far above the
    // room. Judging "inside" by footprint alone left the lid on and the top
    // view showed nothing but ceiling.
    const top = resolveRoomVisibility(RECT, shell, { x: 0, y: 12, z: 0.5 })

    expect(top.ceilingHidden).toBe(true)
    expect(top.hiddenSides).toEqual([])
  })

  it('keeps the ceiling while the camera is under it, inside or out', () => {
    expect(resolveRoomVisibility(RECT, shell, { x: 0, y: 1.5, z: 0 }).ceilingHidden).toBe(false)
    expect(resolveRoomVisibility(RECT, shell, { x: 0, y: 1.5, z: 20 }).ceilingHidden).toBe(false)
  })

  it('lifts it as soon as the camera clears the top of the slab', () => {
    // Same rule as the walls: the outside of the ceiling is the top of it, so
    // the line is the wall height PLUS the slab, not the wall height.
    const outer = shell.floorY + shell.wallHeight + shell.ceilingThickness

    expect(
      resolveRoomVisibility(RECT, shell, { x: 0, y: outer - 0.01, z: 20 }).ceilingHidden,
    ).toBe(false)
    expect(
      resolveRoomVisibility(RECT, shell, { x: 0, y: outer + 0.01, z: 20 }).ceilingHidden,
    ).toBe(true)
  })
})
