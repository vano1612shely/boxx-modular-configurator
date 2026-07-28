import type { PayloadModule } from '../types'

import { Images } from './collections/images'
import { Models } from './collections/models'
import { Textures } from './collections/textures'

export const mediaModule: PayloadModule = {
  collections: [Images, Models, Textures],
}

export { Images, Models, Textures }
