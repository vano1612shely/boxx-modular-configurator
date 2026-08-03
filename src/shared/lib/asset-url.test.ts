import { describe, expect, it } from 'vitest'

import { assetUrl } from './asset-url'

describe('assetUrl', () => {
  it('stamps the version the file was last written at', () => {
    expect(assetUrl({ url: '/api/models/file/door.glb', updatedAt: '2026-08-03T10:00:00.000Z' }))
      .toBe('/api/models/file/door.glb?v=1785751200000')
  })

  // Two uploads of the same filename are the case this exists for: same URL,
  // different bytes, and every cache in the way keyed on the URL alone.
  it('tells two versions of one filename apart', () => {
    const first = assetUrl({ url: '/f/door.glb', updatedAt: '2026-08-03T10:00:00.000Z' })
    const second = assetUrl({ url: '/f/door.glb', updatedAt: '2026-08-03T11:00:00.000Z' })
    expect(first).not.toBe(second)
  })

  it('leaves a URL alone when there is no version to stamp', () => {
    expect(assetUrl({ url: '/f/door.glb' })).toBe('/f/door.glb')
    expect(assetUrl({ url: '/f/door.glb', updatedAt: 'not a date' })).toBe('/f/door.glb')
  })

  it('joins onto a URL that already carries a query', () => {
    expect(assetUrl({ url: '/f/door.glb?raw=1', updatedAt: '2026-08-03T10:00:00.000Z' }))
      .toBe('/f/door.glb?raw=1&v=1785751200000')
  })

  it('has nothing to give for a doc without a file', () => {
    expect(assetUrl(null)).toBeNull()
    expect(assetUrl(undefined)).toBeNull()
    expect(assetUrl({ url: '' })).toBeNull()
  })
})
