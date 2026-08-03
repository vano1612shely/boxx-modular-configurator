import { getPayload } from 'payload'

import config from '@payload-config'

import {
  mapBuildingScene,
  resolveBuildingSize,
  type BuildingScene,
} from '@/entities/building'

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
    return { status: 'ok', scene: mapBuildingScene(models.docs[0]) }
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
    ? { status: 'ok', scene: mapBuildingScene(fitting) }
    : { status: 'not-found' }
}
