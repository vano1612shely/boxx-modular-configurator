import type { CollectionConfig } from 'payload'

export const Regions: CollectionConfig = {
  slug: 'regions',
  admin: {
    group: 'Catalog',
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'updatedAt'],
    description: 'Sales regions. Models, lines and packages are filtered by these.',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Short region code used in URLs and integrations, e.g. "us".' },
    },
  ],
}
