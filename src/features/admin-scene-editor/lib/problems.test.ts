import { describe, expect, it } from 'vitest'

import { findProblems } from './problems'

const square = (fromX: number, toX: number) => [
  { x: fromX, z: 0 },
  { x: toX, z: 0 },
  { x: toX, z: 4 },
  { x: fromX, z: 4 },
]

const divided = (first: string, second: string) => [
  { key: 'zone-1', name: first, roomType: 'kitchen', polygon: square(0, 5) },
  { key: 'zone-2', name: second, roomType: 'conference', polygon: square(5, 10) },
]

describe('findProblems', () => {
  it('finds nothing wrong with a named building', () => {
    expect(findProblems([{ name: 'Office 1' }, { name: 'Kitchen' }])).toEqual([])
  })

  /**
   * The reason the save is refused rather than the name filled in: a blank name
   * is read by the visitor, on a chip in the scene and on a line of their quote.
   */
  it('will not let a room go out unnamed', () => {
    expect(findProblems([{ name: 'Office 1' }, { name: '  ' }])).toEqual([
      { where: 'Room 2', what: 'needs a name' },
    ])
  })

  // "Room 3 needs a name" is findable; "needs a name" is not.
  it('names an unnamed room by where it is in the list', () => {
    expect(findProblems([{}, {}, {}])[2].where).toBe('Room 3')
  })

  it('will not let a zone go out unnamed either', () => {
    const problems = findProblems([{ name: 'Break room', zones: divided('Kitchen', '') }])

    expect(problems).toEqual([{ where: 'Break room › zone-2', what: 'needs a name' }])
  })

  it('says which room a nameless zone is in, by the name the room has now', () => {
    expect(findProblems([{ name: 'Corner', zones: divided('', '') }]).map((p) => p.where)).toEqual([
      'Corner › zone-1',
      'Corner › zone-2',
    ])
  })

  // An undivided room has no zones to be wrong about, which is nearly all of them.
  it('has nothing to say about a room nobody has cut', () => {
    expect(findProblems([{ name: 'Office', zones: null }])).toEqual([])
  })
})
