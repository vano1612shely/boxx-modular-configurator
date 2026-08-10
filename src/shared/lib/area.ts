export type AreaUnit = 'sqft' | 'sqm'

export const AREA_UNITS: readonly AreaUnit[] = ['sqft', 'sqm']

const SQ_FT_PER_SQ_M = 10.763910416709722

/** Whatever an area has been written down as. Either half may be missing. */
export type AuthoredArea = {
  sqft: number | null
  sqm: number | null
}

/**
 * An area in the unit asked for, or null when nothing is known.
 *
 * `tracedSqM` is what the outline measures — square metres, because that is what
 * the model is drawn in — and is null for anything with no outline to trace.
 *
 * Three cases, and the middle one is the interesting call:
 *
 * 1. Both units authored. Each is shown exactly as typed. Two rounded marketing
 *    figures that are not exact conversions of each other is a thing an admin
 *    may want, and second-guessing it would overwrite their intent.
 * 2. One unit authored. The other is **converted from it**, never traced. Someone
 *    who typed 208 ft² is holding a drawing better than the trace; putting a
 *    traced 20 m² beside their 208 ft² would show two numbers that disagree.
 * 3. Neither authored. Each unit comes from the outline in its own right — m²
 *    directly, ft² by one conversion of the same figure. Converting one derived
 *    number from the other would round twice.
 */
export function areaIn(
  unit: AreaUnit,
  authored: AuthoredArea,
  tracedSqM: number | null,
): number | null {
  const direct = unit === 'sqft' ? authored.sqft : authored.sqm
  if (direct !== null) return direct

  const other = unit === 'sqft' ? authored.sqm : authored.sqft
  if (other !== null) return unit === 'sqft' ? other * SQ_FT_PER_SQ_M : other / SQ_FT_PER_SQ_M

  if (tracedSqM === null) return null
  return unit === 'sqft' ? tracedSqM * SQ_FT_PER_SQ_M : tracedSqM
}

const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const ONE_PLACE = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * An area as it is shown, unit included.
 *
 * Rounded here rather than at the source, so one figure is never rounded twice
 * on its way to the screen. A square metre is about eleven square feet, so whole
 * metres would be a far coarser bucket than the whole feet visitors see today —
 * hence the decimal place on one and not the other.
 */
export function formatArea(value: number, unit: AreaUnit): string {
  return unit === 'sqft' ? `${WHOLE.format(value)} ft²` : `${ONE_PLACE.format(value)} m²`
}

/** How the unit is named on a control that switches between them. */
export function areaUnitLabel(unit: AreaUnit): string {
  return unit === 'sqft' ? 'ft²' : 'm²'
}
