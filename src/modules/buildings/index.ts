import type { PayloadModule } from '../types'

import { BuildingLines } from './collections/building-lines'
import { BuildingModels } from './collections/building-models'
import { ExteriorOptions } from './collections/exterior-options'

export const buildingsModule: PayloadModule = {
  collections: [BuildingLines, BuildingModels, ExteriorOptions],
}

export { BuildingLines, BuildingModels, ExteriorOptions }
