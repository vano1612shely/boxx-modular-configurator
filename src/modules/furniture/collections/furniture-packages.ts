import type { CollectionConfig } from 'payload'

import { ROOM_TYPE_OPTIONS } from '../../shared/room-types'
import { measureFootprint } from '../hooks/measure-footprint'

export const FurniturePackages: CollectionConfig = {
  slug: 'furniture-packages',
  admin: {
    group: 'Catalog',
    defaultColumns: ['title', 'family', 'tier', 'price', 'updatedAt'],
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
      type: 'row',
      fields: [
        {
          name: 'family',
          type: 'select',
          required: true,
          options: [
            { label: 'Office', value: 'office' },
            { label: 'Conference', value: 'conference' },
            { label: 'Kitchen', value: 'kitchen' },
            { label: 'Seating / Lounge', value: 'seating' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'tier',
          type: 'select',
          required: true,
          defaultValue: 'core',
          options: [
            { label: 'Core', value: 'core' },
            { label: 'Plus', value: 'plus' },
          ],
        },
      ],
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
      type: 'select',
      hasMany: true,
      options: [...ROOM_TYPE_OPTIONS],
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
