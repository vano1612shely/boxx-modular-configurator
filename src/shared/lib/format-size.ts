// Binary units (1024) under SI labels, matching what file managers show.
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`

  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${UNITS[unit]}`
}

export function savingPercent(before: number | null | undefined, after: number | null | undefined): number | null {
  if (typeof before !== 'number' || typeof after !== 'number') return null
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return null
  if (after > before) return null
  return Math.round((1 - after / before) * 100)
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}
