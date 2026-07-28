import type { PayloadModule } from '../types'

import { Regions } from './collections/regions'

export const regionsModule: PayloadModule = {
  collections: [Regions],
}

export { Regions }
