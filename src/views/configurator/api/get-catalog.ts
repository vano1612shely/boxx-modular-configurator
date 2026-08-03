import { getPayload } from 'payload'

import config from '@payload-config'

import type { IntakeLine } from '@/features/building-intake'
import type { IntegrationOptions } from '@/features/quote-summary'

import { regionClauses, whereAll, type RegionScope } from './regions'

export async function getIntakeLines(region: RegionScope = null): Promise<IntakeLine[]> {
  const payload = await getPayload({ config })
  const scope = whereAll(regionClauses(region))

  const [lines, models] = await Promise.all([
    payload.find({ collection: 'building-lines', limit: 50, sort: 'name', where: scope }),
    // The largest size on offer is a fact about the published models, so it is
    // read rather than configured — through the same region scope, because a
    // size not sold here is not the cap here.
    payload.find({ collection: 'building-models', limit: 500, depth: 0, where: scope }),
  ])

  const largestByLine = new Map<number, number>()
  for (const model of models.docs) {
    const lineId = typeof model.line === 'number' ? model.line : model.line?.id
    if (typeof lineId !== 'number') continue
    largestByLine.set(lineId, Math.max(largestByLine.get(lineId) ?? 0, model.unitCount))
  }

  return lines.docs.map((line) => ({
    slug: line.slug,
    name: line.name,
    unitLabel: line.unitLabel,
    maxUnits: largestByLine.get(line.id) ?? null,
  }))
}

export async function getIntegrationOptions(): Promise<IntegrationOptions> {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'integration-settings' })

  return {
    enablePostMessage: settings.enablePostMessage ?? true,
    targetOrigin: settings.targetOrigin ?? '*',
  }
}
