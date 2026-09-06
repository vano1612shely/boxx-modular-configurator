import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'

import { footprintFromMeta, type Footprint, type MeasuredMeta } from '@/shared/lib'
import { groupFootprint, type MemberBox } from '../lib/group-footprint'

function idOf(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
  }
  return null
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

type MemberRow = { model?: unknown; x?: unknown; z?: unknown; rotationYDeg?: unknown }

function membersOf(value: unknown): MemberRow[] {
  return Array.isArray(value) ? (value as MemberRow[]) : []
}

/**
 * What a group's measurement depends on: which models, and where each one sits.
 *
 * Compared rather than watched field by field, so nudging one chair re-measures
 * and renaming the group does not.
 */
function arrangementSignature(value: unknown): string {
  return membersOf(value)
    .map((m) => `${idOf(m.model)}@${numberOr(m.x, 0)},${numberOr(m.z, 0)}:${numberOr(m.rotationYDeg, 0)}`)
    .join('|')
}

async function metaOf(req: PayloadRequest, modelId: number): Promise<MeasuredMeta> {
  const model = await req.payload.findByID({ collection: 'models', id: modelId, depth: 0, req })
  return model.meta as MeasuredMeta
}

/** The union of the pieces, or null when none of them has been measured yet. */
async function measureGroup(req: PayloadRequest, value: unknown): Promise<Footprint | null> {
  const boxes: MemberBox[] = []

  for (const member of membersOf(value)) {
    const modelId = idOf(member.model)
    if (!modelId) continue

    boxes.push({
      meta: await metaOf(req, modelId),
      x: numberOr(member.x, 0),
      z: numberOr(member.z, 0),
      rotationYDeg: numberOr(member.rotationYDeg, 0),
    })
  }

  return groupFootprint(boxes)?.footprint ?? null
}

export const measureFootprint: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const modelId = idOf(data.model)
  const members = membersOf(data.members)

  // A group is measured from its pieces where they were arranged, not from a
  // model of its own — it has none. The single-model path below is unchanged.
  const isGroup = modelId === null && members.length > 0
  if (!modelId && !isGroup) return data

  const footprint = data.footprint as { width?: unknown; depth?: unknown } | undefined
  const hasNumbers = typeof footprint?.width === 'number' && typeof footprint?.depth === 'number'

  const sourceChanged =
    operation === 'update' &&
    (isGroup
      ? arrangementSignature(originalDoc?.members) !== arrangementSignature(data.members)
      : idOf(originalDoc?.model) !== modelId)

  if (hasNumbers && !sourceChanged) return data

  try {
    const measured = isGroup
      ? await measureGroup(req, data.members)
      : footprintFromMeta(await metaOf(req, modelId as number))

    if (measured) data.footprint = { ...(footprint ?? {}), ...measured }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    const what = isGroup ? 'the pieces of this group' : `model ${modelId}`
    req.payload.logger.warn(`Could not measure footprint from ${what}: ${message}`)
  }

  return data
}
