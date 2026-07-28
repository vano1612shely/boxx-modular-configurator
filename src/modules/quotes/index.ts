import type { PayloadModule } from '../types'

import { Quotes } from './collections/quotes'
import { IntegrationSettings } from './globals/integration-settings'

export const quotesModule: PayloadModule = {
  collections: [Quotes],
  globals: [IntegrationSettings],
}

export { Quotes, IntegrationSettings }
