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
      name: 'fitted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'A fitted package is arranged in the building rather than carried in from here — a ' +
          'kitchen of several appliances, each put where it goes in the Scene Editor, on the ' +
          'room itself. This row gives it its name, its price and its picture; the room gives ' +
          'it its contents. The visitor adds and removes it like any other package but cannot ' +
          'move it. Ticking this on its own offers it nowhere.',
      },
    },
    {
      name: 'model',
      type: 'relationship',
      relationTo: 'models',
      admin: {
        description:
          'The whole package as one model. Leave empty for a fitted package — its parts are ' +
          'placed on the room instead. Anything else without one is offered nowhere.',
      },
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
