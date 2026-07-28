import type { PayloadModule } from '../types'

import { FurniturePackages } from './collections/furniture-packages'

export const furnitureModule: PayloadModule = {
  collections: [FurniturePackages],
}

export { FurniturePackages }
