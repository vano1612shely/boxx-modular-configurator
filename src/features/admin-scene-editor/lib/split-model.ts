import { Box3, Vector3, type Object3D } from 'three'

/** One object out of a model that holds several, ready to become a `RoomPart`. */
export type ModelPiece = {
  /** Child index of the piece in the model's scene, as a node path. */
  nodePath: string
  /** The name the modeller gave it, which is what the admin will read in the list. */
  name: string
  /**
   * Where this piece stands relative to the model as a whole: across the floor
   * from the model's own footprint centre, and up from its lowest point.
   */
  offset: [number, number, number]
}

/** A piece with nothing to draw — an empty, a helper, a stripped-out camera. */
function measurable(object: Object3D): Box3 | null {
  const box = new Box3().setFromObject(object)
  return box.isEmpty() ? null : box
}

/**
 * The separately-placeable objects of a model, or none if it is a single thing.
 *
 * A kitchen arrives as one file with a fridge, a microwave, a tap and a bin in
 * it, and an admin arranging a room needs to move the microwave without moving
 * the fridge. Splitting it on import gives one entry per object, each carrying
 * the pose the modeller gave it — so the kitchen lands assembled exactly as it
 * was authored and comes apart only where somebody drags it.
 *
 * Split at the scene's own roots, and no deeper. A worktop exported as one
 * object with forty cupboard doors under it is one thing to place, and forty
 * rows in the panel would be worse than useless. A file whose roots are its
 * parts says so by having several; a file with one root is one fitting, and the
 * caller adds it whole.
 *
 * Offsets rather than absolute coordinates, because the caller decides where
 * the set as a whole lands — usually the middle of the room — and every piece
 * has to move with it. Y is measured from the model's underside, not from each
 * piece's own, or a microwave authored on a 0.9 m worktop would arrive on the
 * floor next to it.
 */
export function splitModelPieces(scene: Object3D): ModelPiece[] {
  const roots = scene.children
  if (roots.length < 2) return []

  const measured: Array<{ index: number; object: Object3D; box: Box3 }> = []
  const whole = new Box3()

  roots.forEach((object, index) => {
    const box = measurable(object)
    if (!box) return
    measured.push({ index, object, box })
    whole.union(box)
  })

  if (measured.length < 2) return []

  const centre = whole.getCenter(new Vector3())

  return measured.map(({ index, object, box }) => {
    const own = box.getCenter(new Vector3())
    return {
      nodePath: String(index),
      name: object.name.trim() || `Part ${index + 1}`,
      offset: [own.x - centre.x, box.min.y - whole.min.y, own.z - centre.z],
    }
  })
}
