import { describe, expect, it } from 'vitest'

import { ROOF_HIDE_POLAR_DEG, ROOF_SHOW_POLAR_DEG, roofShownAt } from './roof-reveal'

describe('roofShownAt', () => {
  // The two poses the bar offers, and what each of them has to look like.
  it('covers the eye-level overview and uncovers the plan', () => {
    expect(roofShownAt(85, false)).toBe(true)
    expect(roofShownAt(3, true)).toBe(false)
  })

  it('goes as the camera tips over the top, and comes back as it drops', () => {
    expect(roofShownAt(ROOF_HIDE_POLAR_DEG, true)).toBe(false)
    expect(roofShownAt(ROOF_SHOW_POLAR_DEG, false)).toBe(true)
  })

  // A hand resting on one threshold would otherwise flicker the roof in and out
  // for as long as it rested there, redrawing the shadow map on every flip.
  it('holds what it has between the two, whichever that is', () => {
    const between = (ROOF_HIDE_POLAR_DEG + ROOF_SHOW_POLAR_DEG) / 2

    expect(roofShownAt(between, true)).toBe(true)
    expect(roofShownAt(between, false)).toBe(false)
  })

  // Which is only hysteresis if it is crossed in the direction it is crossed:
  // the band has to be entered from one side and left by the other.
  it('takes a deliberate crossing, not a wobble', () => {
    let shown = true
    for (const polar of [70, 66, 64, 66, 70]) shown = roofShownAt(polar, shown)
    expect(shown).toBe(true)

    for (const polar of [66, 62, 59]) shown = roofShownAt(polar, shown)
    expect(shown).toBe(false)
  })

  it('leaves a band wide enough to be crossed on purpose', () => {
    expect(ROOF_SHOW_POLAR_DEG - ROOF_HIDE_POLAR_DEG).toBeGreaterThanOrEqual(5)
  })
})
