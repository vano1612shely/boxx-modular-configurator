import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'System',
    defaultColumns: ['email', 'updatedAt'],
  },
  auth: true,
  fields: [],
  versions: false,
}
