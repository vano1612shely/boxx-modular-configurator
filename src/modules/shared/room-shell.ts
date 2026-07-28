/**
 * Vocabulary shared by the Payload schema and the frontend entity layer.
 *
 * Lives in `modules` (like room-types) because the collection config needs the
 * select options, and `modules` must not import from `entities`.
 */

export const WALL_SIDE_OPTIONS = [
  { label: 'Wall 1', value: 'w1' },
  { label: 'Wall 2', value: 'w2' },
  { label: 'Wall 3', value: 'w3' },
  { label: 'Wall 4', value: 'w4' },
] as const

export type WallSide = (typeof WALL_SIDE_OPTIONS)[number]['value']

export const WALL_SIDES: readonly WallSide[] = WALL_SIDE_OPTIONS.map((option) => option.value)

/**
 * Every surface the generator draws.
 *
 * Not all of them are worth finishing — see `TEXTURED_SURFACE_OPTIONS`. The
 * rest keep a fixed default, which is the whole reason they can stay out of
 * the way: `wallEdge` is white because that white line around a cut wall is
 * what makes the room read as a section, and it would only ever be set to
 * white anyway.
 */
export const SHELL_SURFACES = [
  'wallOuter',
  'wallInner',
  'wallEdge',
  'floor',
  'ceiling',
  'door',
  'window',
] as const

export type ShellSurface = (typeof SHELL_SURFACES)[number]

/**
 * The surfaces a texture can actually be assigned to.
 *
 * The other four were slots nobody could use: the exterior wall face is never
 * on screen (a focused room hides the building, and the walls you can see show
 * you their insides), doors and windows are 3D models now, and "edges, jambs &
 * sills" described a detail of the generator rather than anything to decorate.
 */
export const TEXTURED_SURFACE_OPTIONS = [
  { label: 'Wall — interior face', value: 'wallInner' },
  { label: 'Floor', value: 'floor' },
  { label: 'Ceiling', value: 'ceiling' },
] as const

export type TexturedSurface = (typeof TEXTURED_SURFACE_OPTIONS)[number]['value']

export const TEXTURED_SURFACES: readonly TexturedSurface[] = TEXTURED_SURFACE_OPTIONS.map(
  (option) => option.value,
)

export const OPENING_KIND_OPTIONS = [
  { label: 'Door', value: 'door' },
  { label: 'Window', value: 'window' },
] as const

export type OpeningKind = (typeof OPENING_KIND_OPTIONS)[number]['value']

export const OPENING_KINDS: readonly OpeningKind[] = OPENING_KIND_OPTIONS.map(
  (option) => option.value,
)

/**
 * How a door or window model is sized into the hole the shell cut for it.
 *
 * A frame has to meet the reveal exactly or you see daylight around it, which
 * is why the default distorts rather than preserves proportions.
 */
export const OPENING_FIT_OPTIONS = [
  { label: 'Fill the opening', value: 'stretch' },
  { label: 'Fit inside (keep proportions)', value: 'contain' },
  { label: "Author's size", value: 'none' },
] as const

export type OpeningFit = (typeof OPENING_FIT_OPTIONS)[number]['value']

/**
 * Which way the sun is, as a compass point.
 *
 * A compass point rather than "the wall with the windows": the sun is a fact
 * about the world, not about the room. Two rooms on opposite sides of the same
 * building share a sun, and naming it by wall gave each of them their own.
 */
export const SUN_DIRECTION_OPTIONS = [
  { label: 'North', value: 'n' },
  { label: 'North-east', value: 'ne' },
  { label: 'East', value: 'e' },
  { label: 'South-east', value: 'se' },
  { label: 'South', value: 's' },
  { label: 'South-west', value: 'sw' },
  { label: 'West', value: 'w' },
  { label: 'North-west', value: 'nw' },
] as const

export type SunDirection = (typeof SUN_DIRECTION_OPTIONS)[number]['value']

/**
 * Bearing of each compass point, in degrees clockwise from north.
 *
 * North is -Z and east is +X, the convention glTF exports and three's default
 * camera already agree on.
 */
export const SUN_BEARINGS: Record<SunDirection, number> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
}

/** Sensible starting geometry so a freshly drawn room already looks like one. */
export const SHELL_DEFAULTS = {
  wallHeight: 2.5,
  // Thin on purpose. These are the cut faces you see end-on wherever a wall or
  // a slab has stepped aside, so the number is really "how heavy is the white
  // frame around the room" — and a modular building's panels are thin.
  wallThickness: 0.03,
  floorThickness: 0.03,
  ceilingThickness: 0.03,
  doorWidth: 0.9,
  doorHeight: 2.1,
  windowWidth: 1.2,
  windowHeight: 1.2,
  windowSill: 0.9,
} as const
