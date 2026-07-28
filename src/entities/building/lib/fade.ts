import type { Material, Mesh, Object3D } from 'three'

/**
 * Fading whole subtrees in and out.
 *
 * A wall that vanishes between one frame and the next reads as a glitch; the
 * same wall easing away reads as the room opening up. That is the entire
 * difference, and it is the reason this file exists rather than a `visible`
 * flag.
 */

/**
 * Below this a subtree is switched off — nothing is drawn at an invisible
 * alpha. Generous on purpose: a critically damped fade has a long, invisible
 * tail, and waiting it out is most of what makes a fade feel slow.
 */
const GONE = 0.02
/** At or above this it is solid again, and pays none of transparency's costs. */
const SOLID = 0.98

type Authored = { transparent: boolean; opacity: number; depthWrite: boolean }

/**
 * What each material looked like before anything faded it.
 *
 * A window model's glass is authored transparent, and "restore to opaque" would
 * glaze it over. Weak so a disposed material takes its entry with it.
 */
const authored = new WeakMap<Material, Authored>()

function baseline(material: Material): Authored {
  let base = authored.get(material)
  if (!base) {
    base = {
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
    }
    authored.set(material, base)
  }
  return base
}

/**
 * Applies `opacity` (0…1) to every material under `root`.
 *
 * `transparent` is part of three's shader program key — it compiles to
 * `#define OPAQUE`, which clamps alpha to 1 in the fragment shader — so
 * flipping it without `needsUpdate` produces a material whose opacity nothing
 * honours. It flips at most twice per fade and both variants stay in the
 * program cache, so the cost is two lookups, not two compiles.
 */
export function setTreeOpacity(root: Object3D, opacity: number) {
  root.visible = opacity > GONE
  if (!root.visible) return

  const solid = opacity >= SOLID

  root.traverse((object) => {
    const material = (object as Mesh).material
    if (!material) return

    for (const entry of Array.isArray(material) ? material : [material]) {
      const base = baseline(entry)
      const transparent = base.transparent || !solid

      if (entry.transparent !== transparent) {
        entry.transparent = transparent
        entry.needsUpdate = true
      }
      entry.opacity = solid ? base.opacity : base.opacity * opacity
      // Fading a closed solid with depth writes on makes it hide its own far
      // side in patches. Authored transparency keeps whatever it chose.
      entry.depthWrite = solid ? base.depthWrite : false
    }
  })
}
