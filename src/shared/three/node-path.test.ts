import { Group, Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import { createNodeResolver, isTreeVisible, nodePathOf, resolveNodePath } from './node-path'

function tree() {
  const root = new Group()
  const a = new Group()
  const b = new Mesh()
  const c = new Mesh()
  root.add(a)
  a.add(b)
  a.add(c)
  return { root, a, b, c }
}

describe('resolveNodePath', () => {
  it('resolves child-index paths produced by the outliner', () => {
    const { root, a, c } = tree()

    expect(resolveNodePath(root, '0')).toBe(a)
    expect(resolveNodePath(root, '0/1')).toBe(c)
    expect(resolveNodePath(root, '0/1/0')).toBeNull()
    expect(resolveNodePath(root, '5')).toBeNull()
    expect(resolveNodePath(root, 'x/y')).toBeNull()
  })
})

describe('createNodeResolver', () => {
  it('caches misses as well as hits', () => {
    const { root, c } = tree()
    const resolve = createNodeResolver(root)

    expect(resolve('0/1')).toBe(c)
    expect(resolve('0/1')).toBe(c)
    expect(resolve('9')).toBeNull()
    expect(resolve('9')).toBeNull()
  })
})

describe('nodePathOf', () => {
  it('round-trips with resolveNodePath', () => {
    const { root, b, c } = tree()

    expect(nodePathOf(root, b)).toBe('0/0')
    expect(nodePathOf(root, c)).toBe('0/1')
    expect(resolveNodePath(root, nodePathOf(root, c)!)).toBe(c)
  })

  it('returns an empty path for the root itself', () => {
    const { root } = tree()

    expect(nodePathOf(root, root)).toBe('')
  })

  it('returns null for an object outside the tree', () => {
    const { root } = tree()

    expect(nodePathOf(root, new Mesh())).toBeNull()
  })

  it('short-circuits to a virtual path when the callback claims an ancestor', () => {
    const { root, a, b } = tree()
    const virtualPathOf = (object: unknown) => (object === a ? '7@a' : null)

    expect(nodePathOf(root, b, virtualPathOf)).toBe('7@a')
    expect(nodePathOf(root, b)).toBe('0/0')
  })
})

describe('isTreeVisible', () => {
  it('is false when any ancestor is hidden', () => {
    const { a, b } = tree()

    expect(isTreeVisible(b)).toBe(true)
    a.visible = false
    expect(isTreeVisible(b)).toBe(false)
  })
})
