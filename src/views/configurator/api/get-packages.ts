import { getPayload } from 'payload'

import config from '@payload-config'

import { mapFurniturePackage, type FurniturePackageEntity } from '@/entities/furniture-package'

export async function getPackagesForLine(lineId: number): Promise<FurniturePackageEntity[]> {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'furniture-packages',
    depth: 1,
    limit: 200,
    where: {
      or: [
        { compatibleLines: { contains: lineId } },
        { compatibleLines: { exists: false } },
      ],
    },
  })

  return result.docs.map(mapFurniturePackage)
}
