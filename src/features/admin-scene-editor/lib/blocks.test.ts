import { describe, expect, it } from 'vitest'

import { blockRefKey, nextStoreyBox, sameBlockRef, type EditorBox } from './blocks'

const FOOTPRINT = { minX: -4, minZ: -3, maxX: 4, maxZ: 3 }

describe('sameBlockRef', () => {
  // Roof volumes and storeys are two arrays; an index alone addresses neither.
  it('tells the two collections apart at the same index', () => {
    expect(sameBlockRef({ scope: 'roof', index: 0 }, { scope: 'floor', index: 0 })).toBe(false)
    expect(sameBlockRef({ scope: 'floor', index: 1 }, { scope: 'floor', index: 1 })).toBe(true)
  })

  it('gives them distinct pick keys', () => {
    expect(blockRefKey({ scope: 'roof', index: 0 })).not.toBe(
      blockRefKey({ scope: 'floor', index: 0 }),
    )
  })
})

describe('nextStoreyBox', () => {
  it('splits the model in half for the first storey', () => {
    const box = nextStoreyBox(null, 6, FOOTPRINT)
    expect([box.min.y, box.max.y]).toEqual([0, 3])
  })

  it('stands the next storey on the last one and repeats its height', () => {
    const ground: EditorBox = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 2.8, z: 1 },
    }
    const box = nextStoreyBox(ground, 6, FOOTPRINT)
    expect([box.min.y, box.max.y]).toEqual([2.8, 5.6])
  })

  // The sides exist only so nothing at the model's edge is clipped; a side
  // landing mid-wall cuts a hole instead of a section.
  it('reaches well past the model on both ground axes', () => {
    const box = nextStoreyBox(null, 6, FOOTPRINT)
    expect(box.min.x).toBeLessThan(FOOTPRINT.minX)
    expect(box.max.x).toBeGreaterThan(FOOTPRINT.maxX)
    expect(box.min.z).toBeLessThan(FOOTPRINT.minZ)
    expect(box.max.z).toBeGreaterThan(FOOTPRINT.maxZ)
  })

  it('still gives something draggable before the model has been measured', () => {
    const box = nextStoreyBox(null, 0, null)
    expect(box.max.x - box.min.x).toBeGreaterThan(0)
    expect(box.max.y).toBeGreaterThan(box.min.y)
  })
})
