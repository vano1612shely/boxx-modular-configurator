import { getPayload } from 'payload'

import config from '@payload-config'

import { resolveRedirectUrl, resolveSuccessCopy } from '@/modules/shared/order-success'
import { QUIZ_COPY_DEFAULTS, type QuizCopy } from '@/modules/shared/quiz-copy'
import { textOr } from '@/modules/shared/text-or'
import { assetUrl } from '@/shared/lib'
import type { IntakeLine } from '@/features/building-intake'
import type { IntegrationOptions } from '@/features/quote-summary'

import { regionClauses, whereAll, type RegionScope } from '@/modules/regions/lib/scope'

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
    successRedirectUrl: resolveRedirectUrl(settings),
    success: resolveSuccessCopy(settings),
  }
}

/**
 * The wording on the two questions asked before the building is shown.
 *
 * Descriptions are the exception to the rule above: they have no default, and
 * empty is the answer that hides them.
 */
export async function getQuizCopy(): Promise<QuizCopy> {
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'configurator-settings', depth: 1 })

  const step1 = settings.step1 ?? {}
  const step2 = settings.step2 ?? {}
  const notFound = settings.notFound ?? {}
  const overCapacity = settings.overCapacity ?? {}

  const D = QUIZ_COPY_DEFAULTS

  // `!== false` rather than a plain truth test: the checkbox was added after
  // the settings row existed, and a row written before it holds null there.
  // Null means "nobody has said otherwise", and the logo showed before anybody
  // could — so it goes on showing until the box is actually cleared.
  const showLogo = settings.showLogo !== false

  return {
    logoUrl:
      showLogo && typeof settings.logo === 'object' ? assetUrl(settings.logo) : null,
    step1: {
      eyebrow: textOr(step1.eyebrow, D.step1.eyebrow),
      title: textOr(step1.title, D.step1.title),
      description: typeof step1.description === 'string' ? step1.description : '',
      listLabel: textOr(step1.listLabel, D.step1.listLabel),
    },
    step2: {
      title: textOr(step2.title, D.step2.title),
      description: typeof step2.description === 'string' ? step2.description : '',
      officesLabel: textOr(step2.officesLabel, D.step2.officesLabel),
      classroomsLabel: textOr(step2.classroomsLabel, D.step2.classroomsLabel),
      overCapacityHint: textOr(step2.overCapacityHint, D.step2.overCapacityHint),
      restroomsLabel: textOr(step2.restroomsLabel, D.step2.restroomsLabel),
      restroomsHint: textOr(step2.restroomsHint, D.step2.restroomsHint),
      back: textOr(step2.back, D.step2.back),
      submit: textOr(step2.submit, D.step2.submit),
    },
    notFound: {
      title: textOr(notFound.title, D.notFound.title),
      body: textOr(notFound.body, D.notFound.body),
    },
    overCapacity: {
      chip: textOr(overCapacity.chip, D.overCapacity.chip),
      title: textOr(overCapacity.title, D.overCapacity.title),
      body: textOr(overCapacity.body, D.overCapacity.body),
      action: textOr(overCapacity.action, D.overCapacity.action),
    },
  }
}
