import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { BOXX } from './scene-tokens'

const css = readFileSync(join(process.cwd(), 'src/providers/styles/globals.css'), 'utf8')

function declared(name: string): string | null {
  const match = css.match(new RegExp(`--boxx-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))
  return match ? match[1].toLowerCase() : null
}

/** three.js reads these as hex, the DOM reads them from CSS. Only one may be wrong at a time. */
describe('scene tokens mirror globals.css', () => {
  const pairs: Array<[keyof typeof BOXX, string]> = [
    ['cherry', 'cherry'],
    ['cherryDeep', 'cherry-deep'],
    ['gold', 'gold'],
    ['ink', 'ink'],
    ['sand', 'sand'],
    ['sandDeep', 'sand-deep'],
    ['surface', 'surface'],
    ['danger', 'danger'],
  ]

  it.each(pairs)('%s matches --boxx-%s', (key, cssName) => {
    expect(declared(cssName)).toBe(BOXX[key].toLowerCase())
  })
})
