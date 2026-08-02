import type { CollectionBeforeChangeHook } from 'payload'

import { footprintFromMeta } from '../lib/footprint-from-meta'

function idOf(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
  }
  return null
}

export const measureFootprint: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const modelId = idOf(data.model)
  if (!modelId) return data

  const footprint = data.footprint as { width?: unknown; depth?: unknown } | undefined
  const hasNumbers =
    typeof footprint?.width === 'number' && typeof footprint?.depth === 'number'

  const modelChanged = operation === 'update' && idOf(originalDoc?.model) !== modelId
  if (hasNumbers && !modelChanged) return data

  try {
    const model = await req.payload.findByID({
      collection: 'models',
      id: modelId,
      depth: 0,
      req,
    })

    const measured = footprintFromMeta(model.meta)
    if (measured) data.footprint = { ...(footprint ?? {}), ...measured }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    req.payload.logger.warn(`Could not measure footprint from model ${modelId}: ${message}`)
  }

  return data
}
