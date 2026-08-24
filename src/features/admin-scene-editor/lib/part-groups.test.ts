import type { RoomPart } from '@/entities/building'
import { describe, expect, it } from 'vitest'

import {
  expandSelection,
  freeGroupKey,
  groupMates,
  normaliseYaw,
  partRows,
  rotatedAround,
  selectionCentre,
  shortestTurn,
} from './part-groups'

function part(
  key: string,
  name: string,
  x = 0,
  z = 0,
  groupKey: string | null = null,
  y = 0,
): RoomPart {
  return {
    key,
    source: 'model',
    nodePath: null,
    modelUrl: '/kitchen.glb',
    name,
    groupKey,
    position: [x, y, z],
    yawDeg: 0,
    scale: 1,
  }
}

const cooler = [
  part('part-1', 'Cooler_Base', 1, 0, 'group-1'),
  part('part-2', 'Cooler_Bottle', 1, 0, 'group-1', 1.2),
  part('part-3', 'Cooler_Lever', 1.1, 0.1, 'group-1', 0.9),
  part('part-4', 'Dorm_Fridge_01', 4, 0),
]

describe('groupMates', () => {
  it('takes the whole group when one member is named', () => {
    expect(groupMates(cooler, 'part-2')).toEqual(['part-1', 'part-2', 'part-3'])
  })

  it('takes only itself when it belongs to no group', () => {
    expect(groupMates(cooler, 'part-4')).toEqual(['part-4'])
  })

  it('answers nothing for a part that is gone', () => {
    expect(groupMates(cooler, 'part-9')).toEqual([])
  })
})

describe('expandSelection', () => {
  it('grows a selection to whole groups, in list order, without repeats', () => {
    expect(expandSelection(cooler, ['part-4', 'part-3'])).toEqual([
      'part-1',
      'part-2',
      'part-3',
      'part-4',
    ])
  })

  it('leaves an empty selection empty', () => {
    expect(expandSelection(cooler, [])).toEqual([])
  })
})

describe('partRows', () => {
  it('shows a group as one row named after its first member', () => {
    const rows = partRows(cooler)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      id: 'group-1',
      label: 'Cooler_Base',
      keys: ['part-1', 'part-2', 'part-3'],
      grouped: true,
    })
    expect(rows[1].grouped).toBe(false)
  })
})

describe('freeGroupKey', () => {
  it('avoids a key already in use', () => {
    expect(freeGroupKey(cooler)).toBe('group-2')
  })

  it('starts at one for a list with no groups', () => {
    expect(freeGroupKey([part('part-1', 'a')])).toBe('group-1')
  })
})

describe('selectionCentre', () => {
  it('takes the middle of the box, not the average of the parts', () => {
    // Three parts bunched at x=0 and one out at x=4: the average would sit at 1.
    const parts = [
      part('a', 'a', 0, 0),
      part('b', 'b', 0, 0),
      part('c', 'c', 0, 0),
      part('d', 'd', 4, 0),
    ]

    expect(selectionCentre(parts, ['a', 'b', 'c', 'd'])?.x).toBeCloseTo(2)
  })

  it('stands the group on its lowest piece', () => {
    expect(selectionCentre(cooler, ['part-1', 'part-2', 'part-3'])?.y).toBeCloseTo(0)
  })

  it('is nothing when nothing is selected', () => {
    expect(selectionCentre(cooler, [])).toBeNull()
  })

  /**
   * A built-in counter carries no position — it stands where the building has
   * it. Counting its (0, 0, 0) would drag the handles of whatever it is merged
   * with into the corner of the room.
   */
  it('ignores pieces of the building when anything placed is selected', () => {
    const nodePart: RoomPart = {
      key: 'node-1',
      source: 'node',
      nodePath: '47/0',
      modelUrl: null,
      name: 'kitchen',
      groupKey: null,
      position: [0, 0, 0],
      yawDeg: 0,
      scale: 1,
    }
    const parts = [nodePart, part('a', 'a', 6, 6)]

    expect(selectionCentre(parts, ['node-1', 'a'])?.x).toBeCloseTo(6)
    expect(selectionCentre(parts, ['node-1', 'a'])?.z).toBeCloseTo(6)
  })

  it('still answers for a selection of nothing but building pieces', () => {
    const nodePart: RoomPart = {
      key: 'node-1',
      source: 'node',
      nodePath: '47/0',
      modelUrl: null,
      name: 'kitchen',
      groupKey: null,
      position: [0, 0, 0],
      yawDeg: 0,
      scale: 1,
    }

    expect(selectionCentre([nodePart], ['node-1'])).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('shortestTurn', () => {
  it('is the plain difference within one lap', () => {
    expect(shortestTurn(10, 45)).toBeCloseTo(35)
    expect(shortestTurn(45, 10)).toBeCloseTo(-35)
  })

  /**
   * The ring reports an angle already folded into [0, 360). Subtracting the
   * stored facing across zero gave −340 instead of +20, and a group asked to
   * turn −340 about its own middle swings right round the wrong way — every
   * frame of the drag.
   */
  it('takes the short way across zero rather than the long way round', () => {
    expect(shortestTurn(350, 10)).toBeCloseTo(20)
    expect(shortestTurn(10, 350)).toBeCloseTo(-20)
  })

  it('is nothing when the facing has not changed', () => {
    expect(shortestTurn(123, 123)).toBe(0)
    expect(shortestTurn(0, 360)).toBe(0)
  })

  it('never asks for more than half a turn', () => {
    for (let from = 0; from < 360; from += 17) {
      for (let to = 0; to < 360; to += 13) {
        const turn = shortestTurn(from, to)
        expect(turn).toBeGreaterThanOrEqual(-180)
        expect(turn).toBeLessThan(180)
        // Still lands on the facing that was asked for.
        expect(normaliseYaw(from + turn)).toBeCloseTo(normaliseYaw(to))
      }
    }
  })
})

describe('normaliseYaw', () => {
  it('folds a facing back into one lap', () => {
    expect(normaliseYaw(370)).toBeCloseTo(10)
    expect(normaliseYaw(-10)).toBeCloseTo(350)
    expect(normaliseYaw(720)).toBeCloseTo(0)
  })
})

describe('rotatedAround', () => {
  it('leaves the centre where it is', () => {
    const out = rotatedAround({ x: 2, z: 3 }, { x: 2, z: 3 }, 90)
    expect(out.x).toBeCloseTo(2)
    expect(out.z).toBeCloseTo(3)
  })

  it('turns the same way a fitting does', () => {
    // three's Y rotation sends +z to +x, so a quarter turn moves it that way.
    const out = rotatedAround({ x: 0, z: 0 }, { x: 0, z: 1 }, 90)
    expect(out.x).toBeCloseTo(1)
    expect(out.z).toBeCloseTo(0)
  })

  it('comes back to where it started after a full turn', () => {
    const out = rotatedAround({ x: 1, z: -2 }, { x: 3, z: 0.5 }, 360)
    expect(out.x).toBeCloseTo(3)
    expect(out.z).toBeCloseTo(0.5)
  })
})
