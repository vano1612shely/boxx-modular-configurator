/**
 * Uploads the generated entrance models and makes a catalogue entry for each.
 *
 *   node scripts/make-entrance-models.mjs ./demo-models
 *   pnpm exec tsx scripts/seed-entrance-demo.mjs ./demo-models
 *
 * Additive and idempotent: a model or option that is already there by name is
 * left alone, so running it twice does not litter the library.
 */
import 'dotenv/config'

import { join } from 'node:path'

import { getPayload } from 'payload'

import config from '../src/payload.config.ts'

const DIR = process.argv[2] ?? join(process.cwd(), 'demo-models')

const VARIANTS = [
  { file: 'deck-stairs.glb', title: 'Deck and stairs', price: 3200 },
  { file: 'deck-canopy-stairs.glb', title: 'Deck with canopy, and stairs', price: 4600 },
  { file: 'deck-stairs-ramp.glb', title: 'Deck, stairs and ramp', price: 6100 },
  {
    file: 'deck-canopy-stairs-ramp.glb',
    title: 'Deck with canopy, stairs and ramp',
    price: 7500,
  },
]

const payload = await getPayload({ config })

for (const variant of VARIANTS) {
  const existingModel = await payload.find({
    collection: 'models',
    where: { title: { equals: variant.title } },
    limit: 1,
  })

  const model =
    existingModel.docs[0] ??
    (await payload.create({
      collection: 'models',
      data: { title: variant.title },
      filePath: join(DIR, variant.file),
    }))

  const existingOption = await payload.find({
    collection: 'exterior-options',
    where: { title: { equals: variant.title } },
    limit: 1,
  })

  if (existingOption.docs.length > 0) {
    console.log(`kept    ${variant.title}`)
    continue
  }

  await payload.create({
    collection: 'exterior-options',
    data: {
      title: variant.title,
      price: variant.price,
      description: 'Demo geometry — stands in for the supplier asset.',
      parts: [{ model: model.id, position: { x: 0, y: 0, z: 0 }, yawDeg: 0, scale: 1 }],
    },
  })

  console.log(`added   ${variant.title}`)
}

console.log('\nCatalog → Exterior Options now has the four combinations.')
process.exit(0)
