import type { PayloadModule } from '../types'

import { BuildingLines } from './collections/building-lines'
import { BuildingModels } from './collections/building-models'
import { ExteriorOptions } from './collections/exterior-options'
import { RoomTypes } from './collections/room-types'

export const buildingsModule: PayloadModule = {
  collections: [BuildingLines, BuildingModels, RoomTypes, ExteriorOptions],
}

export { BuildingLines, BuildingModels, RoomTypes, ExteriorOptions }
