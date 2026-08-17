import type { CollectionConfig } from 'payload'

import { measureFootprint } from '../hooks/measure-footprint'

export const FurniturePackages: CollectionConfig = {
  slug: 'furniture-packages',
  admin: {
    group: 'Catalog',
    defaultColumns: ['title', 'tier', 'price', 'updatedAt'],
    useAsTitle: 'title',
    description:
      'Furniture packages placed as whole groups. Compatibility controls where they are offered.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [measureFootprint],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'tier',
      type: 'relationship',
      relationTo: 'furniture-tiers',
      admin: { description: 'The grade shown on the package card.' },
    },
    {
      name: 'model',
      type: 'relationship',
      relationTo: 'models',
      required: true,
    },
    {
      name: 'preview',
      type: 'ui',
      admin: {
        components: {
          Field: '/features/admin-model-viewer/ui/ModelPreviewField#ModelPreviewField',
        },
      },
    },
    {
      name: 'thumbnail',
      type: 'relationship',
      relationTo: 'images',
    },
    { name: 'price', type: 'number', admin: { description: 'USD.' } },
    { name: 'description', type: 'textarea' },
    {
      name: 'footprint',
      type: 'group',
      admin: {
        description:
          'Occupied floor rectangle (meters) — used for fit and collision checks. Measured from ' +
          'the model on save; leave blank unless the model needs a smaller or larger one than ' +
          'its bounding box.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'width', type: 'number' },
            { name: 'depth', type: 'number' },
          ],
        },
      ],
    },
    {
      name: 'compatibleRoomTypes',
      type: 'relationship',
      relationTo: 'room-types',
      hasMany: true,
      admin: {
        description: 'Where this package is offered at all. Empty means every room.',
      },
    },
    {
      name: 'recommendedFor',
      type: 'relationship',
      relationTo: 'room-types',
      hasMany: true,
      admin: {
        description:
          'Where it is offered first. In these rooms it appears under "Recommended", above ' +
          'everything else — it does not change where the package can go.',
      },
    },
    {
      name: 'compatibleLines',
      type: 'relationship',
      relationTo: 'building-lines',
      hasMany: true,
    },
    {
      name: 'regions',
      type: 'relationship',
      relationTo: 'regions',
      hasMany: true,
    },
  ],
}
