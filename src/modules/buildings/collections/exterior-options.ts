import type { CollectionConfig } from 'payload'

/**
 * One thing that can stand at an entrance — a deck, a set of stairs, a ramp.
 *
 * A catalogue entry, and nothing more: the model, and what a customer needs to
 * read about it. Where it stands is not here and cannot be, because the same
 * ramp sits differently on every building — that is set in the Scene Editor,
 * against the spot it belongs to.
 *
 * It used to carry a template of parts with default offsets, copied into a
 * building when the option was added there. Once placement moved into the scene
 * that template only described what the editor overwrote on the first drag, so
 * it is gone: one option, one model. Two ramps are two entries, which is also
 * how a customer reads them — two cards, two prices.
 */
export const ExteriorOptions: CollectionConfig = {
  slug: 'exterior-options',
  labels: { singular: 'Exterior Option', plural: 'Exterior Options' },
  admin: {
    group: 'Catalog',
    useAsTitle: 'title',
    defaultColumns: ['title', 'price', 'updatedAt'],
    description:
      'Decks, stairs and ramps offered at an entrance. Positioned per building in the Scene Editor.',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'model',
      type: 'relationship',
      relationTo: 'models',
      required: true,
      admin: {
        description: 'The 3D model placed at the entrance when a visitor picks this.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'price',
          type: 'number',
          admin: {
            description: 'USD. Left blank the option is offered without a price.',
          },
        },
        { name: 'thumbnail', type: 'relationship', relationTo: 'images' },
      ],
    },
    { name: 'description', type: 'textarea' },
  ],
}
