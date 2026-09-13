import { z } from 'zod'

export const quoteContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Enter a valid email'),
  phone: z.string().optional(),
  company: z.string().optional(),
})

export const quotePackageSchema = z.object({
  packageId: z.number(),
  title: z.string(),
  roomKey: z.string(),
  // Which half of a divided room it stands in. Optional so quotes taken before
  // rooms could be divided still parse, and null for a room that never was.
  zoneKey: z.string().nullable().optional(),
  zoneName: z.string().nullable().optional(),
  price: z.number().nullable(),
  x: z.number(),
  z: z.number(),
  rotationYDeg: z.number(),
  /**
   * The pieces of a group, where the visitor left each one.
   *
   * A group is one purchase and so one line — one title, one price, which is
   * what the customer reads and what the sales system is sent. But the pieces
   * move independently once they are down, so the line has to carry them or
   * reopening the order would put a dining set back as a single table.
   *
   * Optional, and absent on every ordinary package: a quote taken before groups
   * existed still parses, and a line with no pieces is one thing standing at
   * `x, z` exactly as it always was.
   */
  pieces: z
    .array(
      z.object({
        memberKey: z.string(),
        x: z.number(),
        z: z.number(),
        rotationYDeg: z.number(),
      }),
    )
    .optional(),
})

export const quoteExteriorSchema = z.object({
  slotKey: z.string(),
  slotName: z.string(),
  variantKey: z.string(),
  title: z.string(),
  price: z.number().nullable(),
})

export const quoteConfigurationSchema = z.object({
  buildingModelId: z.number().nullable(),
  buildingTitle: z.string(),
  lineSlug: z.string(),
  unitCount: z.number(),
  restroomCount: z.number(),
  // Optional so quotes taken before schools had offices still parse.
  officeCount: z.number().optional(),
  packages: z.array(quotePackageSchema),
  // What was picked at each exterior spot. Optional so quotes taken before
  // there were any still parse.
  exterior: z.array(quoteExteriorSchema).optional(),
  totalPrice: z.number(),
  submittedAt: z.iso.datetime(),
})

export const quoteRequestSchema = z.object({
  contact: quoteContactSchema,
  configuration: quoteConfigurationSchema,
})

export type QuoteContact = z.infer<typeof quoteContactSchema>
export type QuoteConfiguration = z.infer<typeof quoteConfigurationSchema>
export type QuoteRequest = z.infer<typeof quoteRequestSchema>
