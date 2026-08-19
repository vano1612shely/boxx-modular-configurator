import { headers } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'

import {
  readStoredExterior,
  readStoredPackages,
  storedQuoteConfigurationSchema,
  type StoredQuoteExterior,
  type StoredQuotePackage,
} from '@/entities/quote'
import { isOrderReference } from '@/modules/shared/order-reference'

/**
 * A saved order as the page is allowed to show it.
 *
 * There is no `contact` member, and that is the point: the link is meant to be
 * forwarded, so the customer's name, email and phone number are kept out by the
 * shape of the thing rather than by everybody downstream remembering not to
 * render them.
 */
export type SavedOrder = {
  reference: string
  submittedAt: string | null
  buildingTitle: string
  buildingModelId: number | null
  lineSlug: string
  unitCount: number
  restroomCount: number
  packages: StoredQuotePackage[]
  exterior: StoredQuoteExterior[]
  totalPrice: number
}

export type OrderResolution = { status: 'ok'; order: SavedOrder } | { status: 'not-found' }

/** Long enough for any reference; anything longer is not worth a query. */
const MAX_SEGMENT = 64

/** Postgres `serial`. A number past this is not an id, and asking about it errors. */
const MAX_ID = 2_147_483_647

const NOT_FOUND = { status: 'not-found' } as const

/**
 * The order behind a link, by reference or — for a signed-in admin — by id.
 *
 * Two ways in, because there are two audiences. The customer holds a reference,
 * which is unguessable and therefore safe to hand out. An admin looking at the
 * Quotes list holds a serial id, which is not: counting through them would walk
 * the whole sales pipeline, so that door only opens for a Payload session.
 *
 * Both misses answer identically, so the page cannot be used to find out which
 * ids exist.
 *
 * Note the Payload contract this rests on: `find` and `findByID` called without
 * a `req` default to `overrideAccess: true`, so the collection's own `read`
 * rule — signed-in only — does not apply here. That rule still guards the REST
 * and GraphQL endpoints and the admin. The guard for this page is the code
 * above it, which is why it is written out rather than left implied.
 */
export async function getOrder(segment: string): Promise<OrderResolution> {
  const raw = segment.trim()
  if (raw === '' || raw.length > MAX_SEGMENT) return NOT_FOUND

  const payload = await getPayload({ config })

  // References first, and only then ids. The reference alphabet contains the
  // digits 2-9, so one drawn entirely from them is a valid reference that also
  // looks like a number — and asked the other way round it would be sent to the
  // admin-only door and could never be opened by the customer holding it.
  // Checking the shape before querying costs no round trip for a segment that
  // cannot be a reference at all.
  if (isOrderReference(raw)) {
    const found = await payload.find({
      collection: 'quotes',
      where: { reference: { equals: raw } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const doc = found.docs[0]
    if (doc) return { status: 'ok', order: toSavedOrder(doc) }
  }

  // Bounded, because `findByID` on a number the column cannot hold is a database
  // error rather than a miss — and a 500 on a hand-typed URL is a worse answer
  // than "no such order", as well as a louder one.
  const id = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1 || id > MAX_ID) return NOT_FOUND

  const { user } = await payload.auth({ headers: await headers() })
  if (!user) return NOT_FOUND

  const doc = await payload.findByID({
    collection: 'quotes',
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
  })

  return doc ? { status: 'ok', order: toSavedOrder(doc) } : NOT_FOUND
}

type QuoteDoc = {
  reference?: string | null
  createdAt?: string | null
  configuration?: unknown
}

function toSavedOrder(doc: QuoteDoc): SavedOrder {
  // `configuration` is an untyped json column written by three eras of this app
  // and editable by hand in the admin, so it is read tolerantly. A parse that
  // fails entirely still yields an order — an empty building, which the scene
  // resolution below then reports as unavailable, rather than a thrown page.
  const parsed = storedQuoteConfigurationSchema.safeParse(doc.configuration)
  const config = parsed.success ? parsed.data : storedQuoteConfigurationSchema.parse({})

  return {
    reference: doc.reference ?? '',
    // The row's own timestamp is the fallback: `submittedAt` is written by the
    // browser clock, and a browser that is a day out should not date the order.
    submittedAt: config.submittedAt || doc.createdAt || null,
    buildingTitle: config.buildingTitle,
    buildingModelId: config.buildingModelId,
    lineSlug: config.lineSlug,
    unitCount: config.unitCount,
    restroomCount: config.restroomCount,
    packages: readStoredPackages(config.packages ?? []),
    exterior: readStoredExterior(config.exterior ?? []),
    totalPrice: config.totalPrice,
  }
}
