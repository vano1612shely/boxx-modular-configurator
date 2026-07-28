import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig, type Plugin } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { collections, globals } from './modules'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const useS3 = Boolean(process.env.S3_BUCKET)

/**
 * Public base URL of the bucket — an R2 public domain, or a CDN in front of it.
 *
 * Optional, and worth setting. Without it Payload serves every upload through
 * itself: a request for a 5 MB building model wakes a serverless function,
 * which streams the object out of the bucket and back to the browser. That is
 * an invocation, its wall-clock time and its bandwidth for a file that never
 * changes. Point this at the bucket and the browser fetches it straight from
 * the CDN instead, and the function is not involved at all.
 *
 * Trailing slash tolerated; the bucket must allow public reads.
 */
const publicBucketUrl = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '')

const servedDirectly = publicBucketUrl
  ? {
      generateFileURL: ({ filename, prefix }: { filename: string; prefix?: string }) =>
        [publicBucketUrl, prefix, filename].filter(Boolean).join('/'),
    }
  : {}

const plugins: Plugin[] = useS3
  ? [
      s3Storage({
        collections: {
          images: servedDirectly,
          models: servedDirectly,
          // Miss this and textures silently stay on the local disk in prod.
          textures: servedDirectly,
        },
        bucket: process.env.S3_BUCKET ?? '',
        config: {
          endpoint: process.env.S3_ENDPOINT,
          region: process.env.S3_REGION ?? 'auto',
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
          },
        },
      }),
    ]
  : []

export default buildConfig({
  admin: {
    user: 'users',
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
    /**
     * Schema changes are applied by MIGRATIONS outside development.
     *
     * Push mode diffs the schema against the live database on boot and alters
     * it in place. That is a good trade while you are drawing collections and a
     * bad one anywhere else: it can decide a rename is a drop, it runs before
     * anyone has looked at what it intends to do, and when it wants consent for
     * data loss it asks on stdin — which a server does not have, so every
     * query simply hangs forever waiting for an answer nobody can give.
     *
     * `pnpm migrate` applies the files in `src/migrations` instead, which are
     * reviewed, ordered and committed.
     */
    push: process.env.NODE_ENV === 'development',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins,
})
