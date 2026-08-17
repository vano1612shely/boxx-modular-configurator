import type { CollectionConfig } from 'payload'

/**
 * The grade a furniture package is offered at — core, plus, whatever comes next.
 *
 * A label the visitor reads on the card, and nothing the app decides anything
 * by. A collection so the grades can be renamed or added to without a deploy,
 * which is the only thing anyone has ever wanted to do with them.
 */
export const FurnitureTiers: CollectionConfig = {
  slug: 'furniture-tiers',
  labels: { singular: 'Furniture Tier', plural: 'Furniture Tiers' },
  admin: {
    group: 'Catalog',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
    description: 'Grades a furniture package can be offered at, shown on its card.',
  },
  access: {
    read: () => true,
  },
  defaultSort: 'name',
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Stable key, e.g. "core".' },
    },
  ],
}
