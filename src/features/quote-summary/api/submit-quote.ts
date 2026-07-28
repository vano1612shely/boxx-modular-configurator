'use server'

import { getPayload } from 'payload'

import config from '@payload-config'

import { quoteRequestSchema } from '@/entities/quote'
import { err, ok, type Result } from '@/shared/lib'

type SubmitOutcome = { quoteId: number; forwarded: boolean }

/**
 * Stores the quote request and forwards it to the host site's webhook when
 * one is configured in Integration Settings.
 */
export async function submitQuote(input: unknown): Promise<Result<SubmitOutcome>> {
  const parsed = quoteRequestSchema.safeParse(input)

  if (!parsed.success) {
    return err('Invalid quote request. Please check the contact details and try again.')
  }

  const { contact, configuration } = parsed.data

  try {
    const payload = await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'integration-settings' })

    const quote = await payload.create({
      collection: 'quotes',
      data: {
        contact,
        buildingModel: configuration.buildingModelId ?? undefined,
        configuration,
      },
    })

    let forwarded = false

    if (settings.webhookUrl) {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      for (const header of settings.webhookHeaders ?? []) {
        headers.set(header.key, header.value)
      }

      try {
        const response = await fetch(settings.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ contact, configuration }),
        })
        forwarded = response.ok
      } catch {
        forwarded = false
      }

      await payload.update({
        collection: 'quotes',
        id: quote.id,
        data: { status: forwarded ? 'forwarded' : 'webhook-failed' },
      })
    }

    return ok({ quoteId: quote.id, forwarded })
  } catch {
    return err('Could not submit the quote request. Please try again later.')
  }
}
