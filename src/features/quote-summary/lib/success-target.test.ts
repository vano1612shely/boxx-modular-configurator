import { describe, expect, it } from 'vitest'

import { successTarget } from './success-target'

const REF = 'ABCDEFGH2345'
const OWN = `/order/${REF}?submitted=1`

describe('successTarget', () => {
  it('falls back to our own thank-you page when nothing is configured', () => {
    expect(successTarget(null, REF)).toEqual({ kind: 'internal', href: OWN })
    expect(successTarget(undefined, REF)).toEqual({ kind: 'internal', href: OWN })
    expect(successTarget('', REF)).toEqual({ kind: 'internal', href: OWN })
    expect(successTarget('   ', REF)).toEqual({ kind: 'internal', href: OWN })
  })

  it('sends the visitor to an address the admin typed', () => {
    expect(successTarget('https://boxx.example/thanks', REF)).toEqual({
      kind: 'external',
      href: 'https://boxx.example/thanks',
    })
  })

  // A client still on http is a client, not a mistake to correct by redirecting
  // them somewhere else entirely.
  it('accepts http as well as https', () => {
    expect(successTarget('http://boxx.example/thanks', REF).kind).toBe('external')
  })

  it('keeps a same-origin path as a path, so it is navigated without a page load', () => {
    expect(successTarget('/thanks', REF)).toEqual({ kind: 'internal', href: '/thanks' })
  })

  // This string is about to be handed to window.location, where it is script
  // running on our own origin.
  it('refuses javascript: and falls back to our own page', () => {
    expect(successTarget('javascript:alert(1)', REF)).toEqual({ kind: 'internal', href: OWN })
    expect(successTarget('JavaScript:alert(1)', REF)).toEqual({ kind: 'internal', href: OWN })
    expect(successTarget('data:text/html,<script></script>', REF)).toEqual({
      kind: 'internal',
      href: OWN,
    })
  })

  // Two slashes is a jump off our origin wearing a path's clothes.
  it('refuses a protocol-relative address', () => {
    expect(successTarget('//evil.example/thanks', REF)).toEqual({ kind: 'internal', href: OWN })
  })

  it('refuses anything that is not an address at all', () => {
    expect(successTarget('boxx.example/thanks', REF)).toEqual({ kind: 'internal', href: OWN })
    expect(successTarget('mailto:sales@boxx.example', REF)).toEqual({ kind: 'internal', href: OWN })
  })

  it('encodes the reference into its own page', () => {
    expect(successTarget('', 'a/b?c').href).toBe('/order/a%2Fb%3Fc?submitted=1')
  })
})
