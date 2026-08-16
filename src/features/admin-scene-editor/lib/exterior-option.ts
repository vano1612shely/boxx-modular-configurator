/** What a choice stores: a bare id, or the option read back populated. */
type OptionRef = number | { id: number } | null | undefined

/** As much of a catalogue entry as resolving a model needs. */
type CatalogueEntry = {
  id: number
  modelUrl: string | null
}

/**
 * The id behind a choice's option, whether it came back populated or not.
 *
 * A document read at depth 1 has the option as an object; a choice added in
 * this session has only the id it was picked by. Both mean the same entry.
 */
export function optionIdOf(option: OptionRef): number | null {
  if (typeof option === 'number') return option
  return typeof option?.id === 'number' ? option.id : null
}

/**
 * Where the model of a choice's catalogue entry lives.
 *
 * Resolved through the catalogue rather than off the building document: the
 * document is read one level deep, which populates the option but leaves the
 * model inside it as a bare id. The catalogue is read a level deeper for
 * exactly this reason, so it is the only side that can answer — and it answers
 * for an entry uploaded a moment ago, without a save and a reload first.
 */
export function optionModelUrl(option: OptionRef, catalogue: CatalogueEntry[]): string | null {
  const id = optionIdOf(option)
  if (id === null) return null

  return catalogue.find((entry) => entry.id === id)?.modelUrl ?? null
}
