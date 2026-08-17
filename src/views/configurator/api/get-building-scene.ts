import { getPayload } from 'payload'

import config from '@payload-config'

import {
  mapBuildingScene,
  mapExteriorOption,
  resolveBuildingSize,
  type BuildingScene,
  type ExteriorCatalogue,
} from '@/entities/building'
import type { BuildingModel } from '@/payload-types'

import { regionClauses, whereAll, type RegionScope } from './regions'

type Query = {
  /** Building line slug, e.g. "boxxplex". */
  building?: string
  units?: number
  restrooms?: number
  region?: RegionScope
}

export type BuildingResolution =
  | { status: 'ok'; scene: BuildingScene }
  | { status: 'over-capacity'; lineName: string; requestedUnits: number }
  | { status: 'not-found' }

type Payload = Awaited<ReturnType<typeof getPayload>>

/**
 * The catalogue entries this building's exterior spots point at.
 *
 * Fetched on their own rather than by deepening the query above: depth 1
 * resolves an option but stops before its thumbnail, and depth 2 would populate
 * every texture and every line's regions on a query that already returns up to
 * a hundred buildings. This one asks for a handful of rows by id.
 */
async function exteriorCatalogue(payload: Payload, doc: BuildingModel): Promise<ExteriorCatalogue> {
  const ids = new Set<number>()
  for (const slot of doc.sceneConfig?.exteriorSlots ?? []) {
    for (const variant of slot.variants ?? []) {
      const id = typeof variant.option === 'number' ? variant.option : variant.option?.id
      if (typeof id === 'number') ids.add(id)
    }
  }

  if (ids.size === 0) return new Map()

  const options = await payload.find({
    collection: 'exterior-options',
    depth: 1,
    limit: ids.size,
    where: { id: { in: [...ids] } },
  })

  return new Map(options.docs.map((option) => [option.id, mapExteriorOption(option)]))
}

/**
 * Room type keys to their names, for anything on screen that says what a room
 * is for.
 *
 * A room carries its type populated, but a zone carries only the key — zones
 * live in a JSON column — so one list read once answers for both. A short one:
 * these are the kinds of room the whole catalogue is built from.
 */
async function roomTypeNames(payload: Payload): Promise<Record<string, string>> {
  const types = await payload.find({ collection: 'room-types', depth: 0, limit: 200 })

  return Object.fromEntries(types.docs.map((type) => [type.slug, type.name]))
}

async function sceneFor(payload: Payload, doc: BuildingModel): Promise<BuildingScene> {
  const [catalogue, names] = await Promise.all([
    exteriorCatalogue(payload, doc),
    roomTypeNames(payload),
  ])

  return mapBuildingScene(doc, catalogue, names)
}

export async function getBuildingScene(query: Query): Promise<BuildingResolution> {
  const payload = await getPayload({ config })

  // A model inherits its line's availability. Without this a direct link to a
  // line that is not sold in the region would still open it, because the models
  // themselves usually carry no regions of their own.
  if (query.region != null && query.building) {
    const available = await payload.find({
      collection: 'building-lines',
      limit: 1,
      depth: 0,
      where: whereAll([
        { slug: { equals: query.building } },
        ...regionClauses(query.region),
      ]),
    })
    if (available.docs.length === 0) return { status: 'not-found' }
  }

  const models = await payload.find({
    collection: 'building-models',
    depth: 1,
    limit: 100,
    sort: 'unitCount',
    where: whereAll([
      ...(query.building ? [{ 'line.slug': { equals: query.building } }] : []),
      ...regionClauses(query.region ?? null),
    ]),
  })

  if (models.docs.length === 0) return { status: 'not-found' }

  if (!query.units) {
    return { status: 'ok', scene: await sceneFor(payload, models.docs[0]) }
  }

  const first = mapBuildingScene(models.docs[0])
  const result = resolveBuildingSize(
    { requestedUnits: query.units, restroomsRequested: query.restrooms ?? 0 },
    first.line.rules,
    models.docs.map((doc) => ({
      id: doc.id,
      unitCount: doc.unitCount,
      restroomCount: doc.restroomCount ?? 0,
    })),
  )

  if (result.status !== 'ok') {
    return {
      status: 'over-capacity',
      lineName: first.line.name,
      requestedUnits: query.units,
    }
  }

  const fitting = models.docs.find((doc) => doc.id === result.modelId)

  return fitting
    ? { status: 'ok', scene: await sceneFor(payload, fitting) }
    : { status: 'not-found' }
}
