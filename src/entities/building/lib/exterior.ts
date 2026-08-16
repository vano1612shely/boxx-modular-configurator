import type { ExteriorSlot, ExteriorVariant, Vec3Tuple } from '../model/types'

/** What the visitor has picked, by spot key. Missing means the spot's default. */
export type ExteriorSelection = Record<string, string>

/**
 * The choice in force at a spot, or null at one with nothing to choose from.
 *
 * A selection naming a variant that no longer exists falls back to the default
 * rather than leaving the spot showing nothing.
 *
 * Null is reachable only where a spot is being built: the mapping drops empty
 * ones, so the client never sees one. It is answered for anyway because the
 * editor reads the draft directly, and a spot has no choices for as long as it
 * takes to add the first — which was long enough to crash on.
 */
export function selectedVariant(
  slot: ExteriorSlot,
  selection: ExteriorSelection,
): ExteriorVariant | null {
  const key = selection[slot.key]
  const picked = key === undefined ? undefined : slot.variants.find((v) => v.key === key)
  if (picked) return picked

  return slot.variants.find((v) => v.key === slot.defaultVariantKey) ?? slot.variants[0] ?? null
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
    for (const path of selectedVariant(slot, selection)?.nodes ?? []) revealed.add(path)
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

/**
 * Metres the eye stands back from a spot, how high, and where it looks.
 *
 * Ten back rather than nearer: a deck with a ramp running off it spans eight or
 * nine metres, and at the authored 50° field of view anything closer cuts the
 * far end off — which is the half a visitor asked to see.
 */
const VIEW_BACK = 10
const VIEW_UP = 3
const VIEW_TARGET_UP = 1.1

/**
 * Where to stand to look at an entrance: outside it, near eye level.
 *
 * Which way is "outside" is worked out rather than authored — from the building
 * towards the spot, since a spot is by definition out on the edge of one.
 * Deriving it means there is no facing to set and none to get wrong, and it
 * cannot fall out of date when the spot is dragged round to another wall. With
 * no building to measure from, +Z: a guess, but a stable one.
 */
export function entranceView(
  slot: ExteriorSlot,
  buildingCentre: { x: number; z: number } | null,
): { position: Vec3Tuple; target: Vec3Tuple } {
  const [x, y, z] = slot.position

  const outX = buildingCentre ? x - buildingCentre.x : 0
  const outZ = buildingCentre ? z - buildingCentre.z : 1
  const reach = Math.hypot(outX, outZ)
  // A spot sitting exactly on the centre gives no direction to face it from.
  const [dirX, dirZ] = reach < 1e-6 ? [0, 1] : [outX / reach, outZ / reach]

  return {
    position: [x + dirX * VIEW_BACK, y + VIEW_UP, z + dirZ * VIEW_BACK],
    target: [x, y + VIEW_TARGET_UP, z],
  }
}
