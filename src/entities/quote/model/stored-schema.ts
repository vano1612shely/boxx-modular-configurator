import { z } from 'zod'

/**
 * What a saved configuration is allowed to look like when it is read back.
 *
 * Deliberately not `quoteConfigurationSchema`. That one guards the way in, and
 * a way in should be strict: it decides what we agree to store. This one guards
 * the way out of a `json` column that has been written by three eras of this
 * app and can be edited by hand in the admin, and the failure it has to avoid
 * is different — a customer opening the link they were sent and being told
 * their order does not exist because one number arrived as a string.
 *
 * So: every field that can be defaulted is defaulted, numbers are coerced, and
 * the two lists are parsed item by item rather than as a whole, because one
 * malformed piece of furniture must not blank an order.
 */
/**
 * A string that may be absent, null, or absent-shaped in any other way.
 *
 * `.default()` answers for `undefined` only, and this column has been through
 * JSON more than once — a key the client omitted comes back as an explicit null
 * as often as it comes back missing. Left to `.optional()` alone a single null
 * `buildingTitle` fails the whole object, and the customer is told their order
 * does not exist over a difference nobody can see.
 */
function looseText(fallback = '') {
  return z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? fallback)
}

/** The same, for a number: null and absent both mean "nobody wrote one down". */
function looseNumber(fallback: number) {
  return z.coerce
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? fallback)
}

const storedPackageSchema = z.object({
  packageId: z.coerce.number(),
  title: looseText(),
  roomKey: z.string(),
  zoneKey: z.string().nullable().optional().default(null),
  zoneName: z.string().nullable().optional().default(null),
  price: z.coerce.number().nullable().optional().default(null),
  x: z.coerce.number(),
  z: z.coerce.number(),
  rotationYDeg: looseNumber(0),
  // The pieces of a group, where the visitor left each one. Read as loosely as
  // everything else here — a line whose pieces are unreadable is still a line,
  // and falls back to being one thing standing at `x, z`.
  pieces: z
    .array(
      z.object({
        memberKey: z.string(),
        x: z.coerce.number(),
        z: z.coerce.number(),
        rotationYDeg: looseNumber(0),
      }),
    )
    .nullable()
    .optional()
    // Caught rather than allowed to fail the line. The same rule as everything
    // else here: an order says what was bought and what it cost, and losing
    // that because the arrangement inside one of its lines is unreadable would
    // be the one thing worse than losing the arrangement.
    .catch(undefined)
    .transform((rows) => rows ?? []),
})

const storedExteriorSchema = z.object({
  slotKey: z.string(),
  slotName: looseText(),
  variantKey: z.string(),
  title: looseText(),
  price: z.coerce.number().nullable().optional().default(null),
})

export const storedQuoteConfigurationSchema = z.object({
  buildingModelId: z.coerce.number().nullable().optional().default(null),
  buildingTitle: looseText(),
  lineSlug: looseText(),
  unitCount: looseNumber(0),
  restroomCount: looseNumber(0),
  officeCount: looseNumber(0),
  packages: z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((rows) => rows ?? []),
  exterior: z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((rows) => rows ?? []),
  totalPrice: looseNumber(0),
  // Not `z.iso.datetime()`: a timestamp carrying an offset is still a date, and
  // a page that will not open is worse than one that shows no date.
  submittedAt: looseText(),
})

export type StoredQuotePackage = z.infer<typeof storedPackageSchema>
export type StoredQuoteExterior = z.infer<typeof storedExteriorSchema>
export type StoredQuoteConfiguration = z.infer<typeof storedQuoteConfigurationSchema>

/** Everything in the list that still describes a placement; the rest is dropped. */
export function readStoredPackages(rows: unknown[]): StoredQuotePackage[] {
  return rows.flatMap((row) => {
    const parsed = storedPackageSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

export function readStoredExterior(rows: unknown[]): StoredQuoteExterior[] {
  return rows.flatMap((row) => {
    const parsed = storedExteriorSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}
