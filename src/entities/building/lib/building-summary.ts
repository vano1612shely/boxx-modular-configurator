import type { BuildingScene } from '../model/types'
import { areaIn, formatArea, type AreaUnit } from '@/shared/lib'

export type SummaryFact = { label: string; value: string }

const NUMBER = new Intl.NumberFormat('en-US')
const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/**
 * The facts worth stating about a building, with the blanks left out.
 *
 * The client's own rule: anything not filled in simply does not appear. So the
 * absent ones are dropped here rather than rendered empty, and a caller with an
 * empty list knows there is no panel to draw at all.
 *
 * Zero is a fact — no restrooms is worth saying on a building that has none —
 * which is why these are null checks and not truthiness.
 *
 * `unit` reaches the area and the overall dimensions. The dimensions are free
 * text with feet baked into them, so there is nothing to convert: a visitor
 * reading metres gets the metric text if someone wrote one, and no row if not.
 */
export function buildingSummary(building: BuildingScene, unit: AreaUnit): SummaryFact[] {
  const facts: SummaryFact[] = [
    { label: capitalise(building.line.unitLabel), value: NUMBER.format(building.unitCount) },
  ]

  if (building.restroomCount > 0) {
    facts.push({ label: 'Restrooms', value: NUMBER.format(building.restroomCount) })
  }
  if (building.occupancy !== null) {
    facts.push({ label: 'Estimated occupancy', value: NUMBER.format(building.occupancy) })
  }

  const area = areaIn(unit, { sqft: building.sqft, sqm: building.sqm }, null)
  if (area !== null) {
    facts.push({ label: 'Approx. floor area', value: formatArea(area, unit) })
  }

  const dimensions = unit === 'sqft' ? building.dimensions : building.dimensionsMetric
  if (dimensions) {
    facts.push({ label: 'Dimensions', value: dimensions })
  }

  if (building.estimatedPrice !== null) {
    facts.push({ label: 'Estimated price', value: MONEY.format(building.estimatedPrice) })
  }
  if (building.leadTime) {
    facts.push({ label: 'Estimated lead time', value: building.leadTime })
  }

  return facts
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
