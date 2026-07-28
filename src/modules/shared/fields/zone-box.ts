import type { Field } from 'payload'

/** Axis-aligned zone volume: two corners in model space (meters). */
export function zoneBoxFields(): Field[] {
  return [
    {
      name: 'min',
      type: 'group',
      fields: [
        { name: 'x', type: 'number', required: true, defaultValue: 0 },
        { name: 'y', type: 'number', required: true, defaultValue: 0 },
        { name: 'z', type: 'number', required: true, defaultValue: 0 },
      ],
    },
    {
      name: 'max',
      type: 'group',
      fields: [
        { name: 'x', type: 'number', required: true, defaultValue: 0 },
        { name: 'y', type: 'number', required: true, defaultValue: 0 },
        { name: 'z', type: 'number', required: true, defaultValue: 0 },
      ],
    },
  ]
}
