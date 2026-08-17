import type { CollectionConfig } from 'payload'

/**
 * What a room is for — an office, a kitchen, a conference room.
 *
 * The same list answers two questions that have to agree: what a room in a
 * building is, and where a furniture package is offered. Keeping them one list
 * is the whole point — a package compatible with "kitchen" and a room typed
 * "kitchen" only meet because both words come from here.
 *
 * A collection rather than a fixed list in the code, so a new kind of room can
 * be added without a deploy. Nothing in the app branches on a particular type;
 * they are compared, never known in advance.
 */
export const RoomTypes: CollectionConfig = {
  slug: 'room-types',
  labels: { singular: 'Room Type', plural: 'Room Types' },
  admin: {
    group: 'Catalog',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
    description:
      'What rooms can be, and what furniture can be offered for. Used by building models and by furniture packages.',
  },
  access: {
    read: () => true,
  },
  defaultSort: 'name',
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Shown in the admin and to the visitor.' } },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'Stable key, e.g. "kitchen". Rooms and packages are matched on this, so changing it on a type already in use breaks that match.',
      },
    },
  ],
}
