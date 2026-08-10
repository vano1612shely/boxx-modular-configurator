import { getConsoleFunction } from 'three'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import './quiet-deprecations'

/** The handler the module installed, which is what three itself would call. */
function installed() {
  const handler = getConsoleFunction()
  if (!handler) throw new Error('nothing claimed the console hook')
  return handler as (type: 'log' | 'warn' | 'error', message: string, ...rest: unknown[]) => void
}

describe('quiet-deprecations', () => {
  let warn: ReturnType<typeof vi.spyOn>
  let error: ReturnType<typeof vi.spyOn>

  beforeAll(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('swallows the one line r3f raises and we cannot act on', () => {
    warn.mockClear()
    installed()('warn', 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.')
    expect(warn).not.toHaveBeenCalled()
  })

  // The whole point of naming the message rather than muting the channel: a
  // filter that hid everything would cost more than the noise it removed.
  it('passes every other warning straight through', () => {
    warn.mockClear()
    installed()('warn', 'THREE.WebGLRenderer: Context Lost.')
    expect(warn).toHaveBeenCalledWith('THREE.WebGLRenderer: Context Lost.')
  })

  it('never touches errors, whatever they say', () => {
    error.mockClear()
    installed()('error', 'THREE.Clock: This module has been deprecated.')
    expect(error).toHaveBeenCalled()
  })
})
