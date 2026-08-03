import type { CollectionConfig } from 'payload'

export const BuildingLines: CollectionConfig = {
  slug: 'building-lines',
  labels: { singular: 'Product Line', plural: 'Product Lines' },
  admin: {
    group: 'Catalog',
    useAsTitle: 'name',
    description: 'Product lines (e.g. BOXXPlex, EDUPlex, Mobile Office) and their sizing rules.',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Used in configurator URLs, e.g. ?building=boxxplex.' },
    },
    {
      name: 'unitLabel',
      type: 'select',
      required: true,
      defaultValue: 'offices',
      options: [
        { label: 'Offices', value: 'offices' },
        { label: 'Classrooms', value: 'classrooms' },
      ],
      admin: { description: 'What the customer-facing unit count means for this line.' },
    },
    { name: 'description', type: 'textarea' },
    {
      name: 'rules',
      type: 'group',
      admin: {
        description:
          'Regulatory thresholds for this line. The largest size on offer is not set here — it is read from the published Building Models.',
      },
      fields: [
        {
          name: 'restroomsRequiredAt',
          type: 'number',
          admin: {
            description:
              'Unit count at which restrooms become mandatory. Leave empty if never mandatory.',
          },
        },
        {
          name: 'secondRestroomSetAt',
          type: 'number',
          admin: {
            description: 'Unit count at which a second restroom set is required. Leave empty if never.',
          },
        },
      ],
    },
    {
      name: 'regions',
      type: 'relationship',
      relationTo: 'regions',
      hasMany: true,
    },
  ],
}
