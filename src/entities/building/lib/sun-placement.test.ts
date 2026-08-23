import { describe, expect, it } from 'vitest'

import { sunPlacement, type SunBounds } from './sun-placement'

const length = ([x, y, z]: readonly number[]) => Math.hypot(x, y, z)

const away = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('sunPlacement', () => {
  /**
   * The failure this exists to make impossible. A directional light whose
   * target sits where the light does has a direction of zero length: it lights
   * nothing at all, the scene is left with only its hemisphere light, and every
   * surface that was lit reads as near black. It happened by losing a position
   * written onto the light once, which is why the position is worked out here
   * now and handed over as an ordinary value.
   */
  it('never puts the sun where it is looking', () => {
    const cases: Array<SunBounds | null> = [
      null,
      { min: [0, 0, 0], max: [0, 0, 0] },
      { min: [-9, 1.4, -8], max: [9, 4.2, 8] },
      { min: [100, 100, 100], max: [101, 101, 101] },
    ]

    for (const bounds of cases) {
      const { position, target } = sunPlacement(bounds)
      expect(away(position, target)).toBeGreaterThan(1)
    }
  })

  it('stands over the middle of what it lights', () => {
    const { target } = sunPlacement({ min: [-10, 0, -4], max: [10, 6, 4] })
    expect(target).toEqual([0, 3, 0])
  })

  // A degenerate box would otherwise give a radius of zero and a sun standing
  // exactly on its target — the black scene above, from a building nobody has
  // measured yet.
  it('keeps its distance from a subject with no size', () => {
    const { position, target } = sunPlacement({ min: [5, 5, 5], max: [5, 5, 5] })
    expect(away(position, target)).toBeCloseTo(3, 6)
  })

  it('backs off further for a bigger subject', () => {
    const small = sunPlacement({ min: [-2, 0, -2], max: [2, 2, 2] })
    const large = sunPlacement({ min: [-40, 0, -20], max: [40, 8, 20] })

    expect(away(large.position, large.target)).toBeGreaterThan(
      away(small.position, small.target),
    )
  })

  // The shadow camera is a box, and three's default is 10 m at the origin —
  // which covers nothing of a building that is not at the origin.
  it('sizes the shadow camera to the subject, up to a ceiling', () => {
    // 4 × 2 × 4 has a 6 m diagonal, so a 3 m radius and a 3.75 m half-extent.
    expect(sunPlacement({ min: [-2, 0, -2], max: [2, 2, 2] }).extent).toBeCloseTo(3.75, 6)
    expect(sunPlacement({ min: [-200, 0, -200], max: [200, 10, 200] }).extent).toBe(24)
  })

  it('comes from over one shoulder rather than straight down', () => {
    const { position, target } = sunPlacement(null)
    const horizontal = Math.hypot(position[0] - target[0], position[2] - target[2])

    expect(horizontal).toBeGreaterThan(1)
    expect(position[1]).toBeGreaterThan(target[1])
    expect(length(position)).toBeGreaterThan(0)
  })
})
