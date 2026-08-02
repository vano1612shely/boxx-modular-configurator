import type { CollectionConfig } from 'payload'

export const Quotes: CollectionConfig = {
  slug: 'quotes',
  admin: {
    group: 'Sales',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'createdAt'],
    description: 'Quote requests submitted from the configurator.',
  },
  hooks: {
    // `useAsTitle` cannot reach into a group.
    beforeChange: [
      ({ data }) => ({
        ...data,
        title: data?.contact?.name || data?.contact?.email || 'Quote request',
      }),
    ],
  },
  access: {
    create: () => true,
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
