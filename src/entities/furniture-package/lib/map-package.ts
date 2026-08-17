import { roomTypeSlug } from '@/modules/shared/room-types'
import type { FurniturePackage, Image, Model } from '@/payload-types'
import { assetUrl } from '@/shared/lib'

import type { FurniturePackageEntity } from '../model/types'

/** The keys of a list of room types, dropping any that came back as bare ids. */
function slugs(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(roomTypeSlug).filter((slug): slug is string => slug !== null)
}

function modelUrl(value: number | Model): string {
  const url = typeof value === 'number' ? null : assetUrl(value)
  if (!url) {
    throw new Error('Expected populated furniture package model — fetch with depth >= 1.')
  }
  return url
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
