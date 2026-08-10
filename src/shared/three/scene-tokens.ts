/**
 * The BOXX palette as three.js needs it.
 *
 * Hex, not `getComputedStyle`: reading the CSS variables at mount returns
 * nothing during SSR and shows a first frame in the fallback colour on the
 * largest surface in the product. `scene-tokens.test.ts` parses globals.css and
 * asserts every value here still matches its `--boxx-*` declaration, so the two
 * cannot drift apart silently.
 *
 * R3F applies ACESFilmicToneMapping by default, so a brand colour on a *lit*
 * material will not be this hex on screen. Anything that has to land exactly —
 * outlines, cut faces, diagram lines — must be a MeshBasicMaterial with
 * `toneMapped: false`.
 */
export const BOXX = {
  cherry: '#a80030',
  cherryDeep: '#812718',
  gold: '#cec09c',
  mango: '#ffaa2f',
  ink: '#131211',
  sand: '#f9f7f4',
  sandDeep: '#f4efe8',
  surface: '#ffffff',
  danger: '#a90f1c',
} as const

/** The canvas clear colour is the iframe seam — it must equal `--background`. */
export const SCENE_BACKGROUND = BOXX.sand

/** Colour of a wall sliced open by the overview clip plane. */
export const CUT_FACE = BOXX.sandDeep

export const HIGHLIGHT = {
  /** Warm and quiet: selection is the state you are in most of the time. */
  selected: BOXX.mango,
  /** Red is what "this will not fit" is expected to look like. */
  blocked: BOXX.cherry,
  /** Warm grey, so the drag ghost belongs to the same family as the ground. */
  ghost: '#a7a29a',
} as const

/**
 * Floor tints for the zones of one room.
 *
 * Laid on the floor at a tenth of their strength, so they read as areas rather
 * than as paint. Distinguishable rather than harmonious — telling the kitchen
 * half from the conference half at a glance is the whole job — but kept off the
 * brand's own cherry and mango, which already mean "selected" and "blocked".
 * A zone is handed the first one nobody in its room has taken, so no two are
 * alike and the colour stays put between saves.
 */
export const ZONE_TINTS = [
  '#3b82f6',
  '#10b981',
  '#a855f7',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#6366f1',
] as const
