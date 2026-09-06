import { groupBounds } from '@/shared/lib'

import type { FurniturePackageEntity, PackageFootprint, PackageMember } from '../model/types'

/** A package made of several pieces rather than of one model. */
export function isGroup(pkg: FurniturePackageEntity): boolean {
  return pkg.members.length > 0
}

/**
 * Ids for the pieces, minted here and never written down.
 *
 * The measured footprint and the measured shape of a model are both cached
 * against a package id, and a group's pieces need one each or they would share
 * the group's — every chair answering with the table's outline. The id only has
 * to outlive those caches, which live in this tab, so it is invented on demand
 * rather than stored: what a *saved order* names is the group's real id plus the
 * piece's own key, which Payload keeps.
 *
 * Kept clear of real ids by a wide margin. Package ids are database serials, and
 * a catalogue would have to reach a billion rows before the two could meet.
 */
const PIECE_ID_BASE = 1_000_000_000

const pieceIds = new Map<string, number>()
let minted = 0

function pieceId(packageId: number, memberKey: string): number {
  const key = `${packageId}:${memberKey}`
  const existing = pieceIds.get(key)
  if (existing !== undefined) return existing

  const id = PIECE_ID_BASE + minted++
  pieceIds.set(key, id)
  return id
}

/**
 * A piece of a group, dressed as a package.
 *
 * The whole point of this file. Everything downstream of a placement — the drag,
 * the collision tests, the clamp to the room, the ghost, the toolbar — asks the
 * same question, "which package is this?", and gets a `FurniturePackageEntity`
 * back. Handing it one of these means a piece of a group travels through all of
 * it unchanged, and none of that code has to learn what a group is.
 *
 * It carries no price: a group is sold once, by the row the visitor pressed, and
 * a piece that also carried one would be counted again in the quote.
 */
export function memberPackage(
  pkg: FurniturePackageEntity,
  member: PackageMember,
): FurniturePackageEntity & { modelUrl: string } {
  return {
    ...pkg,
    id: pieceId(pkg.id, member.key),
    title: member.name ?? pkg.title,
    modelUrl: member.modelUrl,
    price: null,
    description: null,
    footprint: member.footprint,
    // A piece is not itself a group, or resolving one would never bottom out.
    members: [],
  }
}

/**
 * Memoised, because the object identity is a prop.
 *
 * A new object every render would remount the piece's model on every frame of a
 * drag. Keyed by the model's URL as well as the piece, so replacing the file —
 * which stamps a new URL — is noticed.
 */
const built = new Map<string, FurniturePackageEntity & { modelUrl: string }>()

export function memberPackageCached(
  pkg: FurniturePackageEntity,
  member: PackageMember,
): FurniturePackageEntity & { modelUrl: string } {
  const key = `${pkg.id}:${member.key}:${member.modelUrl}`
  const existing = built.get(key)
  if (existing) return existing

  const made = memberPackage(pkg, member)
  built.set(key, made)
  return made
}

/**
 * What a placement is actually standing on the floor: a package, or one piece.
 *
 * The single place that answers it. `memberKey` is set only on a placement that
 * came from a group, and a key that no longer names anything — a piece the admin
 * deleted after an order was saved — resolves to nothing rather than to the
 * group, which would draw the whole arrangement where one chair used to be.
 */
export function placedPackage(
  pkg: FurniturePackageEntity | undefined,
  memberKey: string | null | undefined,
): FurniturePackageEntity | null {
  if (!pkg) return null
  if (!memberKey) return pkg

  const member = pkg.members.find((piece) => piece.key === memberKey)
  return member ? memberPackageCached(pkg, member) : null
}

/**
 * Where a group sits in its own frame: how much floor it wants, and its middle.
 *
 * Read off the pieces rather than off the row's own footprint, which is measured
 * on save and can be a moment behind what the arranger is showing. The same
 * `groupBounds` the server measures with, so the two cannot drift apart.
 */
export function groupLayout(pkg: FurniturePackageEntity): {
  footprint: PackageFootprint
  centre: { x: number; z: number }
} {
  const measured = groupBounds(pkg.members)
  return measured ?? { footprint: pkg.footprint, centre: { x: 0, z: 0 } }
}

/** Where one piece lands, and which way it faces, once the group is put down. */
export type GroupPiece = {
  memberKey: string
  x: number
  z: number
  rotationYDeg: number
}

/**
 * The group laid out around `at`, turned as a whole by `rotationYDeg`.
 *
 * Every piece keeps its place in the arrangement, so a group dropped into a
 * narrow room sideways is still a table with its chairs around it and not a
 * table with its chairs somewhere else. The turn is the one the placement search
 * settled on; each piece carries it on top of the angle the admin gave it.
 */
export function groupPieces(
  pkg: FurniturePackageEntity,
  at: { x: number; z: number },
  rotationYDeg: number,
): GroupPiece[] {
  const { centre } = groupLayout(pkg)
  const radians = (rotationYDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return pkg.members.map((member) => {
    const offsetX = member.x - centre.x
    const offsetZ = member.z - centre.z

    return {
      memberKey: member.key,
      // Turned about Y the way three.js turns the pieces themselves, so the
      // arrangement the admin drew is what appears at any angle.
      x: at.x + offsetX * cos + offsetZ * sin,
      z: at.z - offsetX * sin + offsetZ * cos,
      rotationYDeg: member.rotationYDeg + rotationYDeg,
    }
  })
}
