/** An emptied box means "use the wording nobody has changed", not "show nothing". */
export function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}
