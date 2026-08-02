export const WALL_SIDE_OPTIONS = [
  { label: 'Wall 1', value: 'w1' },
  { label: 'Wall 2', value: 'w2' },
  { label: 'Wall 3', value: 'w3' },
  { label: 'Wall 4', value: 'w4' },
] as const

export type WallSide = (typeof WALL_SIDE_OPTIONS)[number]['value']

export const WALL_SIDES: readonly WallSide[] = WALL_SIDE_OPTIONS.map((option) => option.value)

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

export const OPENING_FIT_OPTIONS = [
  { label: 'Fill the opening', value: 'stretch' },
  { label: 'Fit inside (keep proportions)', value: 'contain' },
  { label: "Author's size", value: 'none' },
] as const

export type OpeningFit = (typeof OPENING_FIT_OPTIONS)[number]['value']

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

/** Degrees clockwise from north; north is -Z, east is +X. */
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

export const SHELL_DEFAULTS = {
  wallHeight: 2.5,
  wallThickness: 0.03,
  floorThickness: 0.03,
  ceilingThickness: 0.03,
  doorWidth: 0.9,
  doorHeight: 2.1,
  windowWidth: 1.2,
  windowHeight: 1.2,
  windowSill: 0.9,
} as const
