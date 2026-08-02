import type { Material, Mesh, Object3D } from 'three'

/** Opacity below which the subtree is switched off entirely. */
const GONE = 0.02
/** Opacity at or above which the subtree is treated as fully opaque again. */
const SOLID = 0.98

type Authored = { transparent: boolean; opacity: number; depthWrite: boolean }

// Authored transparency must survive a fade: glass restored to "opaque" glazes over.
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

// three bakes `transparent` into the shader program key (#define OPAQUE clamps
// alpha to 1), so toggling it requires needsUpdate or opacity is ignored.
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
      // Depth writes during a fade make a closed solid hide its own far side.
      entry.depthWrite = solid ? base.depthWrite : false
    }
  })
}
