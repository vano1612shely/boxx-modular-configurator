import type { CollectionConfig } from 'payload'

import { isOrderReference, newOrderReference } from '../../shared/order-reference'

export const Quotes: CollectionConfig = {
  slug: 'quotes',
  admin: {
    group: 'Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'reference', 'status', 'createdAt'],
    description: 'Quote requests submitted from the configurator.',
  },
  hooks: {
    // `useAsTitle` cannot reach into a group, and the reference has to exist
    // before the row does — it is the address the customer is given.
    beforeChange: [
      ({ data, originalDoc, operation }) => ({
        ...data,
        title: data?.contact?.name || data?.contact?.email || 'Quote request',
        // Minted here and taken from nowhere else. Never from the request: the
        // reference is the only thing guarding an order, so a caller must not be
        // able to choose it.
        // Never carried over on a create either — Payload's Duplicate copies the
        // row's fields, and two orders answering to one link is worse than the
        // duplicate having its own. On an update the existing one is kept, so a
        // link already sent out goes on working; a row whose reference is
        // missing or malformed gets a fresh one rather than staying unreachable.
        reference:
          operation === 'update' && isOrderReference(originalDoc?.reference ?? '')
            ? originalDoc.reference
            : newOrderReference(),
      }),
    ],
  },
  access: {
    // Not open to the world. The configurator submits through a server action,
    // which uses the Local API and overrides access, so the only caller this
    // ever admitted was an anonymous POST /api/quotes — a way to write rows
    // straight past the Zod schema that guards the real path.
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: { hidden: true },
    },
    {
      // Indexed because every customer visit to /order/<reference> looks the
      // row up by it, and unique because the whole point is that one reference
      // means one order.
      name: 'reference',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'The order number the customer is given. Written once and never changes.',
      },
    },
    {
      name: 'orderLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/modules/quotes/admin/OrderLinkField#OrderLinkField',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Forwarded', value: 'forwarded' },
        { label: 'Webhook failed', value: 'webhook-failed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text' },
            { name: 'email', type: 'email' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'phone', type: 'text' },
            { name: 'company', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'buildingModel',
      type: 'relationship',
      relationTo: 'building-models',
    },
    {
      name: 'configuration',
      type: 'json',
      required: true,
      admin: { description: 'Full QuoteConfiguration payload as submitted by the configurator.' },
    },
  ],
}
