import type { CollectionConfig } from 'payload'

import type { ModelMeta } from '../lib/optimize-model'

import { packModel } from '../endpoints/pack-model'
import { processModelUpload } from '../hooks/process-model-upload'

export const Models: CollectionConfig = {
  slug: 'models',
  labels: { singular: '3D Model', plural: '3D Models' },
  admin: {
    group: 'Media',
    components: {
      beforeListTable: [
        '/features/admin-model-viewer/ui/PackFolderButton#PackFolderButton',
      ],
    },
    defaultColumns: ['title', 'filename', 'updatedAt'],
    description:
      'Source 3D models, optimized for web delivery automatically on upload. One file only: ' +
      'a .glb, or a .gltf with nothing outside it. A .gltf that keeps its .bin and textures/ as ' +
      'separate files has to be packed first — run `pnpm optimize:model <file.gltf>` and upload ' +
      'the .glb it writes.',
    useAsTitle: 'title',
  },
  access: {
    read: () => true,
  },
  upload: {
    disableLocalStorage: false,
    hideFileInputOnCreate: false,
  },
  endpoints: [packModel],
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
      name: 'metaSummary',
      type: 'ui',
      admin: {
        components: {
          Field: '/features/admin-model-viewer/ui/ModelMetaField#ModelMetaField',
        },
      },
    },
    {
      name: 'meta',
      type: 'group',
      admin: {
        description: 'Filled automatically during upload optimization.',
        readOnly: true,
        hidden: true,
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
