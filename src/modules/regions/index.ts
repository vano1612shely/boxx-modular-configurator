import type { PayloadModule } from '../types'

import { Regions } from './collections/regions'

export const regionsModule: PayloadModule = {
  collections: [Regions],
}

export { Regions }

// `./lib/scope` is deliberately NOT re-exported here — see the note in
// `modules/settings/index.ts`. It reaches `@payload-config`, which comes back
// through `modules/index.ts`, and that cycle throws depending only on which
// import a bundle reaches first. Import the leaf directly.
