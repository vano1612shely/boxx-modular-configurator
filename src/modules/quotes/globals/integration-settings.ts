import type { Field, GlobalConfig } from 'payload'

import { ORDER_SUCCESS_DEFAULTS } from '../../shared/order-success'

function text(name: string, defaultValue: string, description?: string): Field {
  return {
    name,
    type: 'text',
    defaultValue,
    admin: description ? { description } : undefined,
  }
}

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
    {
      // A group rather than a tab: the global is still five fields long, and
      // splitting four of them behind a tab would hide them from the one page
      // an admin opens to ask "what happens after somebody presses send".
      name: 'success',
      type: 'group',
      label: 'After submitting',
      admin: {
        description: 'What the visitor sees once a quote request has gone through.',
      },
      fields: [
        {
          name: 'redirectUrl',
          type: 'text',
          admin: {
            description:
              'Send the visitor here after a successful request. Leave empty to show our own thank-you page instead, which is what the wording below is for. A full address, starting with https://.',
          },
          // Caught here so a typo is answered while the admin is still looking
          // at the box. Checked again where it is used: this column may hold a
          // value typed before the rule existed.
          validate: (value: string | null | undefined) =>
            !value || value.trim() === '' || /^https?:\/\//i.test(value.trim())
              ? true
              : 'Enter a full address starting with https:// — or leave it empty.',
        },
        text('title', ORDER_SUCCESS_DEFAULTS.title, 'The heading on our own thank-you page.'),
        {
          name: 'body',
          type: 'textarea',
          defaultValue: ORDER_SUCCESS_DEFAULTS.body,
          admin: {
            description:
              'The sentence under it. Write {reference} where the order number should go; anything else in braces is left on screen as typed.',
          },
        },
        {
          name: 'showOrderLink',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Offer a button that opens the saved 3D view of the order. Shown on the thank-you page and beside the confirmation in the configurator.',
          },
        },
        text('viewOrderLabel', ORDER_SUCCESS_DEFAULTS.viewOrderLabel, 'The words on that button.'),
      ],
    },
  ],
}
