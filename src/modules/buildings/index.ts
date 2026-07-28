import type { PayloadModule } from '../types'

import { BuildingLines } from './collections/building-lines'
import { BuildingModels } from './collections/building-models'

export const buildingsModule: PayloadModule = {
  collections: [BuildingLines, BuildingModels],
}

export { BuildingLines, BuildingModels }
