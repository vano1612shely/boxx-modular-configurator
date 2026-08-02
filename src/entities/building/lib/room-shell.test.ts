import { describe, expect, it } from 'vitest'

import type { RoomOpening, RoomShellConfig, RoomVertex, WallSide } from '../model/types'
import {
  autoAssignSides,
  bandsForEdge,
  buildTopology,
  computeSideAxes,
  planOpeningPlacements,
  planRoomShell,
  reanchorOpenings,
  subtractSpans,
  type ShellPart,
} from './room-shell'

function room(points: Array<[number, number]>, sides?: WallSide[]): RoomVertex[] {
  const auto = autoAssignSides(points.map(([x, z]) => ({ x, z })))
  return points.map(([x, z], i) => ({ x, z, side: sides?.[i] ?? auto[i] }))
}

const RECT = room([
  [0, 0],
  [6, 0],
  [6, 4],
  [0, 4],
])

/** L-shape whose "north" wall is a bent run of two edges. */
const L_SHAPE = room([
  [0, 0],
  [6, 0],
  [6, 4],
  [3, 4],
  [3, 8],
  [0, 8],
])

function shellConfig(
  polygon: RoomVertex[],
  overrides: Partial<RoomShellConfig> = {},
): RoomShellConfig {
  return {
    floorY: 0,
    wallHeight: 2.5,
    wallThickness: 0.12,
    floorThickness: 0.12,
    ceilingThickness: 0.1,
    sideAxes: computeSideAxes(polygon),
    sunDirection: null,
    ...overrides,
  }
}

function opening(over: Partial<RoomOpening> = {}): RoomOpening {
  return {
    id: 'o1',
    side: 'w1',
    kind: 'window',
    along: 2,
    width: 1.2,
    height: 1.2,
    sill: 0.9,
    ...over,
  }
}

function triangleCount(part: ShellPart): number {
  return part.positions.length / 9
}

function partArea(part: ShellPart): number {
  let total = 0
  for (let i = 0; i < part.positions.length; i += 9) {
    const ax = part.positions[i]
    const ay = part.positions[i + 1]
    const az = part.positions[i + 2]
    const ux = part.positions[i + 3] - ax
    const uy = part.positions[i + 4] - ay
    const uz = part.positions[i + 5] - az
    const vx = part.positions[i + 6] - ax
    const vy = part.positions[i + 7] - ay
    const vz = part.positions[i + 8] - az
    total += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
  }
  return total
}

function surfaceArea(parts: ShellPart[], surface: string, side?: WallSide): number {
  return parts
    .filter((p) => p.surface === surface && (side === undefined || p.side === side))
    .reduce((sum, p) => sum + partArea(p), 0)
}

/** Every emitted triangle must face the way its normal claims. */
function windingIsConsistent(part: ShellPart): boolean {
  for (let i = 0; i < part.positions.length; i += 9) {
    const ax = part.positions[i]
    const ay = part.positions[i + 1]
    const az = part.positions[i + 2]
    const ux = part.positions[i + 3] - ax
    const uy = part.positions[i + 4] - ay
    const uz = part.positions[i + 5] - az
    const vx = part.positions[i + 6] - ax
    const vy = part.positions[i + 7] - ay
    const vz = part.positions[i + 8] - az
    const cx = uy * vz - uz * vy
    const cy = uz * vx - ux * vz
    const cz = ux * vy - uy * vx
    const dot = cx * part.normals[i] + cy * part.normals[i + 1] + cz * part.normals[i + 2]
    if (dot < 0) return false
  }
  return true
}

describe('autoAssignSides', () => {
  it('groups a rectangle into exactly four walls', () => {
    expect(new Set(autoAssignSides(RECT)).size).toBe(4)
  })

  it('puts both arms of an L-shaped wall on the side they actually face', () => {
    const sides = autoAssignSides(L_SHAPE)
    // Edges 1 and 3 both face +X.
    expect(sides[1]).toBe(sides[3])
  })
})

describe('computeSideAxes', () => {
  it('snaps each wall to the axis it faces', () => {
    const axes = computeSideAxes(RECT)
    for (const axis of Object.values(axes)) {
      expect(Math.abs(axis.x) + Math.abs(axis.z)).toBeCloseTo(1, 9)
    }
  })

  it('keeps a recessed wall facing outward, not back across the room', () => {
    // Two short flanking segments face -Z; the 3 m recess back face points +Z.
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
    expect(computeSideAxes(notched).w1).toEqual({ x: 0, z: -1 })
  })
})

describe('buildTopology', () => {
  it('keeps a wall that wraps the polygon start as one run', () => {
    // Outline starts mid-wall: the first and last edges belong to the same side.
    const wrapped: RoomVertex[] = [
      { x: 3, z: 0, side: 'w1' },
      { x: 6, z: 0, side: 'w2' },
      { x: 6, z: 4, side: 'w3' },
      { x: 0, z: 4, side: 'w4' },
      { x: 0, z: 0, side: 'w1' },
    ]
    const { runs } = buildTopology(wrapped, 0.12)
    const w1 = runs.filter((run) => run.side === 'w1')
    expect(w1).toHaveLength(1)
    expect(w1[0].edges).toHaveLength(2)
  })

  it('shares the mitred corner point between edges of the SAME wall exactly', () => {
    const bent = buildTopology(L_SHAPE, 0.2).runs.find((run) => run.edges.length > 1)!
    for (let i = 0; i + 1 < bent.edges.length; i++) {
      // Exact identity, not approximate: any drift here is a visible seam.
      expect(bent.edges[i].outerB.x).toBe(bent.edges[i + 1].outerA.x)
      expect(bent.edges[i].outerB.z).toBe(bent.edges[i + 1].outerA.z)
    }
  })

  it('starts each wall on a square offset rather than the shared mitre', () => {
    const t = 0.2
    for (const run of buildTopology(RECT, t).runs) {
      const first = run.edges[0]
      expect(first.outerA.x).toBeCloseTo(first.innerA.x + first.normal.x * t, 12)
      expect(first.outerA.z).toBeCloseTo(first.innerA.z + first.normal.z * t, 12)
    }
  })

  it('ends each wall on a square offset too, and leaves a corner to fill', () => {
    const t = 0.2
    for (const run of buildTopology(RECT, t).runs) {
      const last = run.edges[run.edges.length - 1]
      expect(last.outerB.x).toBeCloseTo(last.innerB.x + last.normal.x * t, 12)
      expect(last.outerB.z).toBeCloseTo(last.innerB.z + last.normal.z * t, 12)
      expect(run.corner).not.toBeNull()
    }
  })

  it('spans the corner from one square cut to the other, via the mitre', () => {
    const t = 0.2
    const { runs } = buildTopology(RECT, t)
    const corner = runs.find((run) => run.corner?.v.x === 6 && run.corner.v.z === 0)!.corner!

    expect(corner.fromOuter).toEqual({ x: 6, z: -t })
    expect(corner.miter.x).toBeCloseTo(6 + t, 12)
    expect(corner.miter.z).toBeCloseTo(-t, 12)
    expect(corner.toOuter).toEqual({ x: 6 + t, z: 0 })
  })

  it('leaves a reflex corner alone — both walls already cover it', () => {
    // The wall boundary lands on the concave corner, where the strips overlap.
    const t = 0.2
    const inner: RoomVertex[] = [
      { x: 0, z: 0, side: 'w1' },
      { x: 6, z: 0, side: 'w2' },
      { x: 6, z: 3, side: 'w3' },
      { x: 3, z: 3, side: 'w2' },
      { x: 3, z: 6, side: 'w3' },
      { x: 0, z: 6, side: 'w4' },
    ]
    const { runs } = buildTopology(inner, t)

    expect(runs.find((run) => run.edges[0].index === 2)!.corner).toBeNull()
  })
})

describe('bandsForEdge', () => {
  const edge = buildTopology(RECT, 0.12).runs.flatMap((r) => r.edges)[0]

  it('leaves a plain wall as a single full-height band', () => {
    expect(bandsForEdge(edge, [], 2.5)).toEqual([
      { u0: 0, u1: edge.length, spans: [{ v0: 0, v1: 2.5 }] },
    ])
  })

  it('splits a window into apron and lintel', () => {
    const bands = bandsForEdge(
      edge,
      [{ opening: opening(), edge, local: 2 }],
      2.5,
    )
    const middle = bands.find((band) => band.u0 === 2)!
    expect(middle.spans).toEqual([
      { v0: 0, v1: 0.9 },
      { v0: 2.1, v1: 2.5 },
    ])
  })

  it('gives a floor-level door a lintel only — no apron to fight the floor', () => {
    const bands = bandsForEdge(
      edge,
      [{ opening: opening({ kind: 'door', sill: 0, height: 2.1 }), edge, local: 2 }],
      2.5,
    )
    expect(bands.find((band) => band.u0 === 2)!.spans).toEqual([{ v0: 2.1, v1: 2.5 }])
  })
})

describe('subtractSpans', () => {
  it('reports the exposed jamb between a solid wall and an opening', () => {
    expect(
      subtractSpans(
        [{ v0: 0, v1: 2.5 }],
        [
          { v0: 0, v1: 0.9 },
          { v0: 2.1, v1: 2.5 },
        ],
      ),
    ).toEqual([{ v0: 0.9, v1: 2.1 }])
  })

  it('is empty where coverage matches, so flat walls grow no internal faces', () => {
    expect(subtractSpans([{ v0: 0, v1: 2.5 }], [{ v0: 0, v1: 2.5 }])).toEqual([])
  })
})

describe('planRoomShell', () => {
  it('rejects a degenerate outline instead of emitting garbage', () => {
    expect(planRoomShell(RECT.slice(0, 2), shellConfig(RECT), [])).toEqual({
      parts: [],
      warnings: [{ code: 'degenerate-polygon' }],
    })
  })

  it('emits every wall surface with consistent winding', () => {
    const { parts } = planRoomShell(RECT, shellConfig(RECT), [])
    expect(parts.length).toBeGreaterThan(0)
    for (const part of parts) expect(windingIsConsistent(part)).toBe(true)
  })

  it('produces one group per wall side plus side-less slabs', () => {
    const { parts } = planRoomShell(RECT, shellConfig(RECT), [])
    expect(new Set(parts.filter((p) => p.side).map((p) => p.side)).size).toBe(4)
    expect(parts.some((p) => p.side === null && p.surface === 'floor')).toBe(true)
    expect(parts.some((p) => p.side === null && p.surface === 'ceiling')).toBe(true)
  })

  it('removes exactly the opening area from the wall faces', () => {
    const config = shellConfig(RECT)
    const side = RECT[0].side
    const solid = planRoomShell(RECT, config, [])
    const holed = planRoomShell(RECT, config, [opening({ side })])

    const removed =
      surfaceArea(solid.parts, 'wallInner', side) - surfaceArea(holed.parts, 'wallInner', side)
    expect(removed).toBeCloseTo(1.2 * 1.2, 6)
  })

  it('closes an opening with jamb, sill and soffit faces', () => {
    const config = shellConfig(RECT)
    const side = RECT[0].side
    const solid = planRoomShell(RECT, config, [])
    const holed = planRoomShell(RECT, config, [opening({ side })])

    // Reveal faces are added, not removed: 2 jambs + sill + soffit.
    const added =
      surfaceArea(holed.parts, 'wallEdge', side) - surfaceArea(solid.parts, 'wallEdge', side)
    const reveal = 2 * 1.2 * config.wallThickness + 2 * 1.2 * config.wallThickness
    expect(added).toBeCloseTo(reveal, 6)
  })

  it('emits a leaf panel for each opening, on the opening’s own side', () => {
    const side = RECT[0].side
    const { parts } = planRoomShell(RECT, shellConfig(RECT), [
      opening({ side, kind: 'door', sill: 0, height: 2.1, width: 0.9 }),
    ])
    const leaf = parts.find((p) => p.surface === 'door')!
    expect(leaf.side).toBe(side)
    // Two quads back to back so the leaf reads from both sides.
    expect(triangleCount(leaf)).toBe(4)
  })

  it('keeps the floor top exactly at floorY — the plane furniture stands on', () => {
    const config = shellConfig(RECT, { floorY: 0.03 })
    const floor = planRoomShell(RECT, config, []).parts.find((p) => p.surface === 'floor')!

    let top = -Infinity
    for (let i = 1; i < floor.positions.length; i += 3) top = Math.max(top, floor.positions[i])
    expect(top).toBeCloseTo(0.03, 6)
  })

  it('puts the ceiling at the room’s own wall height', () => {
    const config = shellConfig(RECT, { floorY: 0.03, wallHeight: 2.5 })
    const ceiling = planRoomShell(RECT, config, []).parts.find((p) => p.surface === 'ceiling')!

    let bottom = Infinity
    for (let i = 1; i < ceiling.positions.length; i += 3) {
      bottom = Math.min(bottom, ceiling.positions[i])
    }
    expect(bottom).toBeCloseTo(2.53, 6)
  })

  it('drops an opening too wide for its wall instead of silently sealing it', () => {
    const side = L_SHAPE[1].side
    const { warnings } = planRoomShell(L_SHAPE, shellConfig(L_SHAPE), [
      opening({ side, along: 0, width: 99 }),
    ])
    expect(warnings).toContainEqual({ code: 'opening-dropped', openingId: 'o1' })
  })

  it('slides an overhanging opening back onto its wall and says so', () => {
    const side = RECT[0].side
    const { warnings, parts } = planRoomShell(RECT, shellConfig(RECT), [
      opening({ side, along: 5.8, width: 1.2 }),
    ])
    expect(warnings).toContainEqual({ code: 'opening-clamped', openingId: 'o1' })
    expect(surfaceArea(parts, 'wallInner', side)).toBeCloseTo(6 * 2.5 - 1.2 * 1.2, 6)
  })

  it('drops the second of two overlapping openings', () => {
    const side = RECT[0].side
    const { warnings } = planRoomShell(RECT, shellConfig(RECT), [
      opening({ id: 'a', side, along: 1, width: 1.4 }),
      opening({ id: 'b', side, along: 2, width: 1 }),
    ])
    expect(warnings).toContainEqual({ code: 'opening-dropped', openingId: 'b' })
  })

  it('handles a wall bent across several edges as one continuous run', () => {
    const { parts, warnings } = planRoomShell(L_SHAPE, shellConfig(L_SHAPE), [])
    expect(warnings.filter((w) => w.code === 'degenerate-polygon')).toHaveLength(0)
    for (const part of parts) expect(windingIsConsistent(part)).toBe(true)
  })

  it('cuts every wall end square — no diagonal face anywhere on a box room', () => {
    const { parts } = planRoomShell(RECT, shellConfig(RECT, { wallThickness: 0.2 }), [])

    for (const part of parts) {
      for (let i = 0; i < part.positions.length; i += 9) {
        // Horizontal caps legitimately span both axes.
        if (Math.abs(part.normals[i + 1]) > 0.5) continue
        const xs = [part.positions[i], part.positions[i + 3], part.positions[i + 6]]
        const zs = [part.positions[i + 2], part.positions[i + 5], part.positions[i + 8]]
        const spanX = Math.max(...xs) - Math.min(...xs)
        const spanZ = Math.max(...zs) - Math.min(...zs)
        expect(Math.min(spanX, spanZ)).toBeLessThan(1e-6)
      }
    }
  })

  it('stops each wall face exactly on its own outline', () => {
    const { parts } = planRoomShell(RECT, shellConfig(RECT), [])

    // 4 digits, not 6: positions are Float32, and 50 m² exhausts the mantissa.
    expect(surfaceArea(parts, 'wallInner')).toBeCloseTo(20 * 2.5, 4)
  })

  it('puts the corner in BOTH walls, so it stands when either one hides', () => {
    const t = 0.12
    const { parts } = planRoomShell(RECT, shellConfig(RECT, { wallThickness: t }), [])

    // Outside corner above the (6,0) vertex — only the corner piece reaches it.
    const holders = new Set<string>()
    for (const part of parts) {
      if (part.side === null) continue
      for (let i = 0; i < part.positions.length; i += 3) {
        const onCorner =
          Math.abs(part.positions[i] - (6 + t)) < 1e-5 &&
          Math.abs(part.positions[i + 2] + t) < 1e-5
        if (onCorner) holders.add(part.group)
      }
    }

    expect(holders.size).toBe(2)
  })

  it('makes the two copies of a corner identical, so they cannot z-fight', () => {
    const t = 0.12
    const { parts } = planRoomShell(RECT, shellConfig(RECT, { wallThickness: t }), [])

    /** Triangles reaching the outside point of the (6,0) corner. */
    const cornerTriangles = (group: string) => {
      const found: string[] = []
      for (const part of parts.filter((p) => p.group === group)) {
        for (let i = 0; i < part.positions.length; i += 9) {
          const tri = [...part.positions.slice(i, i + 9)]
          const touches = [0, 3, 6].some(
            (v) => Math.abs(tri[v] - (6 + t)) < 1e-5 && Math.abs(tri[v + 2] + t) < 1e-5,
          )
          if (touches) found.push(tri.map((n) => n.toFixed(5)).join(','))
        }
      }
      return found.sort()
    }

    const ending = cornerTriangles(RECT[0].side)
    // Equal vertices rasterise to equal depth, and the depth test passes on equality.
    expect(ending.length).toBeGreaterThan(0)
    expect(ending).toEqual(cornerTriangles(RECT[1].side))
  })

  it('stops the floor material at the walls, not at the slab edge', () => {
    const floor = planRoomShell(RECT, shellConfig(RECT), []).parts.find(
      (p) => p.group === 'floor' && p.surface === 'floor',
    )!
    // The slab itself reaches 12 cm further on every side, under the walls.
    expect(partArea(floor)).toBeCloseTo(6 * 4, 4)
  })

  it('trims the band the walls stand on, so a hidden wall leaves white behind', () => {
    const { parts } = planRoomShell(RECT, shellConfig(RECT), [])
    const trim = parts
      .filter((p) => p.group === 'floor' && p.surface === 'wallEdge')
      .reduce((sum, p) => sum + partArea(p), 0)

    const outer = (6 + 0.24) * (4 + 0.24)
    const band = outer - 6 * 4
    const rim = 2 * (6 + 0.24 + 4 + 0.24) * 0.12

    // Band on top, the whole underside, and the rim around the edge.
    expect(trim).toBeCloseTo(band + outer + rim, 3)
  })

  it('gives the ceiling its own trim, so the white lip leaves with it', () => {
    const { parts } = planRoomShell(RECT, shellConfig(RECT), [])
    const trims = parts.filter((p) => p.surface === 'wallEdge' && p.side === null)

    expect(trims.map((p) => p.group).sort()).toEqual(['ceiling', 'floor'])
  })

  it('warns when a corner is too sharp to carry the wall thickness', () => {
    const spike = room([
      [0, 0],
      [6, 0],
      [6, 4],
      [3.05, 0.2],
      [0, 4],
    ])
    const { warnings } = planRoomShell(spike, shellConfig(spike, { wallThickness: 0.4 }), [])
    expect(warnings.some((w) => w.code === 'thickness-clamped')).toBe(true)
  })
})

describe('reanchorOpenings', () => {
  it('keeps an opening at the same world position when a vertex moves', () => {
    const side = RECT[0].side
    const before = RECT
    const after: RoomVertex[] = [
      { x: 0, z: 0, side: before[0].side },
      { x: 9, z: 0, side: before[1].side },
      { x: 9, z: 4, side: before[2].side },
      { x: 0, z: 4, side: before[3].side },
    ]

    const [moved] = reanchorOpenings(before, after, [opening({ side, along: 2 })])
    // The wall grew from the far end, so a door 2m from the start stays 2m in.
    expect(moved.along).toBeCloseTo(2, 6)
  })

  it('keeps world position when the wall start itself moves', () => {
    const side = RECT[0].side
    const after: RoomVertex[] = [
      { x: -2, z: 0, side: RECT[0].side },
      { x: 6, z: 0, side: RECT[1].side },
      { x: 6, z: 4, side: RECT[2].side },
      { x: -2, z: 4, side: RECT[3].side },
    ]

    const [moved] = reanchorOpenings(RECT, after, [opening({ side, along: 2 })])
    // The wall start slid 2m west, so the same point is now 4m along it.
    expect(moved.along).toBeCloseTo(4, 6)
  })
})

describe('autoAssignSides — recesses stay part of their wall', () => {
  it('keeps a small notch on the wall it is cut into', () => {
    // 6x6 room with a 1x1 notch in the bottom-right corner; its returns face ±X.
    const notched = [
      { x: 0, z: 0 },
      { x: 5, z: 0 },
      { x: 5, z: 1 },
      { x: 6, z: 1 },
      { x: 6, z: 6 },
      { x: 0, z: 6 },
    ]
    const sides = autoAssignSides(notched)

    // Edges 0..2 are the bottom wall with its notch — one wall, not three.
    expect(sides[0]).toBe(sides[1])
    expect(sides[1]).toBe(sides[2])
    expect(new Set(sides).size).toBe(4)
  })

  it('leaves a plain rectangle with one wall per edge', () => {
    expect(new Set(autoAssignSides(RECT)).size).toBe(4)
    expect(autoAssignSides(RECT)).toHaveLength(4)
  })

  it('never emits more than four walls', () => {
    const stepped = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 0.4 },
      { x: 4, z: 0.4 },
      { x: 4, z: 0.8 },
      { x: 6, z: 0.8 },
      { x: 6, z: 5 },
      { x: 0, z: 5 },
    ]
    expect(new Set(autoAssignSides(stepped)).size).toBeLessThanOrEqual(4)
  })

  it('groups every notch edge into one contiguous run per wall', () => {
    const notched = [
      { x: 0, z: 0 },
      { x: 5, z: 0 },
      { x: 5, z: 1 },
      { x: 6, z: 1 },
      { x: 6, z: 6 },
      { x: 0, z: 6 },
    ]
    const polygon = notched.map((p, i) => ({ ...p, side: autoAssignSides(notched)[i] }))
    const { runs } = buildTopology(polygon, 0.12)

    expect(runs).toHaveLength(4)
  })
})

describe('planOpeningPlacements', () => {
  const side = RECT[0].side
  const config = shellConfig(RECT)

  it('centres the model in the hole the shell cut for it', () => {
    const [placement] = planOpeningPlacements(RECT, config, [
      opening({ side, along: 2, width: 1.2, height: 1.2, sill: 0.9 }),
    ])

    // Half a width along, half a height up from the sill, half a thickness in.
    expect(placement.center.x).toBeCloseTo(2.6, 6)
    expect(placement.center.y).toBeCloseTo(1.5, 6)
    expect(placement.center.z).toBeCloseTo(-0.06, 6)
  })

  it('faces the model along the wall it is set into', () => {
    const [placement] = planOpeningPlacements(RECT, config, [opening({ side })])

    expect(placement.side).toBe(side)
    expect(placement.normal.x).toBeCloseTo(0, 6)
    expect(placement.normal.z).toBeCloseTo(-1, 6)
    expect(Math.hypot(placement.normal.x, placement.normal.z)).toBeCloseTo(1, 6)
  })

  it('follows an opening that was slid back onto its wall', () => {
    const [placement] = planOpeningPlacements(RECT, config, [
      opening({ side, along: 5.5, width: 1.2 }),
    ])

    expect(placement.center.x).toBeCloseTo(6 - 1.2 / 2, 6)
  })

  it('places nothing where the shell placed no hole', () => {
    expect(planOpeningPlacements(RECT, config, [opening({ side, width: 99 })])).toEqual([])
    expect(planOpeningPlacements(RECT.slice(0, 2), config, [opening({ side })])).toEqual([])
  })

  it('agrees with the wall group the shell put the opening in', () => {
    const openings = [
      opening({ id: 'a', side: RECT[0].side, kind: 'door', sill: 0, height: 2.1, width: 0.9 }),
      opening({ id: 'b', side: RECT[1].side, along: 1, width: 1.2 }),
    ]
    const { parts } = planRoomShell(RECT, config, openings)
    const placements = planOpeningPlacements(RECT, config, openings)

    for (const placement of placements) {
      const leaf = parts.find(
        (part) => part.surface === placement.opening.kind && part.side === placement.side,
      )
      expect(leaf).toBeDefined()
    }
  })

  it('rides the floor level, so a raised room does not leave doors underground', () => {
    const raised = shellConfig(RECT, { floorY: 2.4 })
    const [door] = planOpeningPlacements(RECT, raised, [
      opening({ side, kind: 'door', sill: 0, height: 2.1 }),
    ])

    expect(door.center.y).toBeCloseTo(2.4 + 1.05, 6)
  })
})

describe('planRoomShell — openings backed by a model', () => {
  const side = RECT[0].side
  const config = shellConfig(RECT)
  const door = opening({ id: 'd', side, kind: 'door', sill: 0, height: 2.1, width: 0.9 })
  const window = opening({ id: 'w', side, along: 3, width: 1.2 })

  it('drops the flat leaf for a kind a model stands in for', () => {
    const { parts } = planRoomShell(RECT, config, [door, window], undefined, {
      modelledKinds: new Set(['door' as const]),
    })

    expect(parts.some((part) => part.surface === 'door')).toBe(false)
    expect(parts.some((part) => part.surface === 'window')).toBe(true)
  })

  it('still cuts the hole, jambs and all', () => {
    const solid = planRoomShell(RECT, config, [])
    const modelled = planRoomShell(RECT, config, [door], undefined, {
      modelledKinds: new Set(['door' as const]),
    })

    const removed =
      surfaceArea(solid.parts, 'wallInner', side) - surfaceArea(modelled.parts, 'wallInner', side)
    expect(removed).toBeCloseTo(0.9 * 2.1, 4)
    expect(surfaceArea(modelled.parts, 'wallEdge', side)).toBeGreaterThan(
      surfaceArea(solid.parts, 'wallEdge', side),
    )
  })
})
