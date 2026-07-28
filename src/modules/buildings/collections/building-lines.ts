import type { CollectionConfig } from 'payload'

export const BuildingLines: CollectionConfig = {
  slug: 'building-lines',
  // 'Building Lines' and 'Building Models' read almost identically in the nav.
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
        description: 'Sizing/business rules applied when resolving customer input to a model.',
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
        {
          name: 'maxUnits',
          type: 'number',
          admin: {
            description:
              'Largest standard size. Requests above this trigger the custom-quote flow instead of a model.',
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
