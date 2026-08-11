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
