import type { PayloadModule } from '../types'

import { Users } from './collections/users'

export const usersModule: PayloadModule = {
  collections: [Users],
}

export { Users }
