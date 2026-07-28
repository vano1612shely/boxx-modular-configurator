'use client'

import { useState, type CSSProperties } from 'react'

type Props = {
  value: number
  onCommit: (value: number) => void
  step?: number
  title?: string
  style?: CSSProperties
}

/**
 * A number field you can actually type into.
 *
 * A plain controlled `<input type="number" value={someNumber}>` rewrites the
 * text on every keystroke, so the "." in "1.25" is dropped the moment it is
 * typed and you end up with 125. Holding the raw string while the field has
 * focus keeps half-typed values intact; the number is committed as soon as it
 * parses, and the display re-syncs to the real value on blur.
 */
export function NumberInput({ value, onCommit, step = 0.01, title, style }: Props) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      type="number"
      step={step}
      title={title}
      style={style}
      value={draft ?? String(Number.isFinite(value) ? Number(value.toFixed(3)) : 0)}
      onChange={(event) => {
        setDraft(event.target.value)
        const next = event.target.valueAsNumber
        if (!Number.isNaN(next)) onCommit(next)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
