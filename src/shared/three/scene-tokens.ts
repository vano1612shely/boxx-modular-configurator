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
  /**
   * The inverted-hull outline is thick enough to read as a silhouette, so ink
   * looked like a hole cut around the furniture rather than a highlight.
   * Cherry is the brand's own "this one" colour and stays legible against the
   * warm neutrals every room is built from.
   */
  selected: BOXX.cherry,
  /** Far enough from cherry in hue to survive being seen next to it mid-drag. */
  blocked: BOXX.mango,
  /** Warm grey, so the drag ghost belongs to the same family as the ground. */
  ghost: '#a7a29a',
} as const
