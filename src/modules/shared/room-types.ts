/**
 * What a room is for, as the app handles it: a key, and nothing known ahead.
 *
 * It used to be a union of eight words fixed in the code, which the compiler
 * checked. That check is gone on purpose — the list lives in the `room-types`
 * collection now, so a new kind of room is a row an admin adds rather than a
 * deploy. Nothing branches on a particular type anywhere; they are only ever
 * compared, so the app does not need to know them.
 */
export type RoomType = string

/**
 * The list every install starts with, and the one the old fixed set became.
 *
 * Only used to fill an empty catalogue — the migration writes these rows and
 * the seed asks for them by key. Once they are in the collection this is not
 * consulted again, and editing a name here changes nothing.
 */
export const STARTER_ROOM_TYPES = [
  { name: 'Office', slug: 'office' },
  { name: 'Classroom', slug: 'classroom' },
  { name: 'Conference', slug: 'conference' },
  { name: 'Kitchen', slug: 'kitchen' },
  { name: 'Restroom', slug: 'restroom' },
  { name: 'Lounge', slug: 'lounge' },
  { name: 'Hallway', slug: 'hallway' },
  { name: 'Other', slug: 'other' },
] as const

/** The same, for the grades a furniture package is offered at. */
export const STARTER_FURNITURE_TIERS = [
  { name: 'Core', slug: 'core' },
  { name: 'Plus', slug: 'plus' },
] as const

/**
 * The key of a room type however it arrives — a bare id, or populated.
 *
 * Documents are read one level deep, which populates these, but a write that
 * has not been read back holds only the id. An id alone cannot be resolved to
 * a key here, and null is the honest answer: it means "no type", which every
 * caller already has to handle.
 */
export function roomTypeSlug(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null

  const slug = (value as { slug?: unknown }).slug
  return typeof slug === 'string' ? slug : null
}
