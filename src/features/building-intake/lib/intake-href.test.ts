import { describe, expect, it } from 'vitest'

import { changeSelectionHref } from './intake-href'

function paramsOf(href: string): URLSearchParams {
  return new URL(href, 'https://example.test').searchParams
}

describe('changeSelectionHref', () => {
  it('carries every answer back to the form', () => {
    const params = paramsOf(changeSelectionHref({ line: 'boxxplex', units: 5, restrooms: 2 }))

    expect(params.get('building')).toBe('boxxplex')
    expect(params.get('offices')).toBe('5')
    expect(params.get('restrooms')).toBe('2')
  })

  // Without it the page resolves a building and never shows the form, which is
  // the loop this link is meant to break.
  it('always says it wants the form', () => {
    expect(paramsOf(changeSelectionHref({})).get('change')).toBe('1')
    expect(paramsOf(changeSelectionHref({ line: 'boxxplex' })).get('change')).toBe('1')
  })

  it('keeps the catalogue the visitor is browsing', () => {
    expect(paramsOf(changeSelectionHref({}, 'us')).get('region')).toBe('us')
    expect(paramsOf(changeSelectionHref({})).has('region')).toBe(false)
  })

  // An answer that was never given must not come back as one: the form's own
  // defaults are the honest thing to show.
  it('leaves out what was never answered', () => {
    const params = paramsOf(changeSelectionHref({ line: 'boxxplex' }))

    expect(params.has('offices')).toBe(false)
    expect(params.has('restrooms')).toBe(false)
  })

  // Zero restrooms is an answer, and `if (answers.restrooms)` would drop it.
  it('treats zero as an answer', () => {
    expect(paramsOf(changeSelectionHref({ restrooms: 0 })).get('restrooms')).toBe('0')
  })

  it('escapes what it is given', () => {
    const params = paramsOf(changeSelectionHref({ line: 'a b&c=d' }, 'x y'))

    expect(params.get('building')).toBe('a b&c=d')
    expect(params.get('region')).toBe('x y')
  })
})
