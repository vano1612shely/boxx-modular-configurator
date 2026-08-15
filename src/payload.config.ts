import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { collections, globals } from './modules'

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
