import { getPayload } from 'payload'

import config from '@payload-config'

import { regionClauses, whereAll, type RegionScope } from '@/modules/regions/lib/scope'

// Straight at the modules rather than through the slice barrel, which re-exports
// this file: a barrel that imports itself is a cycle waiting to bite.
import { mapFurniturePackage } from '../lib/map-package'
import type { FurniturePackageEntity } from '../model/types'

export async function getPackagesForLine(
  lineId: number,
  region: RegionScope = null,
): Promise<FurniturePackageEntity[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'furniture-packages',
    depth: 1,
    limit: 200,
    where: whereAll([
      {
        or: [
          { compatibleLines: { contains: lineId } },
          { compatibleLines: { exists: false } },
        ],
      },
      ...regionClauses(region),
    ]),
  })

  return result.docs.map(mapFurniturePackage)
}

/**
 * The packages a saved order names, whatever the catalogue has done since.
 *
 * `getPackagesForLine` answers what is on offer, which is the right question
 * while somebody is furnishing a building and the wrong one afterwards: a
 * package whose compatibility was narrowed, or which was moved to another line,
 * would silently disappear from an order that already contains it. So the ones
 * the order asks for are fetched by id, unscoped by region for the same reason
 * the building is.
 *
 * Ids with nothing behind them are reported rather than dropped in silence —
 * the order still lists them, so the page can say why they are not in the scene.
 */
export async function getPackagesByIds(
  ids: number[],
): Promise<{ packages: FurniturePackageEntity[]; missing: number[] }> {
  const wanted = [...new Set(ids)]
  if (wanted.length === 0) return { packages: [], missing: [] }

  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'furniture-packages',
    depth: 1,
    limit: wanted.length,
    where: { id: { in: wanted } },
  })

  // A package whose model file is gone throws in the mapping. One broken row
  // must not blank an order, so it is counted as missing like any other.
  const packages: FurniturePackageEntity[] = []
  const found = new Set<number>()

  for (const doc of result.docs) {
    try {
      packages.push(mapFurniturePackage(doc))
      found.add(doc.id)
    } catch {
      // Left out of `found`, so it lands in `missing` below.
    }
  }

  return { packages, missing: wanted.filter((id) => !found.has(id)) }
}
