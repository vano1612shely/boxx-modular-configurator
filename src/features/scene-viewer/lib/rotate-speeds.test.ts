import { describe, expect, it } from 'vitest'

import { azimuthRotateSpeed, polarRotateSpeed } from './rotate-speeds'

const TURN = Math.PI * 2

/** camera-controls: `2 * PI * speed * delta / elementHeight`, both axes. */
function rotated(delta: number, speed: number, height: number): number {
  return (TURN * speed * delta) / height
}

const DESKTOP = { width: 1920, height: 950 }
const PHONE = { width: 390, height: 750 }

describe('azimuthRotateSpeed', () => {
  it('costs one canvas width per turn on a landscape canvas', () => {
    for (const { width, height } of [DESKTOP, { width: 1920, height: 1080 }]) {
      const speed = azimuthRotateSpeed(width, height)
      expect(rotated(width, speed, height)).toBeCloseTo(TURN, 6)
    }
  })

  // One width is a thumb width on a portrait canvas, and a turn that cheap
  // spins the model on any diagonal drag.
  it('never spends less than one and a half canvas heights on a turn', () => {
    for (const { width, height } of [PHONE, { width: 768, height: 1024 }, { width: 1024, height: 1024 }]) {
      const speed = azimuthRotateSpeed(width, height)
      expect(rotated(width, speed, height)).toBeLessThan(TURN)
      expect(rotated(height * 1.5, speed, height)).toBeCloseTo(TURN, 6)
    }
  })

  // Left at the library default, the same swipe covers 728 degrees on a desktop
  // canvas and 187 on a phone, because it divides deltaX by the *height*. Priced
  // in widths alone the correction overshot the other way and handed the
  // twitchiest device the cheapest turn.
  it('closes the gap the default leaves between desktop and phone', () => {
    const heightsPerTurn = ({ width, height }: { width: number; height: number }) =>
      TURN / rotated(height, azimuthRotateSpeed(width, height), height)

    for (const size of [DESKTOP, PHONE, { width: 1920, height: 1080 }, { width: 768, height: 1024 }]) {
      expect(heightsPerTurn(size)).toBeGreaterThanOrEqual(1.5 - 1e-9)
      expect(heightsPerTurn(size)).toBeLessThanOrEqual(2.1)
    }
  })

  it('survives a canvas that has not been measured yet', () => {
    expect(azimuthRotateSpeed(0, 0)).toBe(1)
    expect(azimuthRotateSpeed(1, 1e6)).toBeLessThanOrEqual(4)
  })
})

describe('polarRotateSpeed', () => {
  it('spends a fixed share of the drag height on the whole authored range', () => {
    const speed = polarRotateSpeed(15, 85)
    const height = 950
    const span = ((85 - 15) * Math.PI) / 180

    const travel = span / rotated(1, speed, height)
    expect(travel / height).toBeCloseTo(0.55, 6)
  })

  // At the default speed of 1 the 15-85 range is spent in 185px of a 950px
  // canvas, so every diagonal drag dies vertically a couple of centimetres in.
  it('is several times gentler than the default it replaces', () => {
    expect(polarRotateSpeed(15, 85)).toBeLessThan(0.4)
    expect(polarRotateSpeed(15, 85)).toBeGreaterThan(0.3)
  })

  it('keeps the gesture the same length for a tighter authored range', () => {
    const height = 950
    const pixels = (min: number, max: number) => {
      const span = ((max - min) * Math.PI) / 180
      return span / rotated(1, polarRotateSpeed(min, max), height)
    }

    expect(pixels(15, 85)).toBeCloseTo(pixels(40, 60), 6)
  })

  it('does not divide by a range of nothing', () => {
    expect(polarRotateSpeed(45, 45)).toBeGreaterThan(0)
    expect(polarRotateSpeed(85, 15)).toBeCloseTo(polarRotateSpeed(15, 85), 12)
  })
})

// Both speeds are divided by the *height* in the library, so a yaw priced in
// widths and a pitch priced in heights drift apart with the aspect. Asserted
// per axis they both look right; it is only their ratio that shows the phone
// spinning horizontally and barely tilting.
describe('the two axes together', () => {
  const perPixel = (size: { width: number; height: number }) => ({
    yaw: rotated(1, azimuthRotateSpeed(size.width, size.height), size.height),
    pitch: rotated(1, polarRotateSpeed(15, 85), size.height),
  })

  it('keeps yaw and pitch within reach of each other on both form factors', () => {
    for (const size of [DESKTOP, PHONE, { width: 1920, height: 1080 }, { width: 768, height: 1024 }]) {
      const { yaw, pitch } = perPixel(size)
      expect(yaw / pitch).toBeGreaterThan(1)
      expect(yaw / pitch).toBeLessThan(2)
    }
  })

  it('does not let a thumb flick turn the model half way round', () => {
    const { yaw } = perPixel(PHONE)
    expect((yaw * 100 * 180) / Math.PI).toBeLessThan(45)
  })
})
