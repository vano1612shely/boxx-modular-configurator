import { describe, expect, it } from 'vitest'

import { regionClauses, whereAll } from './scope'

describe('regionClauses', () => {
  it('does not narrow anything when no region was asked for', () => {
    expect(regionClauses(null)).toEqual([])
  })

  it('keeps items with no regions, which means sold everywhere', () => {
    const [clause] = regionClauses(7)
    expect(clause).toEqual({
      or: [{ regions: { contains: 7 } }, { regions: { exists: false } }],
    })
  })

  // An unrecognised code resolves to an id nothing carries, so the query keeps
  // only the unrestricted items. Widening back to the whole catalogue would show
  // region-locked products for a region we cannot identify.
  it('shows only unrestricted items for an id nothing carries', () => {
    const [clause] = regionClauses(-1)
    expect(clause).toEqual({
      or: [{ regions: { contains: -1 } }, { regions: { exists: false } }],
    })
  })
})

describe('whereAll', () => {
  it('passes an empty query rather than an empty and, which Payload rejects', () => {
    expect(whereAll([])).toEqual({})
  })

  it('combines clauses', () => {
    const line = { 'line.slug': { equals: 'boxxplex' } }
    expect(whereAll([line, ...regionClauses(3)])).toEqual({
      and: [line, { or: [{ regions: { contains: 3 } }, { regions: { exists: false } }] }],
    })
  })
})
