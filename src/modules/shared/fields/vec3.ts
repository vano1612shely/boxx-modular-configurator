import type { GroupField } from 'payload'

/** Reusable {x, y, z} group field for positions/targets in model space (meters). */
export function vec3Field(name: string, options: { label?: string; required?: boolean } = {}): GroupField {
  return {
    name,
    type: 'group',
    label: options.label,
    fields: [
      { name: 'x', type: 'number', required: options.required, defaultValue: 0 },
      { name: 'y', type: 'number', required: options.required, defaultValue: 0 },
      { name: 'z', type: 'number', required: options.required, defaultValue: 0 },
    ],
  }
}
