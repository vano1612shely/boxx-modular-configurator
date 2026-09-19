// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { processModelUpload } from './process-model-upload'
import { processTextureUpload } from './process-texture-upload'

/**
 * The hooks run before access is checked, so what they do for a request that
 * access is about to refuse matters. A file with a name they reject is the
 * probe: a hook that has started work throws on it, a hook that stood aside
 * hands the arguments back untouched.
 */
type Hook = typeof processModelUpload | typeof processTextureUpload

function run(hook: Hook, who: { user: unknown; overrideAccess: boolean }) {
  const args = { overrideAccess: who.overrideAccess } as never
  return hook({
    args,
    operation: 'create',
    req: {
      user: who.user,
      file: { data: Buffer.from('not a file'), name: 'payload.exe', mimetype: 'x', size: 10 },
      context: {},
    } as never,
    collection: {} as never,
    context: {},
  } as never)
}

describe.each([
  ['models', processModelUpload],
  ['textures', processTextureUpload],
] as const)('%s upload hook', (_collection, hook) => {
  it('does nothing for an anonymous request, which access will refuse', async () => {
    await expect(run(hook, { user: null, overrideAccess: false })).resolves.toEqual({
      overrideAccess: false,
    })
  })

  it('still works for a signed-in admin', async () => {
    await expect(run(hook, { user: { id: 1 }, overrideAccess: false })).rejects.toThrow(/supported/)
  })

  it('still works for the Local API, which has no user but overrides access', async () => {
    await expect(run(hook, { user: null, overrideAccess: true })).rejects.toThrow(/supported/)
  })
})
