import type { CollectionConfig } from 'payload'

import { vec3Field } from '../../shared/fields/vec3'
import { zoneBoxFields } from '../../shared/fields/zone-box'
import {
  OPENING_FIT_OPTIONS,
  OPENING_KIND_OPTIONS,
  SHELL_DEFAULTS,
  SUN_DIRECTION_OPTIONS,
  TEXTURED_SURFACE_OPTIONS,
  WALL_SIDE_OPTIONS,
} from '../../shared/room-shell'
import { ROOM_TYPE_OPTIONS } from '../../shared/room-types'

export const BuildingModels: CollectionConfig = {
  slug: 'building-models',
  admin: {
    group: 'Catalog',
    useAsTitle: 'title',
    defaultColumns: ['title', 'line', 'unitCount', 'dimensions', 'updatedAt'],
    description:
      'One entry per building size. Rooms, roof volumes and cameras are set up visually in the Scene Editor tab.',
    components: {
      views: {
        edit: {
          sceneEditor: {
            Component: '/features/admin-scene-editor/ui/SceneEditorView#SceneEditorView',
            path: '/scene-editor',
            tab: {
              label: 'Scene Editor',
              href: '/scene-editor',
            },
          },
        },
      },
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Details',
          description: 'What the customer sees in the catalog.',
          fields: [
            { name: 'title', type: 'text', required: true },
            {
              name: 'line',
              type: 'relationship',
              relationTo: 'building-lines',
              required: true,
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'unitCount',
                  type: 'number',
                  required: true,
                  admin: { description: 'Number of offices/classrooms this size provides.' },
                },
                { name: 'restroomCount', type: 'number', defaultValue: 0 },
                {
                  name: 'sqft',
                  type: 'number',
                  admin: {
                    description:
                      'Overall size of the building. Rooms carry their own floor area and will ' +
                      'not add up to this — walls, corridors and plant are not in any room.',
                  },
                },
                {
                  name: 'sqm',
                  type: 'number',
                  admin: {
                    description:
                      'The same size in m². Fill in only if it should not be the conversion of ' +
                      'the figure beside it.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'dimensions',
                  type: 'text',
                  admin: { description: "Display size, e.g. 24' x 56'." },
                },
                {
                  name: 'dimensionsMetric',
                  type: 'text',
                  admin: {
                    description:
                      'The same, in metres — e.g. 7.3 m × 17.1 m. Free text cannot be converted, ' +
                      'so a visitor reading metres sees this or nothing.',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'occupancy',
                  type: 'number',
                  admin: { description: 'Estimated people. Left empty it is not shown.' },
                },
                {
                  name: 'estimatedPrice',
                  type: 'number',
                  admin: {
                    description:
                      'Indicative price in USD, shown to the visitor. Left empty it is not shown.',
                  },
                },
                {
                  name: 'leadTime',
                  type: 'text',
                  admin: { description: 'Free text — "8–10 weeks" is not a number.' },
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
            {
              name: 'regions',
              type: 'relationship',
              relationTo: 'regions',
              hasMany: true,
            },
          ],
        },
        {
          label: 'Scene data',
          description:
            'Owned by the Scene Editor tab above. Here for inspection and recovery — hand-editing it is rarely what you want.',
          fields: [
            {
              name: 'sceneConfig',
              type: 'group',
              admin: { description: 'Viewer setup — edited visually in the Scene Editor.' },
              fields: [
                {
                  name: 'camera',
                  type: 'group',
                  admin: {
                    description:
                      'Where the visitor lands, and how far they may orbit or zoom.',
                  },
                  fields: [
                    vec3Field('position'),
                    vec3Field('target'),
                    { name: 'fov', type: 'number', defaultValue: 50 },
                    {
                      type: 'row',
                      fields: [
                        { name: 'minDistance', type: 'number', defaultValue: 2 },
                        { name: 'maxDistance', type: 'number', defaultValue: 30 },
                        { name: 'minPolarDeg', type: 'number', defaultValue: 15 },
                        { name: 'maxPolarDeg', type: 'number', defaultValue: 85 },
                      ],
                    },
                  ],
                },
                {
                  name: 'roofBlocks',
                  type: 'array',
                  admin: {
                    description:
                      'Building-level roof volumes. Hidden in the client overview (toggleable).',
                  },
                  fields: zoneBoxFields(),
                },
                {
                  name: 'floorY',
                  type: 'number',
                  defaultValue: 0,
                  admin: {
                    description:
                      'Walkable level rooms are drawn at while the building has no storeys. Each storey below carries its own instead.',
                  },
                },
                {
                  name: 'floors',
                  type: 'array',
                  labels: { singular: 'Storey', plural: 'Storeys' },
                  admin: {
                    description:
                      'Storeys of a multi-storey building. Each one is the volume that stays visible when the visitor picks it — everything outside is hidden. The visitor only gets a picker once there are two, so a single-storey building needs none of this.',
                  },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'key', type: 'text', required: true },
                        { name: 'name', type: 'text', required: true },
                        {
                          name: 'floorY',
                          type: 'number',
                          defaultValue: 0,
                          admin: {
                            description:
                              'Walkable level of this storey — where rooms drawn on it start, and what furniture stands on.',
                          },
                        },
                      ],
                    },
                    { name: 'box', type: 'group', fields: zoneBoxFields() },
                  ],
                },
                {
                  name: 'roofModel',
                  type: 'group',
                  admin: {
                    description:
                      'A roof supplied as its own model. Placed visually in the Scene Editor.',
                  },
                  fields: [
                    { name: 'model', type: 'relationship', relationTo: 'models' },
                    vec3Field('position'),
                    {
                      type: 'row',
                      fields: [
                        { name: 'yawDeg', type: 'number', defaultValue: 0 },
                        { name: 'scale', type: 'number', defaultValue: 1 },
                      ],
                    },
                  ],
                },
                {
                  name: 'exteriorSlots',
                  type: 'array',
                  labels: { singular: 'Exterior Spot', plural: 'Exterior Spots' },
                  admin: {
                    description:
                      'Places outside the building where the visitor picks between a deck, ' +
                      'stairs, a ramp and so on. A building with none of these is shown exactly ' +
                      'as it is, with no panel. Set up visually in the Scene Editor.',
                  },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'key', type: 'text', required: true },
                        { name: 'name', type: 'text', required: true },
                      ],
                    },
                    vec3Field('position'),
                    {
                      type: 'row',
                      fields: [
                        { name: 'yawDeg', type: 'number', defaultValue: 0 },
                        {
                          name: 'defaultVariantKey',
                          type: 'text',
                          admin: {
                            description: 'What the visitor arrives on. Blank means the first one.',
                          },
                        },
                      ],
                    },
                    {
                      name: 'variants',
                      type: 'array',
                      labels: { singular: 'Choice', plural: 'Choices' },
                      admin: {
                        description:
                          'What may be picked here. A choice can reveal objects already in the ' +
                          'building model, or place models of its own, or both at once.',
                      },
                      fields: [
                        {
                          type: 'row',
                          fields: [
                            { name: 'key', type: 'text', required: true },
                            {
                              name: 'option',
                              type: 'relationship',
                              relationTo: 'exterior-options',
                              required: true,
                            },
                          ],
                        },
                        {
                          // Node paths like "2/0/5", into the building's own model.
                          name: 'nodes',
                          type: 'json',
                          admin: {
                            readOnly: true,
                            description:
                              'Objects of the building model this choice shows. Claimed visually.',
                          },
                        },
                        {
                          name: 'parts',
                          type: 'array',
                          labels: { singular: 'Part', plural: 'Parts' },
                          admin: {
                            description:
                              'Models placed for this choice. Offsets are from the spot above, ' +
                              'so moving the spot carries every choice with it.',
                          },
                          fields: [
                            {
                              name: 'model',
                              type: 'relationship',
                              relationTo: 'models',
                              required: true,
                            },
                            vec3Field('position'),
                            vec3Field('scale', { defaultValue: 1 }),
                            { name: 'yawDeg', type: 'number', defaultValue: 0 },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  // Node paths like "2/0/5".
                  name: 'hiddenNodePaths',
                  type: 'json',
                  admin: {
                    readOnly: true,
                    description: 'Objects hidden in the Scene Editor. Edited visually.',
                  },
                },
              ],
            },
            {
              name: 'rooms',
              type: 'array',
              admin: {
                description: 'Rooms/zones of the building — edited visually in the Scene Editor.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'key', type: 'text', required: true },
                    { name: 'name', type: 'text', required: true },
                    {
                      name: 'roomType',
                      type: 'select',
                      required: true,
                      options: [...ROOM_TYPE_OPTIONS],
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'areaSqFt',
                      type: 'number',
                      admin: {
                        description:
                          'Floor area in ft². Empty means it is worked out from the outline ' +
                          'below — fill it in only when you have a better figure than the trace.',
                      },
                    },
                    {
                      name: 'areaSqM',
                      type: 'number',
                      admin: {
                        description:
                          'The same area in m². Empty means the outline, or a conversion of the ' +
                          'figure beside it if that one was filled in.',
                      },
                    },
                  ],
                },
                {
                  name: 'floorPolygon',
                  type: 'array',
                  minRows: 3,
                  admin: {
                    description:
                      'Floor outline points (XZ plane, meters), drawn in the editor. Each point owns the edge that starts at it, and that edge belongs to one of the four walls.',
                  },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        { name: 'x', type: 'number', required: true },
                        { name: 'z', type: 'number', required: true },
                        {
                          name: 'side',
                          type: 'select',
                          defaultValue: 'w1',
                          options: [...WALL_SIDE_OPTIONS],
                        },
                      ],
                    },
                  ],
                },
                {
                  // JSON for the same reason as `openings` below: Payload
                  // re-inserts array rows on update, so row ids are not stable.
                  // Entries are { key, name, roomType, areaSqFt, areaSqM, color, polygon }.
                  name: 'zones',
                  type: 'json',
                  admin: {
                    description:
                      'Parts of this room with a use of their own — a conference half and a kitchen half with no partition between them. Cut in the Scene Editor. Empty means the room is one space.',
                  },
                },
                {
                  name: 'shell',
                  type: 'group',
                  admin: {
                    description:
                      'The focused-room view is generated from these numbers — the building glb is never cut.',
                  },
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'floorY',
                          type: 'number',
                          defaultValue: 0,
                          admin: {
                            description: 'Walkable floor level. Furniture stands on this plane.',
                          },
                        },
                        {
                          name: 'wallHeight',
                          type: 'number',
                          defaultValue: SHELL_DEFAULTS.wallHeight,
                        },
                        {
                          name: 'wallThickness',
                          type: 'number',
                          defaultValue: SHELL_DEFAULTS.wallThickness,
                        },
                      ],
                    },
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'floorThickness',
                          type: 'number',
                          defaultValue: SHELL_DEFAULTS.floorThickness,
                        },
                        {
                          name: 'ceilingThickness',
                          type: 'number',
                          defaultValue: SHELL_DEFAULTS.ceilingThickness,
                        },
                      ],
                    },
                    {
                      name: 'sunDirection',
                      type: 'select',
                      options: [...SUN_DIRECTION_OPTIONS],
                      admin: {
                        description:
                          'Compass point the sun is on. Windows in walls facing it throw daylight in. Leave empty to put the sun outside whichever wall has the most glass.',
                      },
                    },
                    {
                      // Shape: { w1: {x,z}, ... }.
                      name: 'sideAxes',
                      type: 'json',
                      admin: { description: 'Outward direction per wall. Set from the editor.' },
                    },
                  ],
                },
                {
                  // JSON, not an array field: Payload re-inserts array rows on update, so row ids are not stable.
                  // Entries are { id, side, kind, along, width, height, sill }.
                  name: 'openings',
                  type: 'json',
                  admin: {
                    description: 'Doors and windows per wall — placed in the Scene Editor.',
                  },
                },
                {
                  name: 'surfaces',
                  type: 'group',
                  admin: { description: 'Textures applied to the generated room.' },
                  fields: TEXTURED_SURFACE_OPTIONS.map((option) => ({
                    name: option.value,
                    type: 'group' as const,
                    label: option.label,
                    fields: [
                      { name: 'texture', type: 'upload' as const, relationTo: 'textures' as const },
                      {
                        type: 'row' as const,
                        fields: [
                          {
                            name: 'tileWidth',
                            type: 'number' as const,
                            defaultValue: 1,
                            admin: { description: 'Meters covered by one horizontal repeat.' },
                          },
                          {
                            name: 'tileHeight',
                            type: 'number' as const,
                            defaultValue: 1,
                            admin: { description: 'Meters covered by one vertical repeat.' },
                          },
                        ],
                      },
                    ],
                  })),
                },
                {
                  name: 'openingModels',
                  type: 'group',
                  admin: {
                    description:
                      'Real 3D doors and windows. Assign one and it replaces the flat leaf for every opening of that kind in this room.',
                  },
                  fields: OPENING_KIND_OPTIONS.map((option) => ({
                    name: option.value,
                    type: 'group' as const,
                    label: option.label,
                    fields: [
                      {
                        name: 'model',
                        type: 'relationship' as const,
                        relationTo: 'models' as const,
                      },
                      {
                        name: 'fit',
                        type: 'select' as const,
                        defaultValue: 'stretch',
                        options: [...OPENING_FIT_OPTIONS],
                        admin: { description: 'How the model is sized into the opening.' },
                      },
                      {
                        type: 'row' as const,
                        fields: [
                          {
                            name: 'yawDeg',
                            type: 'number' as const,
                            defaultValue: 0,
                            admin: {
                              description:
                                'Turn the source model so its front faces out of the room.',
                            },
                          },
                          {
                            name: 'depth',
                            type: 'number' as const,
                            defaultValue: 0,
                            admin: {
                              description: 'Metres from the middle of the wall, + is outward.',
                            },
                          },
                        ],
                      },
                    ],
                  })),
                },
                {
                  name: 'cameraPreset',
                  type: 'group',
                  admin: { description: 'Camera fly-to when this room is focused.' },
                  fields: [vec3Field('position'), vec3Field('target')],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
