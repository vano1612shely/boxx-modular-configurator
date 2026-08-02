import { describe, expect, it } from 'vitest'

import { dollySpeedFor, dollyStepFor } from './wheel-dolly'

/** How far one event moves the distance, as a multiplier. */
function step(deltaY: number, deltaMode: number, isMac: boolean): number {
  return dollyStepFor(deltaY, deltaMode, isMac, dollySpeedFor(deltaY, deltaMode, isMac))
}

const CHROME_WINDOWS = [100, 0, false] as const
const FIREFOX_WINDOWS = [3, 1, false] as const
const MAC_PIXELS = [100, 0, true] as const

describe('dollySpeedFor', () => {
  it('makes one notch mean the same on every browser and OS', () => {
    const chrome = step(...CHROME_WINDOWS)
    expect(chrome).toBeCloseTo(1.11, 6)
    expect(step(...FIREFOX_WINDOWS)).toBeCloseTo(chrome, 6)
    expect(step(...MAC_PIXELS)).toBeCloseTo(chrome, 6)
  })

  // Untouched, the same physical wheel is 3.33x apart in log terms between
  // Chrome and Firefox on one machine.
  it('is the correction for a real spread, not a no-op', () => {
    const raw = (deltaY: number, deltaMode: number, isMac: boolean) =>
      dollyStepFor(deltaY, deltaMode, isMac, 1)

    expect(raw(...CHROME_WINDOWS)).toBeCloseTo(1.1865, 3)
    expect(raw(...FIREFOX_WINDOWS)).toBeCloseTo(1.0526, 3)
    expect(raw(...MAC_PIXELS)).toBeCloseTo(1.6702, 3)
  })

  it('scrolls out on a positive delta and in on a negative one', () => {
    expect(step(100, 0, false)).toBeGreaterThan(1)
    expect(step(-100, 0, false)).toBeLessThan(1)
    expect(step(-100, 0, false)).toBeCloseTo(1 / step(100, 0, false), 6)
  })

  it('stays proportional for the small deltas a trackpad emits', () => {
    const tenth = step(10, 0, false)
    expect(tenth).toBeGreaterThan(1)
    expect(tenth ** 10).toBeCloseTo(step(100, 0, false), 6)
  })

  it('caps the step when one notch is reported as a whole screen', () => {
    for (const deltaY of [100, 400, 1200, 1e5]) {
      expect(step(deltaY, 0, false)).toBeCloseTo(1.11, 6)
    }
  })

  it('handles page-mode deltas and a dead event', () => {
    expect(step(1, 2, false)).toBeCloseTo(1.11, 6)
    expect(dollySpeedFor(0, 0, false)).toBe(1)
  })

  it('never returns a negative or non-finite speed', () => {
    for (const deltaY of [-1e5, -100, -0.5, 0.5, 100, 1e5]) {
      for (const deltaMode of [0, 1, 2]) {
        const speed = dollySpeedFor(deltaY, deltaMode, false)
        expect(Number.isFinite(speed)).toBe(true)
        expect(speed).toBeGreaterThan(0)
      }
    }
  })
})
