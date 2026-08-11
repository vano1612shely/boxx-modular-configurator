import type { PayloadModule } from '../types'

import { ConfiguratorSettings } from './globals/configurator-settings'

export const settingsModule: PayloadModule = {
  globals: [ConfiguratorSettings],
}

export { ConfiguratorSettings }
