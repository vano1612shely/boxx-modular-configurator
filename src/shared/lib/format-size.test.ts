import { describe, expect, it } from 'vitest'

import { formatBytes, formatCount, savingPercent } from './format-size'

describe('formatBytes', () => {
  it('reads the way a file manager reads', () => {
    expect(formatBytes(52_929_124)).toBe('50.5 MB')
    expect(formatBytes(8_187_628)).toBe('7.8 MB')
    expect(formatBytes(97_040)).toBe('94.8 KB')
  })

  it('keeps whole numbers whole', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB')
  })

  it('leaves small files in bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
  })

  it('climbs no further than it has units for', () => {
    expect(formatBytes(5 * 1024 ** 4)).toBe('5 TB')
    expect(formatBytes(5000 * 1024 ** 4)).toBe('5000 TB')
  })

  it('says nothing rather than something wrong', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(-1)).toBe('—')
  })
})

describe('savingPercent', () => {
  it('reports how much the optimizer took off', () => {
    expect(savingPercent(52_929_124, 8_187_628)).toBe(85)
  })

  it('declines to dress up a file that grew', () => {
    expect(savingPercent(100, 120)).toBeNull()
  })

  it('has nothing to say without both numbers', () => {
    expect(savingPercent(null, 10)).toBeNull()
    expect(savingPercent(10, undefined)).toBeNull()
    expect(savingPercent(0, 0)).toBeNull()
  })
})

describe('formatCount', () => {
  it('separates thousands', () => {
    expect(formatCount(262_158)).toBe('262,158')
    expect(formatCount(32)).toBe('32')
  })

  it('says nothing rather than NaN', () => {
    expect(formatCount(undefined)).toBe('—')
  })
})
