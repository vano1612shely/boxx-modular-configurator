import type { GlobalConfig } from 'payload'

export const DisplaySettings: GlobalConfig = {
  slug: 'display-settings',
  admin: {
    group: 'System',
    description: 'How figures are shown to visitors.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'areaUnit',
      type: 'select',
      defaultValue: 'sqft',
      required: true,
      options: [
        { label: 'Square feet (ft²)', value: 'sqft' },
        { label: 'Square metres (m²)', value: 'sqm' },
      ],
      admin: {
        description:
          'Unit floor areas open in. A visitor can switch it for their own session, and their ' +
          'choice does not change this.',
      },
    },
  ],
}
