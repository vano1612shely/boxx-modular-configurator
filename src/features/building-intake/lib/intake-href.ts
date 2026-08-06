/** What the visitor answered in the quiz, spelled the way the URL carries it. */
export type IntakeAnswers = {
  /** Building line slug. */
  line?: string
  units?: number
  restrooms?: number
}

/**
 * Link back to the quiz with the visitor's own answers still in it.
 *
 * `change` is what makes it the quiz: a URL carrying a line slug is an ordinary
 * configurator link, so without the flag "change selection" would resolve a
 * building and land straight back where it started.
 *
 * The answers are what was *asked for*, not what the catalogue resolved to —
 * someone who asked for five offices and was shown the six-office model came
 * back to change five, and being handed six instead is the same lost answer the
 * defaults were.
 */
export function changeSelectionHref(answers: IntakeAnswers, region?: string): string {
  const params = new URLSearchParams({ change: '1' })

  if (answers.line) params.set('building', answers.line)
  if (answers.units !== undefined) params.set('offices', String(answers.units))
  if (answers.restrooms !== undefined) params.set('restrooms', String(answers.restrooms))
  if (region) params.set('region', region)

  return `/configurator?${params}`
}
