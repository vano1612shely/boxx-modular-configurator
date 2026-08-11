import { describe, expect, it } from 'vitest'

import { fillTokens, QUIZ_COPY_DEFAULTS } from './quiz-copy'

describe('fillTokens', () => {
  it('puts the figures into an admin-written sentence', () => {
    expect(fillTokens('{units} units of {line}', { units: '12', line: 'BOXXPlex' })).toBe(
      '12 units of BOXXPlex',
    )
  })

  it('fills a slot used more than once', () => {
    expect(fillTokens('{line}, {line}', { line: 'A' })).toBe('A, A')
  })

  // A typo should read as a typo. Blanking it would quietly delete meaning the
  // writer thought they had put there.
  it('leaves a slot nobody supplied standing', () => {
    expect(fillTokens('{units} of {typo}', { units: '3' })).toBe('3 of {typo}')
  })

  it('leaves a sentence with no slots exactly as written', () => {
    expect(fillTokens('Nothing to fill.', { units: '3' })).toBe('Nothing to fill.')
  })

  it('is not fooled by braces around nothing', () => {
    expect(fillTokens('a {} b', { units: '3' })).toBe('a {} b')
  })

  it('carries the shipped over-capacity sentence', () => {
    expect(
      fillTokens(QUIZ_COPY_DEFAULTS.overCapacity.body, { units: '40', line: 'BOXXPlex' }),
    ).toBe(
      '40 units is beyond the largest standard BOXXPlex configuration. Our team will put together an individual proposal for you.',
    )
  })
})
