import { describe, expect, it } from 'vitest'

import type { ExteriorSlot, ExteriorVariant } from '../model/types'
import {
  claimedNodes,
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
    parts: [],
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

describe('hasExteriorChoices', () => {
  // One choice is not a choice — it is geometry that is always there, and it
  // must not put a panel on screen.
  it('needs a spot with more than one choice', () => {
    expect(hasExteriorChoices([slot('only', [variant('a')])])).toBe(false)
    expect(hasExteriorChoices([FRONT])).toBe(true)
    expect(hasExteriorChoices([])).toBe(false)
  })
})
