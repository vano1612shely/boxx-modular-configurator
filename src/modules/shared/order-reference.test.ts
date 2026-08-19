import { describe, expect, it } from 'vitest'

import { isOrderReference, newOrderReference } from './order-reference'

describe('newOrderReference', () => {
  it('is twelve characters long', () => {
    expect(newOrderReference()).toHaveLength(12)
  })

  // Read down a phone line and typed back in, so the pairs that look alike are
  // not both in the alphabet.
  it('leaves out the characters that are mistaken for each other', () => {
    const drawn = Array.from({ length: 200 }, newOrderReference).join('')
    expect(drawn).not.toMatch(/[01OILU]/)
  })

  it('does not repeat itself', () => {
    const drawn = new Set(Array.from({ length: 5000 }, newOrderReference))
    expect(drawn.size).toBe(5000)
  })
})

describe('isOrderReference', () => {
  it('accepts one it just made', () => {
    expect(isOrderReference(newOrderReference())).toBe(true)
  })

  // The route takes either a reference or a quote id, and it has to tell them
  // apart before it asks the database about either.
  it('rejects a quote id', () => {
    expect(isOrderReference('42')).toBe(false)
  })

  it('rejects the right length in the wrong alphabet', () => {
    expect(isOrderReference('abcdefgh2345')).toBe(false)
    expect(isOrderReference('AAAAAAAAAAA0')).toBe(false)
  })

  it('rejects the empty segment', () => {
    expect(isOrderReference('')).toBe(false)
  })
})

// The alphabet contains 2-9, so a reference drawn entirely from them is both a
// valid reference and a string of digits. The route has to answer the reference
// first, or the customer holding it is sent to the admin-only door for good.
describe('a reference that is all digits', () => {
  it('is still recognised as a reference', () => {
    expect(isOrderReference('234567892345')).toBe(true)
  })
})
