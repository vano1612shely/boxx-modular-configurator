import { describe, expect, it } from 'vitest'

import type { BuildingScene } from '../model/types'
import type { AreaUnit } from '@/shared/lib'
import { buildingSummary } from './building-summary'

function scene(overrides: Partial<BuildingScene> = {}): BuildingScene {
  return {
    id: 1,
    title: 'BOXXPlex 6',
    line: {
      id: 1,
      name: 'BOXXPlex',
      slug: 'boxxplex',
      unitLabel: 'offices',
      rules: { restroomsRequiredAt: null, secondRestroomSetAt: null },
    },
    unitCount: 6,
    restroomCount: 2,
    sqft: 1344,
    sqm: null,
    dimensions: "24' x 56'",
    dimensionsMetric: null,
    occupancy: null,
    estimatedPrice: null,
    leadTime: null,
    modelUrl: '/models/x.glb',
    camera: {} as BuildingScene['camera'],
    floors: [],
    roofBlocks: [],
    roofModel: null,
    hiddenNodePaths: [],
    rooms: [],
    exteriorSlots: [],
    ...overrides,
  }
}

const labels = (building: BuildingScene, unit: AreaUnit = 'sqft') =>
  buildingSummary(building, unit).map((f) => f.label)
const find = (building: BuildingScene, label: string, unit: AreaUnit = 'sqft') =>
  buildingSummary(building, unit).find((f) => f.label === label)?.value

describe('buildingSummary', () => {
  // The client's own rule for the panel.
  it('leaves out everything that was not filled in', () => {
    expect(labels(scene())).toEqual(['Offices', 'Restrooms', 'Approx. floor area', 'Dimensions'])
  })

  it('states the three new facts once they are there', () => {
    const full = scene({ occupancy: 48, estimatedPrice: 285000, leadTime: '8–10 weeks' })

    expect(find(full, 'Estimated occupancy')).toBe('48')
    expect(find(full, 'Estimated price')).toBe('$285,000')
    expect(find(full, 'Estimated lead time')).toBe('8–10 weeks')
  })

  it('names the units the way the product line does', () => {
    expect(labels(scene())[0]).toBe('Offices')
    const school = scene()
    school.line = { ...school.line, unitLabel: 'classrooms' }
    expect(labels(school)[0]).toBe('Classrooms')
  })

  it('groups thousands', () => {
    expect(find(scene({ sqft: 12480 }), 'Approx. floor area')).toBe('12,480 ft²')
  })

  it('converts the area for a metric reader', () => {
    expect(find(scene({ sqft: 1344 }), 'Approx. floor area', 'sqm')).toBe('124.9 m²')
    expect(find(scene({ sqft: 1344, sqm: 125 }), 'Approx. floor area', 'sqm')).toBe('125.0 m²')
  })

  // Free text with feet baked in: there is nothing to convert, so a metric
  // reader gets the metric text if someone wrote one and no row if not.
  it('swaps the dimensions text rather than converting it', () => {
    expect(labels(scene(), 'sqm')).not.toContain('Dimensions')
    expect(find(scene({ dimensionsMetric: '7.3 m × 17.1 m' }), 'Dimensions', 'sqm')).toBe(
      '7.3 m × 17.1 m',
    )
    expect(find(scene({ dimensionsMetric: '7.3 m × 17.1 m' }), 'Dimensions')).toBe("24' x 56'")
  })

  // A price of zero is not "free", it is someone having typed a zero, and a
  // truthiness check would have hidden it. Restrooms are the opposite case:
  // "0 restrooms" is noise on a building that never has any.
  it('shows a zero price but not a zero restroom count', () => {
    expect(find(scene({ estimatedPrice: 0 }), 'Estimated price')).toBe('$0')
    expect(labels(scene({ restroomCount: 0 }))).not.toContain('Restrooms')
  })

  it('never returns an empty list, so there is always something to say', () => {
    const bare = scene({ sqft: null, dimensions: null, restroomCount: 0 })
    expect(buildingSummary(bare, 'sqft')).toHaveLength(1)
  })
})

describe('the unit switch', () => {
  // The control belongs to one figure, and there is no figure to convert when
  // nobody wrote an area down — so the panel must not offer to convert it.
  it('is offered only on the area row', () => {
    const marked = buildingSummary(scene(), 'sqft').filter((fact) => fact.inUnits)

    expect(marked).toHaveLength(1)
    expect(marked[0].label).toBe('Approx. floor area')
  })

  it('is not offered at all when no area was authored', () => {
    const areaLess = buildingSummary(scene({ sqft: null, sqm: null }), 'sqft')

    expect(areaLess.some((fact) => fact.inUnits)).toBe(false)
  })
})
