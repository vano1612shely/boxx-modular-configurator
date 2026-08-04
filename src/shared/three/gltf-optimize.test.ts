import { describe, expect, it } from 'vitest'

import { fitWithin, isAlreadyOptimised, MAX_TEXTURE_SIZE } from './gltf-optimize'

describe('isAlreadyOptimised', () => {
  // The browser now runs this pipeline before uploading and the server runs it
  // again on arrival. Without the skip, every texture is compressed twice.
  it('leaves a texture the pipeline already produced alone', () => {
    expect(isAlreadyOptimised('image/webp', [2048, 1024])).toBe(true)
    expect(isAlreadyOptimised('image/webp', [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE])).toBe(true)
  })

  it('takes anything still oversized, whatever its format', () => {
    expect(isAlreadyOptimised('image/webp', [4096, 4096])).toBe(false)
    expect(isAlreadyOptimised('image/webp', [512, 4096])).toBe(false)
  })

  it('takes anything not yet in the target format', () => {
    expect(isAlreadyOptimised('image/png', [512, 512])).toBe(false)
    expect(isAlreadyOptimised('image/jpeg', [512, 512])).toBe(false)
  })

  // A texture whose dimensions could not be read might be anything.
  it('refuses to assume when the size is unknown', () => {
    expect(isAlreadyOptimised('image/webp', null)).toBe(false)
    expect(isAlreadyOptimised(null, [512, 512])).toBe(false)
  })
})

describe('fitWithin', () => {
  it('leaves an image that already fits at its own size', () => {
    expect(fitWithin(1024, 512, 2048)).toEqual({ width: 1024, height: 512 })
    expect(fitWithin(2048, 2048, 2048)).toEqual({ width: 2048, height: 2048 })
  })

  it('caps the longest edge and keeps the aspect ratio', () => {
    expect(fitWithin(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 })
    expect(fitWithin(1000, 4000, 2000)).toEqual({ width: 500, height: 2000 })
  })

  // Rounding a very thin image must not produce a zero-pixel edge.
  it('never rounds an edge away', () => {
    expect(fitWithin(8000, 3, 2048)).toEqual({ width: 2048, height: 1 })
  })
})
