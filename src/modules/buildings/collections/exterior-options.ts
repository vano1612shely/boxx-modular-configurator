import type { CollectionConfig } from 'payload'

import { vec3Field } from '../../shared/fields/vec3'

/**
 * What a visitor may pick for one exterior spot — a deck, a deck with stairs, a
 * deck with stairs and a ramp.
 *
 * This collection is the commercial identity only: the name on the card, the
 * picture, the price. Where the thing stands is never here, because the same
 * ramp sits differently on every building — that lives on the building model,
 * next to the spot it belongs to.
 *
 * The parts below are a *template*. Adding this option to a building copies them
 * in with their default offsets, and the admin drags them into place from there.
 * Nothing about a building changes when the template is edited afterwards, which
 * is the point: a catalogue tidy-up must not silently move geometry an admin has
 * already lined up.
 */
export const ExteriorOptions: CollectionConfig = {
  slug: 'exterior-options',
  labels: { singular: 'Exterior Option', plural: 'Exterior Options' },
  admin: {
    group: 'Catalog',
    useAsTitle: 'title',
    defaultColumns: ['title', 'price', 'updatedAt'],
    description:
      'Decks, stairs, ramps and canopies offered at an exterior spot. Placed per building in the Scene Editor.',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
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
    {
      name: 'parts',
      type: 'array',
      labels: { singular: 'Part', plural: 'Parts' },
      admin: {
        description:
          'Models this option is made of, with the offsets they usually sit at. Copied into a ' +
          'building when the option is added there — later edits here do not move anything ' +
          'already placed. An option built entirely from objects already in the building model ' +
          'needs none of these.',
      },
      fields: [
        { name: 'model', type: 'relationship', relationTo: 'models', required: true },
        vec3Field('position'),
        vec3Field('scale', { defaultValue: 1 }),
        { name: 'yawDeg', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'compatibleLines',
      type: 'relationship',
      relationTo: 'building-lines',
      hasMany: true,
      admin: {
        description:
          'Which lines this is offered for at all. Empty means every line. It only filters the ' +
          'picker — what a building actually offers is chosen there, spot by spot.',
      },
    },
    {
      name: 'regions',
      type: 'relationship',
      relationTo: 'regions',
      hasMany: true,
    },
  ],
}
