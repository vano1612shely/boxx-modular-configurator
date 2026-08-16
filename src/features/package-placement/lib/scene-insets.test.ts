import { describe, expect, it } from 'vitest'

import { measureInsets, type Insets, type PanelRect } from './scene-insets'

const CANVAS = { width: 1280, height: 800 }
const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** The panels the configurator actually draws over the scene, on a desktop. */
const ROOM_FACTS: PanelRect = { top: 16, right: 336, bottom: 160, left: 16 }
const QUOTE_BUTTON: PanelRect = { top: 16, right: 1264, bottom: 60, left: 1090 }
const SIDEBAR: PanelRect = { top: 0, right: 1280, bottom: 800, left: 928 }
const VIEW_BAR: PanelRect = { top: 728, right: 760, bottom: 784, left: 520 }

describe('measureInsets', () => {
  // Both of these sit in a corner and so reach in from two edges. Counting the
  // deeper one would push the bar off most of the frame for no reason.
  it('clears a corner panel by the edge it is cheapest to clear', () => {
    expect(measureInsets(CANVAS, [ROOM_FACTS], NONE)).toEqual({ ...NONE, top: 160 })
    expect(measureInsets(CANVAS, [SIDEBAR], NONE)).toEqual({ ...NONE, right: 352 })
  })

  it('reads the bottom bar off the bottom, inset and all', () => {
    expect(measureInsets(CANVAS, [VIEW_BAR], NONE)).toEqual({ ...NONE, bottom: 72 })
  })

  // The quote button is 190px in from the right and 60px down from the top, so
  // it is cleared by passing under it — and the room facts, deeper against the
  // same edge, are what actually sets the number.
  it('takes the deepest of several against the same edge', () => {
    expect(measureInsets(CANVAS, [QUOTE_BUTTON], NONE)).toEqual({ ...NONE, top: 60 })
    expect(measureInsets(CANVAS, [QUOTE_BUTTON, ROOM_FACTS], NONE)).toEqual({ ...NONE, top: 160 })
    expect(measureInsets(CANVAS, [ROOM_FACTS, QUOTE_BUTTON], NONE)).toEqual({ ...NONE, top: 160 })
  })

  it('reads the whole configurator at once', () => {
    expect(measureInsets(CANVAS, [ROOM_FACTS, QUOTE_BUTTON, SIDEBAR, VIEW_BAR], NONE)).toEqual({
      top: 160,
      right: 352,
      bottom: 72,
      left: 0,
    })
  })

  // An open dialog is not an edge panel, and treating it as one would leave the
  // bar nowhere at all to be.
  it('ignores a panel too far in to be an edge', () => {
    const dialog: PanelRect = { top: 250, right: 840, bottom: 550, left: 440 }

    expect(measureInsets(CANVAS, [dialog], NONE)).toEqual(NONE)
  })

  it('ignores a panel that is not over the scene', () => {
    const offscreen: PanelRect = { top: -200, right: 300, bottom: -20, left: 0 }

    expect(measureInsets(CANVAS, [offscreen], NONE)).toEqual(NONE)
  })

  // A floor, so a panel that has lost its marking leaves the bar off the edge
  // of the page rather than hard against it.
  it('never reports less than the floor it was given', () => {
    const floor: Insets = { top: 16, right: 16, bottom: 16, left: 16 }

    expect(measureInsets(CANVAS, [], floor)).toEqual(floor)
    expect(measureInsets(CANVAS, [VIEW_BAR], floor)).toEqual({ ...floor, bottom: 72 })
  })
})
