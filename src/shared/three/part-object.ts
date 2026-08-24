import type { Object3D } from 'three'

import { centreOnFootprint, type ModelBounds } from './centre-model'
import { createNodeResolver } from './node-path'

export type PartObject = {
  /** A clone, ready to place: centred on its footprint and standing on zero. */
  object: Object3D
  bounds: ModelBounds
}

/**
 * A fitting's own geometry, taken out of the model it was imported from.
 *
 * `nodePath` null takes the file whole, which is what a single-object model is.
 * A path takes one object out of a file that holds several — a fridge out of a
 * kitchen — and is how a set imported from one glb comes apart into pieces that
 * move independently.
 *
 * Shared rather than repeated, because three separate places need exactly this
 * and getting one of them wrong is invisible until it is on screen: the room
 * draws fittings, the editor draws them again with handles on, and the
 * placement feature measures them to stop furniture walking through them. When
 * only the first of those learned about paths, every piece of a nine-piece
 * kitchen drew the whole kitchen, nine times over, in the editor.
 *
 * Returns null when the path does not resolve. Falling back to the whole file
 * would put an entire kitchen where one microwave belongs, once per piece.
 */
export function partObject(scene: Object3D, nodePath: string | null): PartObject | null {
  const source = nodePath ? createNodeResolver(scene)(nodePath) : scene
  if (!source) return null

  const clone = source.clone(true)
  const bounds = centreOnFootprint(clone)
  // Its own base to zero, so a part's height is read from the room's floor
  // rather than from wherever the exporter left this object.
  clone.position.y -= bounds.baseY

  return { object: clone, bounds }
}
