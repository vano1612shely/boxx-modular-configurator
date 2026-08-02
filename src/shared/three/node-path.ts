import type { Object3D } from 'three'

// A path is a chain of child indexes from the root ("2/0/5"): glb node names are
// neither unique nor stable across re-exports, child order is.
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

export function createNodeResolver(root: Object3D): (path: string) => Object3D | null {
  const cache = new Map<string, Object3D | null>()
  return (path) => {
    if (!cache.has(path)) cache.set(path, resolveNodePath(root, path))
    return cache.get(path) ?? null
  }
}

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

export function isTreeVisible(object: Object3D): boolean {
  let current: Object3D | null = object
  while (current) {
    if (current.visible === false) return false
    current = current.parent
  }
  return true
}
