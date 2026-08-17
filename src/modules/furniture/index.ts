import type { PayloadModule } from '../types'

import { FurniturePackages } from './collections/furniture-packages'
import { FurnitureTiers } from './collections/furniture-tiers'

export const furnitureModule: PayloadModule = {
  collections: [FurniturePackages, FurnitureTiers],
}

export { FurniturePackages, FurnitureTiers }
