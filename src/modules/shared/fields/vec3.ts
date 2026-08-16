import type { GroupField } from 'payload'

/** Reusable {x, y, z} group field for positions/targets in model space (meters). */
export function vec3Field(
  name: string,
  options: { label?: string; required?: boolean; defaultValue?: number } = {},
): GroupField {
  // A scale wants ones where a position wants zeros, and a zero on any axis
  // flattens the model out of existence.
  const value = options.defaultValue ?? 0

  return {
    name,
    type: 'group',
    label: options.label,
    fields: [
      { name: 'x', type: 'number', required: options.required, defaultValue: value },
      { name: 'y', type: 'number', required: options.required, defaultValue: value },
      { name: 'z', type: 'number', required: options.required, defaultValue: value },
    ],
  }
}
