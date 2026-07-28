import type { GlobalConfig } from 'payload'

export const IntegrationSettings: GlobalConfig = {
  slug: 'integration-settings',
  admin: {
    group: 'Sales',
    description: 'Where finished configurations are delivered.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'webhookUrl',
      type: 'text',
      admin: {
        description:
          'Quote requests are POSTed here as JSON. Leave empty to only store them in the Quotes collection.',
      },
    },
    {
      name: 'webhookHeaders',
      type: 'array',
      admin: { description: 'Extra HTTP headers sent with the webhook (e.g. an API key).' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'key', type: 'text', required: true },
            { name: 'value', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      name: 'enablePostMessage',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Also emit the configuration to the embedding page via window.postMessage (iframe integration).',
      },
    },
    {
      name: 'targetOrigin',
      type: 'text',
      defaultValue: '*',
      admin: { description: 'Allowed origin for postMessage. Use the host-site origin in production.' },
    },
  ],
}
