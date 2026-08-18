import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { collections, globals } from './modules'
import { ensureCatalogueTerms } from './modules/shared/catalogue-terms'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    components: {
      // Paths, not imports: Payload resolves these through the generated import
      // map, so anything added here needs `pnpm generate:importmap` to follow.
      graphics: {
        Logo: '/modules/shared/admin/BoxxLogo#BoxxLogo',
        Icon: '/modules/shared/admin/BoxxIcon#BoxxIcon',
      },
    },
    meta: {
      titleSuffix: ' · BOXX Modular',
      icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/favicon.svg' }],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections,
  globals,
  // The room types and furniture tiers that used to be lists in the code.
  // A development database has the schema pushed to it rather than migrated,
  // so it gets the tables with nothing in them; a fresh clone gets neither.
  // Made here, so they are there however the database came to exist.
  onInit: async (payload) => {
    try {
      await ensureCatalogueTerms(payload)
    } catch (error) {
      // The CLI boots Payload to run the very migration that makes these
      // tables, so on a new database this fails once and must not be fatal.
      const why = error instanceof Error ? error.message : String(error)
      payload.logger.warn(`Catalogue terms not written yet: ${why}`)
    }
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Push mode asks for consent to data loss on stdin, which a server does not have,
    // and hangs; outside development schema changes go through `pnpm migrate`.
    push: process.env.NODE_ENV === 'development',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
})
