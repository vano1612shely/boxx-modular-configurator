import { describe, expect, it } from 'vitest'

import type { ExteriorSlot, ExteriorVariant } from '../model/types'
import {
  claimedNodes,
  entranceView,
  hasExteriorChoices,
  hiddenExteriorNodes,
  revealedNodes,
  selectedVariant,
  slotOfNode,
} from './exterior'

function variant(key: string, nodes: string[] = []): ExteriorVariant {
  return {
    key,
    title: key,
    description: null,
    price: null,
    thumbnailUrl: null,
    nodes,
    modelUrl: null,
    placement: { position: [0, 0, 0], yawDeg: 0, scale: [1, 1, 1] },
  }
}

function slot(
  key: string,
  variants: ExteriorVariant[],
  defaultKey = variants[0]?.key ?? '',
): ExteriorSlot {
  return {
    key,
    name: key,
    position: [0, 0, 0],
    yawDeg: 0,
    defaultVariantKey: defaultKey,
    variants,
  }
}

/** The client's list, as node claims: a deck shared by three of the four. */
const FRONT = slot('front', [
  variant('deck-stairs', ['deck', 'stairs']),
  variant('deck-canopy-stairs', ['deck', 'canopy', 'stairs']),
  variant('deck-stairs-ramp', ['deck', 'stairs', 'ramp']),
  variant('bought'),
])

describe('selectedVariant', () => {
  it('falls back to the spot default with nothing picked', () => {
    expect(selectedVariant(FRONT, {})?.key).toBe('deck-stairs')
  })

  it('answers with the pick when there is one', () => {
    expect(selectedVariant(FRONT, { front: 'deck-stairs-ramp' })?.key).toBe('deck-stairs-ramp')
  })

  // A stale pick outlives the variant it names: the visitor chose, the admin
  // renamed. Showing the default beats showing an empty spot.
  it('ignores a pick that names nothing', () => {
    expect(selectedVariant(FRONT, { front: 'gone' })?.key).toBe('deck-stairs')
  })

  it('ignores a default that names nothing either', () => {
    const broken = slot('back', [variant('a'), variant('b')], 'missing')
    expect(selectedVariant(broken, {})?.key).toBe('a')
  })

  // The state a spot is in between being added and being given its first
  // choice. The mapping drops these before the client ever sees one, but the
  // editor reads the draft straight, and this used to throw there.
  it('answers for a spot with nothing to choose from', () => {
    expect(selectedVariant(slot('fresh', [], ''), {})).toBeNull()
  })
})

describe('hiddenExteriorNodes', () => {
  // The whole point of subtracting: the deck is claimed by the choice being
  // left as well as the one being taken, so it never blinks.
  it('keeps a part two choices share, and swaps only what differs', () => {
    const before = new Set(hiddenExteriorNodes([FRONT], { front: 'deck-stairs' }))
    const after = new Set(hiddenExteriorNodes([FRONT], { front: 'deck-stairs-ramp' }))

    expect(before.has('deck')).toBe(false)
    expect(after.has('deck')).toBe(false)
    expect(before.has('ramp')).toBe(true)
    expect(after.has('ramp')).toBe(false)
  })

  it('hides every claimed object for a choice that brings its own models', () => {
    expect(new Set(hiddenExteriorNodes([FRONT], { front: 'bought' }))).toEqual(
      new Set(['deck', 'stairs', 'canopy', 'ramp']),
    )
  })

  it('leaves objects nobody claimed alone', () => {
    expect(hiddenExteriorNodes([FRONT], {})).not.toContain('chassis')
  })

  // Two spots wanting the same object is an authoring mistake. Hiding it would
  // let one spot's choice silently gut another's.
  it('shows an object either spot wants', () => {
    const other = slot('back', [variant('with', ['deck']), variant('without')])
    const hidden = hiddenExteriorNodes([FRONT, other], { front: 'bought', back: 'with' })

    expect(hidden).not.toContain('deck')
  })

  it('has nothing to say about a building with no spots', () => {
    expect(hiddenExteriorNodes([], {})).toEqual([])
  })

  // An empty spot alongside a real one: the editor renders both the moment
  // "+ Spot" is pressed, and the whole scene came down with it.
  it('steps over a spot that has no choices yet', () => {
    const fresh = slot('fresh', [], '')
    expect(new Set(hiddenExteriorNodes([FRONT, fresh], { front: 'deck-stairs' }))).toEqual(
      new Set(['canopy', 'ramp']),
    )
  })
})

describe('revealedNodes and claimedNodes', () => {
  it('reveal what is picked, claim what could be', () => {
    expect(revealedNodes([FRONT], { front: 'deck-canopy-stairs' })).toEqual(
      new Set(['deck', 'canopy', 'stairs']),
    )
    expect(claimedNodes([FRONT])).toEqual(new Set(['deck', 'stairs', 'canopy', 'ramp']))
  })
})

describe('slotOfNode', () => {
  it('finds the spot an object belongs to, picked or not', () => {
    expect(slotOfNode([FRONT], 'ramp')?.key).toBe('front')
    expect(slotOfNode([FRONT], 'chassis')).toBeNull()
  })
})

describe('entranceView', () => {
  const at = (position: [number, number, number]): ExteriorSlot => ({
    ...slot('front', [variant('a'), variant('b')]),
    position,
  })
  const MIDDLE = { x: 0, z: 0 }

  // The whole point of deriving it: stand on the far side of the spot from the
  // building, so the building is behind the eye and not in front of it.
  it('stands outside the building, not through it', () => {
    const north = entranceView(at([0, 0, 6]), MIDDLE)
    expect(north.position[2]).toBeGreaterThan(6)
    expect(north.position[0]).toBeCloseTo(0, 6)

    const east = entranceView(at([6, 0, 0]), MIDDLE)
    expect(east.position[0]).toBeGreaterThan(6)
    expect(east.position[2]).toBeCloseTo(0, 6)
  })

  it('follows a spot dragged round to another wall, with nothing to update', () => {
    const south = entranceView(at([0, 0, -6]), MIDDLE)
    expect(south.position[2]).toBeLessThan(-6)
  })

  // Level-ish rather than overhead: the visitor asked to see the ramp, and a
  // ramp seen from above is a stripe.
  it('looks slightly down at the spot from close to eye level', () => {
    const view = entranceView(at([4, 0.5, -2]), MIDDLE)

    expect(view.target).toEqual([4, 1.6, -2])
    expect(view.position[1]).toBeGreaterThan(view.target[1])
    expect(view.position[1] - view.target[1]).toBeLessThan(3)
  })

  it('keeps its distance wherever the spot sits', () => {
    for (const spot of [
      [3, 0, 4],
      [-7, 0, 1],
      [0, 0, -9],
      [2.5, 0, -2.5],
    ] as Array<[number, number, number]>) {
      const view = entranceView(at(spot), MIDDLE)
      const reach = Math.hypot(view.position[0] - spot[0], view.position[2] - spot[2])
      expect(reach).toBeCloseTo(10, 6)
    }
  })

  it('answers for a spot with no building measured, and for one dead centre', () => {
    expect(entranceView(at([0, 0, 0]), null).position[2]).toBeCloseTo(10, 6)
    expect(entranceView(at([0, 0, 0]), MIDDLE).position[2]).toBeCloseTo(10, 6)
  })
})

describe('hasExteriorChoices', () => {
  // One choice is not a choice — it is geometry that is always there, and it
  // must not put a panel on screen.
  it('needs a spot with more than one choice', () => {
    expect(hasExteriorChoices([slot('only', [variant('a')])])).toBe(false)
    expect(hasExteriorChoices([FRONT])).toBe(true)
    expect(hasExteriorChoices([])).toBe(false)
  })
})
