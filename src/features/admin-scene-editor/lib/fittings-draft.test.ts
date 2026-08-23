import { describe, expect, it } from 'vitest'

import { draftSets, freeKeyIn, heightAboveFloor } from './fittings-draft'

describe('heightAboveFloor', () => {
  /**
   * The whole reason the height is stored the way it is. A room whose floor
   * sits at 1.47 m — a chassis-mounted modular box — must still describe a
   * microwave on a 0.92 m worktop as 0.92, not as 2.39, or re-levelling the
   * storey would leave the microwave hanging where the old floor used to be.
   */
  it('stores a height above the room floor, not a level in the building', () => {
    expect(heightAboveFloor(2.39, 0, 1.47)).toBeCloseTo(0.92, 6)
  })

  // Measured once when the grip is taken, so the fitting does not jump to
  // centre itself under the pointer on the first frame of the drag.
  it('keeps the offset the pointer grabbed it by', () => {
    expect(heightAboveFloor(1.5, 0.5, 0)).toBeCloseTo(1, 6)
  })

  // A 5 cm floor grid cannot express a worktop. This one can.
  it('lands on the centimetre', () => {
    expect(heightAboveFloor(0.923, 0, 0)).toBeCloseTo(0.92, 6)
    expect(heightAboveFloor(0.916, 0, 0)).toBeCloseTo(0.92, 6)
  })

  // Sunk into the slab it is invisible from every angle and hard to find again.
  it('never goes below the floor', () => {
    expect(heightAboveFloor(-3, 0, 0)).toBe(0)
    expect(heightAboveFloor(1, 0, 2)).toBe(0)
  })
})

describe('draftSets', () => {
  const part = { key: 'q-1', source: 'model', modelUrl: '/a.glb' }

  /**
   * The difference from the reader the scene uses, and the reason this exists.
   * The mapper drops an empty arrangement, rightly — it would put a tile on the
   * panel that costs money and puts nothing in the room. The editor is where an
   * arrangement is empty for the first minute of its life, and reading it back
   * through the mapper would delete it between "add a kitchen" and "add its
   * first appliance".
   */
  it('keeps an arrangement that has nothing in it yet', () => {
    expect(draftSets([{ key: 's-1', packageId: 4, parts: [] }])).toEqual([
      { key: 's-1', packageId: 4, parts: [] },
    ])
  })

  it('drops a row that names no package', () => {
    expect(draftSets([{ key: 's-1', parts: [part] }])).toEqual([])
  })

  it('drops a row with no key of its own', () => {
    expect(draftSets([{ packageId: 4, parts: [part] }])).toEqual([])
  })

  it('answers for a column nobody has written yet', () => {
    expect(draftSets(null)).toEqual([])
    expect(draftSets('nonsense')).toEqual([])
  })
})

describe('freeKeyIn', () => {
  it('takes a name nothing in the list has', () => {
    expect(freeKeyIn([{ key: 'part-1' }], 'part')).toBe('part-2')
  })

  // Keys are the identity — a part deleted from the middle must not hand its
  // name to the next one, or the handles would jump to the wrong fitting.
  it('steps past a name still in use after a deletion', () => {
    expect(freeKeyIn([{ key: 'part-2' }, { key: 'part-3' }], 'part')).toBe('part-4')
  })
})
