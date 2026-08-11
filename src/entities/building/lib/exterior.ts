import type { ExteriorSlot, ExteriorVariant } from '../model/types'

/** What the visitor has picked, by spot key. Missing means the spot's default. */
export type ExteriorSelection = Record<string, string>

/**
 * The choice in force at a spot.
 *
 * Never null: a spot with no variants never reaches the client, and a selection
 * naming a variant that no longer exists falls back to the default rather than
 * leaving the spot showing nothing.
 */
export function selectedVariant(slot: ExteriorSlot, selection: ExteriorSelection): ExteriorVariant {
  const key = selection[slot.key]
  const picked = key === undefined ? undefined : slot.variants.find((v) => v.key === key)
  if (picked) return picked

  return slot.variants.find((v) => v.key === slot.defaultVariantKey) ?? slot.variants[0]
}

/**
 * Objects of the building's own model that the current choices call for.
 *
 * A node claimed by two spots is shown if either one wants it. That is an
 * authoring mistake the editor warns about, and showing it is the harmless way
 * to be wrong: the other way round, a spot's own choice would be silently
 * gutted by a spot somewhere else on the building.
 */
export function revealedNodes(
  slots: ExteriorSlot[],
  selection: ExteriorSelection,
): Set<string> {
  const revealed = new Set<string>()
  for (const slot of slots) {
    for (const path of selectedVariant(slot, selection).nodes) revealed.add(path)
  }
  return revealed
}

/** Every node any choice at any spot could ever show. */
export function claimedNodes(slots: ExteriorSlot[]): Set<string> {
  const claimed = new Set<string>()
  for (const slot of slots) {
    for (const variant of slot.variants) {
      for (const path of variant.nodes) claimed.add(path)
    }
  }
  return claimed
}

/**
 * Objects to hide so the building shows the picked choices and nothing else.
 *
 * Everything any choice claims starts hidden, and the picked ones are put back.
 * Doing it by subtraction rather than by hiding the unpicked is what lets two
 * choices share a part: a deck listed by both "deck and stairs" and "deck,
 * stairs and ramp" stays where it is across the switch, and only the ramp comes
 * and goes.
 */
export function hiddenExteriorNodes(
  slots: ExteriorSlot[],
  selection: ExteriorSelection,
): string[] {
  const revealed = revealedNodes(slots, selection)
  return [...claimedNodes(slots)].filter((path) => !revealed.has(path))
}

/**
 * Which spot an object of the building model belongs to, if any.
 *
 * Used to turn a hover over the building's own geometry into a hover over the
 * spot that owns it — the built-in deck is as clickable as a bought one.
 */
export function slotOfNode(slots: ExteriorSlot[], path: string): ExteriorSlot | null {
  for (const slot of slots) {
    for (const variant of slot.variants) {
      if (variant.nodes.includes(path)) return slot
    }
  }
  return null
}

/** Whether a building offers anything to choose at all. */
export function hasExteriorChoices(slots: ExteriorSlot[]): boolean {
  return slots.some((slot) => slot.variants.length > 1)
}
