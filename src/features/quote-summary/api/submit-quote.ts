'use server'

import { getPayload } from 'payload'

import config from '@payload-config'

import { quoteRequestSchema } from '@/entities/quote'
import { err, ok, type Result } from '@/shared/lib'

type SubmitOutcome = {
  quoteId: number
  /** The order's own address, which is what the customer is given. */
  reference: string
  forwarded: boolean
}

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

    // Written by the collection's own beforeChange hook, so it is there on a
    // create. Defaulted anyway rather than asserted: an empty one only costs
    // the link to the 3D view, and a thrown page would cost the whole request.
    return ok({ quoteId: quote.id, reference: quote.reference ?? '', forwarded })
  } catch {
    return err('Could not submit the quote request. Please try again later.')
  }
}
