import { describe, expect, it } from 'vitest'

import type { FurniturePackageEntity, PackageMember } from '../model/types'
import { groupLayout, groupPieces, isGroup, placedPackage } from './group-members'

function member(over: Partial<PackageMember> & { key: string }): PackageMember {
  return {
    name: null,
    modelUrl: `/api/models/file/${over.key}.glb`,
    x: 0,
    z: 0,
    rotationYDeg: 0,
    footprint: { width: 1, depth: 1 },
    ...over,
  }
}

function pkg(members: PackageMember[]): FurniturePackageEntity {
  return {
    id: 7,
    title: 'Dining set',
    tier: 'Core',
    modelUrl: null,
    fitted: false,
    thumbnailUrl: null,
    price: 1200,
    description: 'A table and four chairs.',
    footprint: { width: 3, depth: 3 },
    compatibleRoomTypes: [],
    recommendedFor: [],
    members,
  }
}

const table = member({ key: 'a', name: 'Table', footprint: { width: 2, depth: 1 } })
const chair = member({ key: 'b', name: 'Chair', x: 0, z: 1, footprint: { width: 0.5, depth: 0.5 } })

describe('isGroup', () => {
  it('is a group once it has a piece in it', () => {
    expect(isGroup(pkg([]))).toBe(false)
    expect(isGroup(pkg([table]))).toBe(true)
  })
})

describe('placedPackage', () => {
  it('is the package itself when the placement names no piece', () => {
    const group = pkg([table])
    expect(placedPackage(group, undefined)).toBe(group)
  })

  it('dresses a piece as a package of its own', () => {
    const piece = placedPackage(pkg([table, chair]), 'b')

    expect(piece?.modelUrl).toBe('/api/models/file/b.glb')
    expect(piece?.title).toBe('Chair')
    expect(piece?.footprint).toEqual({ width: 0.5, depth: 0.5 })
    // The group is what carries the price; a piece that carried one too would
    // be counted a second time in the quote.
    expect(piece?.price).toBeNull()
    // And it is not itself a group, or resolving one would not bottom out.
    expect(piece?.members).toEqual([])
  })

  it('gives each piece an id of its own, so their measurements do not collide', () => {
    const group = pkg([table, chair])
    const first = placedPackage(group, 'a')
    const second = placedPackage(group, 'b')

    expect(first?.id).not.toBe(second?.id)
    expect(first?.id).not.toBe(group.id)
    // Stable, or a drag would remount the model on every frame.
    expect(placedPackage(group, 'a')).toBe(first)
  })

  /**
   * A piece the admin deleted after an order was saved. Nothing rather than the
   * group, which would draw the whole arrangement where one chair used to be.
   */
  it('has nothing to say about a piece the group no longer has', () => {
    expect(placedPackage(pkg([table]), 'gone')).toBeNull()
    expect(placedPackage(undefined, 'a')).toBeNull()
  })
})

describe('groupLayout', () => {
  it('reaches around every piece and finds the middle of them', () => {
    const { footprint, centre } = groupLayout(pkg([table, chair]))

    // 2 wide from the table; from -0.5 to 1.25 deep once the chair is counted.
    expect(footprint).toEqual({ width: 2, depth: 1.75 })
    expect(centre).toEqual({ x: 0, z: 0.375 })
  })

  it('falls back to the footprint on the row when nothing can be measured', () => {
    expect(groupLayout(pkg([])).footprint).toEqual({ width: 3, depth: 3 })
  })
})

describe('groupPieces', () => {
  it('keeps the arrangement, moved to where the group was put', () => {
    const pieces = groupPieces(pkg([table, chair]), { x: 5, z: 2 }, 0)

    expect(pieces).toHaveLength(2)
    // The table sits 0.375 behind the middle, so it lands that far behind the spot.
    expect(pieces[0]).toMatchObject({ memberKey: 'a', x: 5 })
    expect(pieces[0].z).toBeCloseTo(1.625, 6)
    expect(pieces[1]).toMatchObject({ memberKey: 'b', x: 5 })
    expect(pieces[1].z).toBeCloseTo(2.625, 6)
  })

  it('turns the whole arrangement, not each piece where it stands', () => {
    const pieces = groupPieces(pkg([table, chair]), { x: 0, z: 0 }, 90)

    // A quarter turn about Y sends +z to +x, so the chair swings to the side.
    expect(pieces[1].x).toBeCloseTo(0.625, 6)
    expect(pieces[1].z).toBeCloseTo(0, 6)
    // And every piece faces a quarter turn further round than it was drawn.
    expect(pieces[1].rotationYDeg).toBe(90)
  })

  it('adds the group turn to the angle the admin gave a piece', () => {
    const angled = member({ key: 'c', rotationYDeg: 45 })
    expect(groupPieces(pkg([angled]), { x: 0, z: 0 }, 90)[0].rotationYDeg).toBe(135)
  })
})
