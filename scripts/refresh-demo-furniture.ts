import 'dotenv/config'

import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'
import {
  buildConferenceCorePackage,
  buildOfficeCorePackage,
  buildTaskChairPackage,
} from '../src/seed/lib/build-demo-assets'
import { ensureCatalogueTerms } from '../src/modules/shared/catalogue-terms'

/**
 * Brings the demo furniture up to date with the builders, on a database that has
 * already been seeded.
 *
 * `pnpm seed` stops as soon as it finds the base catalogue, which is right — it
 * is there to fill an empty database, not to overwrite a populated one. But the
 * demo desk and conference table were solid blocks from the floor up, and the
 * collision test now measures what a model really fills, so on those there is
 * nothing to push a chair under and nothing to see. This replaces just their
 * files, in place, and adds the single chair that was missing.
 *
 * Idempotent: run it as often as you like. It only ever replaces a file the
 * seed itself wrote — anything uploaded through the admin is left alone, so
 * pointing this at a real catalogue does nothing rather than something awful.
 */
async function upload(payload: Payload, id: number, name: string, data: Buffer) {
  return payload.update({
    collection: 'models',
    id,
    data: {},
    file: { data, mimetype: 'model/gltf-binary', name, size: data.byteLength },
  })
}

async function refresh() {
  const payload = await getPayload({ config })
  const term = await ensureCatalogueTerms(payload)

  const packages = await payload.find({ collection: 'furniture-packages', depth: 1, limit: 100 })

  for (const [title, build, file] of [
    ['Office Core', buildOfficeCorePackage, 'package-office-core.glb'],
    ['Conference Core', buildConferenceCorePackage, 'package-conference-core.glb'],
  ] as const) {
    const pkg = packages.docs.find((p) => p.title === title)
    if (!pkg) {
      payload.logger.warn(`No "${title}" package here — skipped.`)
      continue
    }

    const model = typeof pkg.model === 'object' ? pkg.model : null
    const modelId = model?.id ?? (typeof pkg.model === 'number' ? pkg.model : null)
    if (typeof modelId !== 'number') continue

    // The title alone is not enough to go replacing a file on. "Office Core" is
    // an obvious name for a real product too, and this would overwrite whatever
    // a client had uploaded under it with a procedural box. The filename is the
    // proof: only the seed writes these, and Payload keeps the stem when it
    // numbers a duplicate.
    const stem = file.replace(/\.glb$/, '')
    if (!model?.filename?.startsWith(stem)) {
      payload.logger.warn(
        `"${title}" is on ${model?.filename ?? 'an unknown file'}, which the seed did not write — left alone.`,
      )
      continue
    }

    const updated = await upload(payload, modelId, file, await build())
    const meta = updated.meta as { triangles?: number } | null
    payload.logger.info(
      `Rebuilt "${title}" model #${modelId} → ${updated.filename} (${meta?.triangles ?? '?'} triangles)`,
    )
  }

  if (packages.docs.some((p) => p.title === 'Task Chair')) {
    payload.logger.info('Task Chair already here — left alone.')
  } else {
    // Whatever the Office Core package is offered in and where, so the chair
    // turns up beside it rather than in some other corner of the catalogue.
    const office = packages.docs.find((p) => p.title === 'Office Core')
    const lines = (office?.compatibleLines ?? []).map((l) => (typeof l === 'object' ? l.id : l))
    const regions = (office?.regions ?? []).map((r) => (typeof r === 'object' ? r.id : r))

    const chair = await buildTaskChairPackage()
    const model = await payload.create({
      collection: 'models',
      data: { title: 'Task Chair package' },
      file: {
        data: chair,
        mimetype: 'model/gltf-binary',
        name: 'package-task-chair.glb',
        size: chair.byteLength,
      },
    })

    await payload.create({
      collection: 'furniture-packages',
      data: {
        title: 'Task Chair',
        tier: term.tier('core'),
        model: model.id,
        price: 240,
        description: 'A single task chair, to pull up to a desk or a table.',
        footprint: { width: 0.5, depth: 0.5 },
        compatibleRoomTypes: [term.roomType('office'), term.roomType('conference')],
        recommendedFor: [term.roomType('office')],
        compatibleLines: lines,
        regions,
      },
    })

    payload.logger.info(`Added the "Task Chair" package on model #${model.id}.`)
  }

  payload.logger.info('Demo furniture is up to date.')
  process.exit(0)
}

await refresh()
