import { describe, expect, it, vi } from 'vitest'

import { measureFootprint } from './measure-footprint'

const META = { bboxMin: [-1.1, 0, -0.8], bboxMax: [1.075, 1.1, 0.7] }

function reqWith(meta: unknown, id = 2) {
  const findByID = vi.fn().mockResolvedValue({ id, meta })
  return {
    req: { payload: { findByID, logger: { warn: vi.fn() } } },
    findByID,
  }
}

type HookArgs = Parameters<typeof measureFootprint>[0]

const run = (args: {
  data: Record<string, unknown>
  operation?: 'create' | 'update'
  originalDoc?: Record<string, unknown>
  meta?: unknown
}) => {
  const { req, findByID } = reqWith('meta' in args ? args.meta : META)
  const result = measureFootprint({
    data: args.data,
    operation: args.operation ?? 'create',
    originalDoc: args.originalDoc,
    req,
  } as unknown as HookArgs)
  return { result, findByID }
}

describe('measureFootprint', () => {
  it('measures a package that was saved without one', async () => {
    const { result } = run({ data: { model: 2 } })

    expect(await result).toMatchObject({ footprint: { width: 2.175, depth: 1.5 } })
  })

  it('never overwrites numbers somebody chose', async () => {
    const { result, findByID } = run({
      data: { model: 2, footprint: { width: 1, depth: 1 } },
      operation: 'update',
      originalDoc: { model: 2 },
    })

    expect(await result).toMatchObject({ footprint: { width: 1, depth: 1 } })
    expect(findByID).not.toHaveBeenCalled()
  })

  it('re-measures when the model is swapped for a different one', async () => {
    const { result } = run({
      data: { model: 2, footprint: { width: 9, depth: 9 } },
      operation: 'update',
      originalDoc: { model: 7 },
    })

    expect(await result).toMatchObject({ footprint: { width: 2.175, depth: 1.5 } })
  })

  it('reads the id out of a populated relationship', async () => {
    const { result, findByID } = run({ data: { model: { id: 2, title: 'Office Core' } } })

    await result
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }))
  })

  it('leaves the footprint alone when the model was never measured', async () => {
    const { result } = run({ data: { model: 2 }, meta: null })

    expect((await result).footprint).toBeUndefined()
  })

  it('does nothing without a model to measure', async () => {
    const { result, findByID } = run({ data: { title: 'no model yet' } })

    expect(await result).toEqual({ title: 'no model yet' })
    expect(findByID).not.toHaveBeenCalled()
  })

  it('survives a model that cannot be read', async () => {
    const findByID = vi.fn().mockRejectedValue(new Error('gone'))
    const warn = vi.fn()
    const data = { model: 2 }

    const result = await measureFootprint({
      data,
      operation: 'create',
      req: { payload: { findByID, logger: { warn } } },
    } as unknown as HookArgs)

    expect(result).toEqual({ model: 2 })
    expect(warn).toHaveBeenCalled()
  })
})
