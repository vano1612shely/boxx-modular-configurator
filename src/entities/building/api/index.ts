/**
 * The slice's server entry, kept apart from its main one on purpose.
 *
 * Everything in here reaches for `@payload-config`, and the slice's other half
 * is imported by components that run in the browser — `SceneViewer`,
 * `PlacedPackages`, the header. Re-exporting these through the same barrel put
 * the whole Payload config on the far side of a `'use client'` boundary, which
 * is a bundle nobody asked for and, sooner or later, a build that will not.
 *
 * So: `@/entities/building` for anything drawn, `@/entities/building/api` for
 * anything fetched. Both are public entries of the slice.
 */
export {
  getBuildingScene,
  getBuildingSceneById,
  type BuildingResolution,
} from './get-building-scene'
