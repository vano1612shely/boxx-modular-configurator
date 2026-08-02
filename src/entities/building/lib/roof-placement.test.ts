import { describe, expect, it } from 'vitest'

import { fitRoofToBuilding } from './roof-placement'

const building = { min: [-6, 0, -9] as const, max: [6, 3, 9] as const }

const box = (
  min: [number, number, number],
  max: [number, number, number],
) => ({ min, max })

describe('fitRoofToBuilding', () => {
  it('centres the roof over the building and rests it on top', () => {
    const { position, scale } = fitRoofToBuilding(
      { min: [...building.min], max: [...building.max] },
      box([-6, 0, -9], [6, 0.5, 9]),
    )

    expect(scale).toBeCloseTo(1, 9)
    expect(position[0]).toBeCloseTo(0, 9)
    expect(position[2]).toBeCloseTo(0, 9)
    expect(position[1]).toBeCloseTo(3, 9)
  })

  it('shrinks by the axis that needs it most, so the footprint is covered', () => {
    const { scale } = fitRoofToBuilding(
      { min: [...building.min], max: [...building.max] },
      box([0, 0, 0], [24, 1, 72]),
    )

    expect(scale).toBeCloseTo(0.25, 9)
  })

  it('places by the model’s own centre, not by its origin', () => {
    const { position, scale } = fitRoofToBuilding(
      { min: [...building.min], max: [...building.max] },
      box([10, 0, 20], [22, 1, 38]),
    )

    expect(scale).toBeCloseTo(1, 9)
    expect(position[0]).toBeCloseTo(-16, 9)
    expect(position[2]).toBeCloseTo(-29, 9)
  })

  it('lifts a roof whose own base sits above its origin', () => {
    const { position } = fitRoofToBuilding(
      { min: [...building.min], max: [...building.max] },
      box([-6, 4, -9], [6, 5, 9]),
    )

    expect(position[1]).toBeCloseTo(-1, 9)
  })

  it('refuses to divide by a flat axis', () => {
    const { scale, position } = fitRoofToBuilding(
      { min: [...building.min], max: [...building.max] },
      box([0, 0, 0], [0, 0, 0]),
    )

    expect(scale).toBe(1)
    expect(position.every(Number.isFinite)).toBe(true)
  })
})
