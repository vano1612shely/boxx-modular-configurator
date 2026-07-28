import type { CollectionConfig } from 'payload'

import type { ModelMeta } from '../lib/optimize-model'

import { processModelUpload } from '../hooks/process-model-upload'

export const Models: CollectionConfig = {
  slug: 'models',
  labels: { singular: '3D Model', plural: '3D Models' },
  admin: {
    group: 'Media',
    defaultColumns: ['title', 'filename', 'updatedAt'],
    description:
      'Source 3D models (.glb / self-contained .gltf). Files are optimized for web delivery automatically on upload.',
    useAsTitle: 'title',
  },
  access: {
    read: () => true,
  },
  upload: {
    disableLocalStorage: false,
    hideFileInputOnCreate: false,
  },
  hooks: {
    beforeOperation: [processModelUpload],
    beforeChange: [
      ({ data, req }) => {
        const meta = req.context.modelMeta as ModelMeta | undefined

        if (meta) {
          data.meta = meta
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
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
      name: 'meta',
      type: 'group',
      admin: {
        description: 'Filled automatically during upload optimization.',
        readOnly: true,
      },
      fields: [
        { name: 'sizeBefore', type: 'number' },
        { name: 'sizeAfter', type: 'number' },
        { name: 'triangles', type: 'number' },
        { name: 'meshes', type: 'number' },
        { name: 'materials', type: 'number' },
        { name: 'textures', type: 'number' },
        { name: 'bboxMin', type: 'json' },
        { name: 'bboxMax', type: 'json' },
      ],
    },
  ],
}
