import { describe, expect, it } from 'vitest'

import { facingSide } from './facing'

const deg = (d: number) => (d * Math.PI) / 180
/** Well clear of overhead: every side preset stands near the horizon. */
const SIDE_ON = deg(80)

describe('facingSide', () => {
  it('names the face the camera is square to', () => {
    expect(facingSide(0, SIDE_ON)).toBe('side-front')
    expect(facingSide(deg(90), SIDE_ON)).toBe('side-right')
    expect(facingSide(deg(180), SIDE_ON)).toBe('side-back')
    expect(facingSide(deg(-90), SIDE_ON)).toBe('side-left')
  })

  // camera-controls accumulates the azimuth and never wraps it.
  it('follows an azimuth that has been round several times', () => {
    expect(facingSide(deg(360), SIDE_ON)).toBe('side-front')
    expect(facingSide(deg(450), SIDE_ON)).toBe('side-right')
    expect(facingSide(deg(-270), SIDE_ON)).toBe('side-right')
    expect(facingSide(deg(-360), SIDE_ON)).toBe('side-front')
  })

  it('allows the slack of a settling flight', () => {
    expect(facingSide(deg(3), SIDE_ON)).toBe('side-front')
    expect(facingSide(deg(-3), SIDE_ON)).toBe('side-front')
  })

  // The whole point: a dragged camera is not looking at any face, and saying so
  // is better than keeping the name of the button last pressed.
  it('names nothing between two faces', () => {
    expect(facingSide(deg(45), SIDE_ON)).toBeNull()
    expect(facingSide(deg(20), SIDE_ON)).toBeNull()
    expect(facingSide(deg(112), SIDE_ON)).toBeNull()
  })

  // Straight down the sides are all equally in view, so none of them is "the"
  // one — and the top view has its own pill saying what is going on.
  it('names nothing from overhead', () => {
    expect(facingSide(0, deg(3))).toBeNull()
    expect(facingSide(deg(90), deg(20))).toBeNull()
  })
})
