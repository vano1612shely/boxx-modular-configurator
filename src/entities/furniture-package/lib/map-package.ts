import type { FurniturePackage, Image, Model } from '@/payload-types'

import type { FurniturePackageEntity } from '../model/types'

function modelUrl(value: number | Model): string {
  if (typeof value === 'number' || !value.url) {
    throw new Error('Expected populated furniture package model — fetch with depth >= 1.')
  }
  return value.url
}

function thumbnailUrl(value: number | Image | null | undefined): string | null {
  if (!value || typeof value === 'number') return null
  return value.url ?? null
}

export function mapFurniturePackage(doc: FurniturePackage): FurniturePackageEntity {
  return {
    id: doc.id,
    title: doc.title,
    family: doc.family,
    tier: doc.tier,
    modelUrl: modelUrl(doc.model),
    thumbnailUrl: thumbnailUrl(doc.thumbnail),
    price: doc.price ?? null,
    description: doc.description ?? null,
    footprint: {
      width: doc.footprint?.width ?? 1,
      depth: doc.footprint?.depth ?? 1,
    },
    compatibleRoomTypes: doc.compatibleRoomTypes ?? [],
  }
}
