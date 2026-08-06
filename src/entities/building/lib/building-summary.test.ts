import { describe, expect, it } from 'vitest'

import type { BuildingScene } from '../model/types'
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
    dimensions: "24' x 56'",
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
    ...overrides,
  }
}

const labels = (building: BuildingScene) => buildingSummary(building).map((f) => f.label)
const find = (building: BuildingScene, label: string) =>
  buildingSummary(building).find((f) => f.label === label)?.value

describe('buildingSummary', () => {
  // The client's own rule for the panel.
  it('leaves out everything that was not filled in', () => {
    expect(labels(scene())).toEqual([
      'Offices',
      'Restrooms',
      'Approx. square feet',
      'Dimensions',
    ])
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
    expect(find(scene({ sqft: 12480 }), 'Approx. square feet')).toBe('12,480')
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
    expect(buildingSummary(bare)).toHaveLength(1)
  })
})
