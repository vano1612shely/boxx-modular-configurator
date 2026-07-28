import type { CollectionConfig } from 'payload'

import { processTextureUpload, type TextureMeta } from '../hooks/process-texture-upload'

/**
 * Seamless surface textures for generated rooms.
 *
 * Deliberately NOT the `images` collection: that one centre-crops a 400x300
 * thumbnail and a 768-wide card, which is meaningless for a tile and wastes
 * storage, and it forces alt text that no 3D surface will ever announce.
 */
export const Textures: CollectionConfig = {
  slug: 'textures',
  labels: { singular: 'Texture', plural: 'Textures' },
  admin: {
    group: 'Media',
    description:
      'Tileable surface textures (walls, floors, ceilings, doors, windows). Re-encoded to webp and capped at 2048px on upload.',
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  upload: {
    mimeTypes: ['image/*'],
    // No derivatives: a tile must keep its full frame and aspect ratio.
    imageSizes: [],
  },
  hooks: {
    beforeOperation: [processTextureUpload],
    beforeChange: [
      ({ data, req }) => {
        const meta = req.context.textureMeta as TextureMeta | undefined
        if (meta) data.meta = meta
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: { description: 'Optional label; the filename is used when empty.' },
    },
    {
      name: 'meta',
      type: 'group',
      admin: { description: 'Filled automatically during upload.', readOnly: true },
      fields: [
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 'sizeBefore', type: 'number' },
        { name: 'sizeAfter', type: 'number' },
      ],
    },
  ],
}
