import type { PayloadModule } from '../types'

import { DisplaySettings } from './globals/display-settings'

export const settingsModule: PayloadModule = {
  globals: [DisplaySettings],
}

export { DisplaySettings }
