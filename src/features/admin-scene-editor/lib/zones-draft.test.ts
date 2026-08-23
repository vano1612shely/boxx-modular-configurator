import { describe, expect, it } from 'vitest'

import { roomZones } from '@/entities/building'

import { draftZones } from './zones-draft'

const square = (fromX: number, toX: number) => [
  { x: fromX, z: 0 },
  { x: toX, z: 0 },
  { x: toX, z: 4 },
  { x: fromX, z: 4 },
]

const pair = (first: Record<string, unknown>, second: Record<string, unknown> = {}) => [
  { key: 'zone-1', roomType: 'kitchen', polygon: square(0, 5), ...first },
  { key: 'zone-2', name: 'Conference', roomType: 'conference', polygon: square(5, 10), ...second },
]

describe('draftZones', () => {
  /**
   * The bug it exists for. The scene's reader puts the key in place of a
   * missing name, so clearing the field filled it back in with "zone-1" before
   * the next keystroke — the field could not be emptied and could not be
   * retyped, and nothing said why.
   */
  it('leaves a cleared name cleared', () => {
    expect(draftZones(pair({ name: '' }))[0].name).toBe('')
    expect(roomZones(pair({ name: '' }))[0].name).toBe('zone-1')
  })

  it('leaves a name that was never written cleared too', () => {
    expect(draftZones(pair({}))[0].name).toBe('')
  })

  it('leaves a written name alone', () => {
    expect(draftZones(pair({ name: 'Kitchen' }))[0].name).toBe('Kitchen')
  })

  /**
   * Everything else still comes from the scene's own reader, so the two cannot
   * disagree about what a zone is — only about what a nameless one is called.
   */
  it('answers exactly as the scene does about everything else', () => {
    const rows = pair({ name: '' })
    const draft = draftZones(rows)
    const scene = roomZones(rows)

    expect(draft.map((zone) => zone.key)).toEqual(scene.map((zone) => zone.key))
    expect(draft.map((zone) => zone.roomType)).toEqual(scene.map((zone) => zone.roomType))
    expect(draft.map((zone) => zone.polygon)).toEqual(scene.map((zone) => zone.polygon))
    expect(draft[1].name).toBe('Conference')
  })

  it('drops what the scene drops', () => {
    expect(draftZones(null)).toEqual([])
    expect(draftZones([{ key: 'only-one', polygon: square(0, 5) }])).toEqual([])
  })
})
