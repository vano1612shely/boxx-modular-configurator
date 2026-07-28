import type { CollectionConfig } from 'payload'

import { ROOM_TYPE_OPTIONS } from '../../shared/room-types'

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
      // A package is a piece of furniture somebody will place in a room — the
      // title alone does not tell you which piece.
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
      admin: { description: 'Occupied floor rectangle (meters) — used for fit/collision checks.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'width', type: 'number', required: true },
            { name: 'depth', type: 'number', required: true },
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
