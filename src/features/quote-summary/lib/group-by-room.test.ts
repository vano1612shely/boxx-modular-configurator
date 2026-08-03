import { describe, expect, it } from 'vitest'

import { groupByRoom } from './group-by-room'

const ROOMS = [
  { key: 'office-1', name: 'Office 1' },
  { key: 'office-2', name: 'Office 2' },
  { key: 'restroom', name: 'Restroom' },
]

const desk = { roomKey: 'office-2', title: 'Desk' }
const chair = { roomKey: 'office-1', title: 'Chair' }
const shelf = { roomKey: 'office-2', title: 'Shelf' }

describe('groupByRoom', () => {
  it('follows the building order, not the order things were placed', () => {
    const groups = groupByRoom([desk, chair, shelf], ROOMS)

    expect(groups.map((g) => g.name)).toEqual(['Office 1', 'Office 2'])
    expect(groups[0].packages).toEqual([chair])
    expect(groups[1].packages).toEqual([desk, shelf])
  })

  it('leaves out rooms nothing was placed in', () => {
    const groups = groupByRoom([chair], ROOMS)
    expect(groups.map((g) => g.key)).toEqual(['office-1'])
  })

  it('keeps the placement order within a room', () => {
    const [group] = groupByRoom([shelf, desk], [{ key: 'office-2', name: 'Office 2' }])
    expect(group.packages).toEqual([shelf, desk])
  })

  // Dropping these would quote the customer less than they configured.
  it('still lists placements whose room the scene no longer describes', () => {
    const ghost = { roomKey: 'deleted-room', title: 'Cabinet' }
    const groups = groupByRoom([chair, ghost], ROOMS)

    expect(groups.map((g) => g.key)).toEqual(['office-1', 'deleted-room'])
    expect(groups[1].packages).toEqual([ghost])
  })

  it('is empty when nothing was placed', () => {
    expect(groupByRoom([], ROOMS)).toEqual([])
  })
})
