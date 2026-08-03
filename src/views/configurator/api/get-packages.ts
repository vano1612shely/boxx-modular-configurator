import { getPayload } from 'payload'

import config from '@payload-config'

import { mapFurniturePackage, type FurniturePackageEntity } from '@/entities/furniture-package'

import { regionClauses, whereAll, type RegionScope } from './regions'

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
