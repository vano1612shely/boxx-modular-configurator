import { describe, expect, it } from 'vitest'

import type { Room, Zone } from '@/entities/building'

import { groupByPlace, placeKeyOf, placesOf } from './group-by-place'

const PLACES = [
  { key: 'office-1', name: 'Office 1' },
  { key: 'office-2', name: 'Office 2' },
  { key: 'restroom', name: 'Restroom' },
]

const desk = { placeKey: 'office-2', title: 'Desk' }
const chair = { placeKey: 'office-1', title: 'Chair' }
const shelf = { placeKey: 'office-2', title: 'Shelf' }

describe('groupByPlace', () => {
  it('follows the building order, not the order things were placed', () => {
    const groups = groupByPlace([desk, chair, shelf], PLACES)

    expect(groups.map((g) => g.name)).toEqual(['Office 1', 'Office 2'])
    expect(groups[0].packages).toEqual([chair])
    expect(groups[1].packages).toEqual([desk, shelf])
  })

  it('leaves out places nothing was placed in', () => {
    const groups = groupByPlace([chair], PLACES)
    expect(groups.map((g) => g.key)).toEqual(['office-1'])
  })

  it('keeps the placement order within a place', () => {
    const [group] = groupByPlace([shelf, desk], [{ key: 'office-2', name: 'Office 2' }])
    expect(group.packages).toEqual([shelf, desk])
  })

  // Dropping these would quote the customer less than they configured.
  it('still lists placements whose place the scene no longer describes', () => {
    const ghost = { placeKey: 'deleted-room', title: 'Cabinet' }
    const groups = groupByPlace([chair, ghost], PLACES)

    expect(groups.map((g) => g.key)).toEqual(['office-1', 'deleted-room'])
    expect(groups[1].packages).toEqual([ghost])
  })

  it('is empty when nothing was placed', () => {
    expect(groupByPlace([], PLACES)).toEqual([])
  })
})

function room(key: string, name: string, zones: Array<Pick<Zone, 'key' | 'name'>>): Room {
  return { key, name, zones: zones as Zone[] } as Room
}

describe('placesOf', () => {
  it('gives an undivided room one heading of its own', () => {
    expect(placesOf([room('office-1', 'Office 1', [])])).toEqual([
      { key: 'office-1', name: 'Office 1' },
    ])
  })

  // The room is called "Conference + Kitchen", so heading both halves with that
  // would say the same thing twice and identify neither.
  it('gives a divided room a heading per zone, named for the zone', () => {
    const divided = room('open', 'Conference + Kitchen', [
      { key: 'a', name: 'Conference' },
      { key: 'b', name: 'Kitchen' },
    ])

    expect(placesOf([divided])).toEqual([
      { key: 'open/a', name: 'Conference' },
      { key: 'open/b', name: 'Kitchen' },
    ])
  })

  it('keys a zone under the room it belongs to', () => {
    expect(placeKeyOf('open', 'a')).toBe('open/a')
    expect(placeKeyOf('office-1', null)).toBe('office-1')
  })
})
