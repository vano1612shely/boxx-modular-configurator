import type { CollectionConfig } from 'payload'

export const Images: CollectionConfig = {
  slug: 'images',
  labels: { singular: 'Image', plural: 'Images' },
  admin: {
    group: 'Media',
    // Without this every row is titled by its numeric id.
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    description: 'Photos and thumbnails shown in the configurator UI.',
  },
  access: {
    read: () => true,
  },
  upload: {
    mimeTypes: ['image/*'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: undefined },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
