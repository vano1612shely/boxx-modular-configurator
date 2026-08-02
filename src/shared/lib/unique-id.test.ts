import { afterEach, describe, expect, it, vi } from 'vitest'

import { uniqueId } from './unique-id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function withCrypto(replacement: unknown) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', { value: replacement, configurable: true })
  return () => {
    if (original) Object.defineProperty(globalThis, 'crypto', original)
  }
}

let restore: (() => void) | null = null

afterEach(() => {
  restore?.()
  restore = null
})

describe('uniqueId', () => {
  it('uses randomUUID where it exists', () => {
    const randomUUID = vi.fn().mockReturnValue('11111111-2222-4333-8444-555555555555')
    restore = withCrypto({ randomUUID })

    expect(uniqueId()).toBe('11111111-2222-4333-8444-555555555555')
    expect(randomUUID).toHaveBeenCalled()
  })

  it('still works on a page served over plain http', () => {
    restore = withCrypto({ getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })

    expect(uniqueId()).toMatch(UUID_V4)
  })

  it('works with no Web Crypto at all', () => {
    restore = withCrypto(undefined)

    expect(uniqueId()).toMatch(UUID_V4)
  })

  it('does not repeat itself', () => {
    restore = withCrypto({ getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })

    const ids = new Set(Array.from({ length: 500 }, () => uniqueId()))
    expect(ids.size).toBe(500)
  })
})
