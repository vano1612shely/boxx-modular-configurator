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
  price: z.number().nullable(),
  x: z.number(),
  z: z.number(),
  rotationYDeg: z.number(),
})

export const quoteConfigurationSchema = z.object({
  buildingModelId: z.number().nullable(),
  buildingTitle: z.string(),
  lineSlug: z.string(),
  unitCount: z.number(),
  restroomCount: z.number(),
  packages: z.array(quotePackageSchema),
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
