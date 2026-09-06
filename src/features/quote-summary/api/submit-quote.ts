'use server'

import { getPayload } from 'payload'

import config from '@payload-config'

import { quoteRequestSchema } from '@/entities/quote'
import { err, ok, type Result } from '@/shared/lib'

/** How long the customer is made to wait on somebody else's endpoint. */
const WEBHOOK_TIMEOUT_MS = 10_000

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
          // The customer is watching a spinner while this runs, and the address
          // at the other end belongs to somebody else. Without a deadline, an
          // endpoint that accepts the connection and then never answers holds
          // the request open for as long as the platform allows.
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        })
        forwarded = response.ok
      } catch {
        forwarded = false
      }

      // Its own try. By this point the quote exists and has already been sent
      // on, so a database hiccup while stamping the outcome must not be
      // reported to the customer as a failed request — they would submit a
      // second one and the sales team would get the same order twice.
      try {
        await payload.update({
          collection: 'quotes',
          id: quote.id,
          data: { status: forwarded ? 'forwarded' : 'webhook-failed' },
        })
      } catch {
        payload.logger.warn(
          `Quote ${quote.id} went out but its status could not be written back.`,
        )
      }
    }

    // Written by the collection's own beforeChange hook, so it is there on a
    // create. Defaulted anyway rather than asserted: an empty one only costs
    // the link to the 3D view, and a thrown page would cost the whole request.
    return ok({ quoteId: quote.id, reference: quote.reference ?? '', forwarded })
  } catch {
    return err('Could not submit the quote request. Please try again later.')
  }
}
