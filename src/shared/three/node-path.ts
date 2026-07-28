import type { Object3D } from 'three'

/**
 * Addressing model objects by their position in the loaded glb hierarchy.
 *
 * A path is the chain of child indexes from the scene root — "2/0/5". Indexes
 * (not names) because glb node names are neither unique nor stable across
 * re-exports, while the child order is part of the file.
 *
 * These helpers are deliberately free of any scene-editing concern: they are
 * the picker and resolver the admin outliner and the hidden-node list are
 * built on, and they outlive whatever geometry system uses them.
 */

/** Resolves a "2/0/5" child-index path back to the Object3D under `root`. */
export function resolveNodePath(root: Object3D, path: string): Object3D | null {
  let current: Object3D | undefined = root
  for (const part of path.split('/')) {
    const index = Number(part)
    if (!Number.isInteger(index)) return null
    current = current?.children[index]
    if (!current) return null
  }
  return current
}

/** Memoized path → Object3D resolver for one loaded model. */
export function createNodeResolver(root: Object3D): (path: string) => Object3D | null {
  const cache = new Map<string, Object3D | null>()
  return (path) => {
    if (!cache.has(path)) cache.set(path, resolveNodePath(root, path))
    return cache.get(path) ?? null
  }
}

/**
 * Child-index path of `object` relative to `root`.
 *
 * `virtualPathOf` lets a caller short-circuit the walk for objects that are
 * not part of the original hierarchy — generated geometry that stands in for a
 * real node and answers to its own address. Without it the walk is pure.
 */
export function nodePathOf(
  root: Object3D,
  object: Object3D,
  virtualPathOf?: (object: Object3D) => string | null,
): string | null {
  const parts: number[] = []
  let current: Object3D | null = object
  while (current && current !== root) {
    const virtual = virtualPathOf?.(current) ?? null
    if (virtual !== null) return virtual
    const parent: Object3D | null = current.parent
    if (!parent) return null
    parts.unshift(parent.children.indexOf(current))
    current = parent
  }
  return current === root ? parts.join('/') : null
}

/** True when the object and every ancestor are visible (raycast hits on
 * meshes inside hidden groups must not count as clickable). */
export function isTreeVisible(object: Object3D): boolean {
  let current: Object3D | null = object
  while (current) {
    if (current.visible === false) return false
    current = current.parent
  }
  return true
}
