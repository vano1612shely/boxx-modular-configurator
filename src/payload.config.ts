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

/** Public bucket/CDN base URL; the bucket must allow public reads. */
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
          // Miss one and that collection silently keeps writing to local disk.
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
    // Push mode asks for consent to data loss on stdin, which a server does not have,
    // and hangs; outside development schema changes go through `pnpm migrate`.
    push: process.env.NODE_ENV === 'development',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins,
})
