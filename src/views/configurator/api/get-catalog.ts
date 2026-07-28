import { getPayload } from 'payload'

import config from '@payload-config'

import type { IntakeLine } from '@/features/building-intake'
import type { IntegrationOptions } from '@/features/quote-summary'

export async function getIntakeLines(): Promise<IntakeLine[]> {
  const payload = await getPayload({ config })
  const lines = await payload.find({ collection: 'building-lines', limit: 50, sort: 'name' })

  return lines.docs.map((line) => ({
    slug: line.slug,
    name: line.name,
    unitLabel: line.unitLabel,
    maxUnits: line.rules?.maxUnits ?? null,
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
