import { describe, expect, it } from 'vitest'

import { optionIdOf, optionModelUrl } from './exterior-option'

const RAMP = { id: 7, modelUrl: '/api/models/file/ramp.glb?v=1' }

describe('optionIdOf', () => {
  // The two shapes the same choice arrives in: picked in this session, or read
  // back populated from the document.
  it('answers for a bare id and for a populated entry alike', () => {
    expect(optionIdOf(7)).toBe(7)
    expect(optionIdOf({ id: 7 })).toBe(7)
  })

  it('has nothing to say about a choice with no option on it', () => {
    expect(optionIdOf(null)).toBeNull()
    expect(optionIdOf(undefined)).toBeNull()
  })
})

describe('optionModelUrl', () => {
  it('finds the model through the catalogue, however the option is stored', () => {
    expect(optionModelUrl(7, [RAMP])).toBe(RAMP.modelUrl)
    expect(optionModelUrl({ id: 7 }, [RAMP])).toBe(RAMP.modelUrl)
  })

  // The entry was deleted, or the catalogue has not come back yet. Both mean
  // the viewport draws nothing rather than throwing on the way to a frame.
  it('draws nothing for an entry the catalogue does not have', () => {
    expect(optionModelUrl(9, [RAMP])).toBeNull()
    expect(optionModelUrl(7, [])).toBeNull()
  })

  // An entry whose model relationship did not come back populated. Nothing to
  // draw, and nothing to crash on either.
  it('draws nothing for an entry with no model resolved', () => {
    expect(optionModelUrl(7, [{ id: 7, modelUrl: null }])).toBeNull()
  })

  it('has nothing to look up for a choice with no option on it', () => {
    expect(optionModelUrl(null, [RAMP])).toBeNull()
  })
})
