import type { PayloadModule } from '../types'

import { ConfiguratorSettings } from './globals/configurator-settings'

export const settingsModule: PayloadModule = {
  globals: [ConfiguratorSettings],
}

export { ConfiguratorSettings }

// `./lib/read-settings` is deliberately NOT re-exported here. It imports
// `@payload-config`, which imports this barrel back through `modules/index.ts`
// — and that file names `settingsModule` at module scope, so entering the cycle
// from this end throws "Cannot access 'settingsModule' before initialization".
// Whether it does depends on which import a bundle happens to reach first,
// which is not a thing to leave to luck. Import the leaf directly.
