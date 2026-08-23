import { Box3, Vector3, type Object3D } from 'three'

export type ModelBounds = {
  width: number
  depth: number
  height: number
  /** Where the underside sits once the object is centred. Zero for a well-made model. */
  baseY: number
  /** Where the middle was before it was moved — where the thing actually stands. */
  centreX: number
  centreZ: number
}

/**
 * Puts the middle of an object's footprint over its own origin.
 *
 * Every placement in this app names the middle of a thing rather than whatever
 * corner its modeller happened to export it around — the drag clamps, the
 * collision tests and the saved coordinates all assume it — so a model has to
 * be moved onto that convention once, before anything measures or places it.
 *
 * Y is left where it is, and reported instead. A package stands on the floor
 * and its base is already there; a fitting is given a height above the floor
 * and wants its base pinned to zero first, or typing 0.9 for a microwave would
 * land it 0.9 above wherever its exporter left it.
 */
export function centreOnFootprint(object: Object3D): ModelBounds {
  const bounds = new Box3().setFromObject(object)
  if (bounds.isEmpty()) {
    return { width: 0, depth: 0, height: 0, baseY: 0, centreX: 0, centreZ: 0 }
  }

  const size = bounds.getSize(new Vector3())
  const centre = bounds.getCenter(new Vector3())

  object.position.x -= centre.x
  object.position.z -= centre.z

  return {
    width: size.x,
    depth: size.z,
    height: size.y,
    baseY: bounds.min.y,
    centreX: centre.x,
    centreZ: centre.z,
  }
}
