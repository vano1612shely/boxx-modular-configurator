import { roomTypeSlug } from '@/modules/shared/room-types'
import type { FurniturePackage, Image, Model } from '@/payload-types'
import { assetUrl } from '@/shared/lib'

import type { FurniturePackageEntity } from '../model/types'

/** The keys of a list of room types, dropping any that came back as bare ids. */
function slugs(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(roomTypeSlug).filter((slug): slug is string => slug !== null)
}

/**
 * The package's own model, or null when it has none.
 *
 * A bare id rather than a document means the caller fetched at depth 0, which
 * is a mistake worth shouting about — but an empty field is not: a fitted
 * package is arranged on the room and has nothing of its own to draw.
 */
function modelUrl(value: number | Model | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    throw new Error('Expected populated furniture package model — fetch with depth >= 1.')
  }
  return assetUrl(value)
}

function thumbnailUrl(value: number | Image | null | undefined): string | null {
  if (!value || typeof value === 'number') return null
  return assetUrl(value)
}

export function mapFurniturePackage(doc: FurniturePackage): FurniturePackageEntity {
  return {
    id: doc.id,
    title: doc.title,
    // The name as the admin wrote it, not the key: this one is only ever read
    // off the card, so "Core" beats "core".
    tier: typeof doc.tier === 'object' && doc.tier ? doc.tier.name : null,
    modelUrl: modelUrl(doc.model),
    fitted: doc.fitted === true,
    thumbnailUrl: thumbnailUrl(doc.thumbnail),
    price: doc.price ?? null,
    description: doc.description ?? null,
    footprint: {
      width: doc.footprint?.width ?? 1,
      depth: doc.footprint?.depth ?? 1,
    },
    compatibleRoomTypes: slugs(doc.compatibleRoomTypes),
    recommendedFor: slugs(doc.recommendedFor),
  }
}
