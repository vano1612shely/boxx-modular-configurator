'use client'

import { useState, type CSSProperties } from 'react'

type Props = {
  value: number
  onCommit: (value: number) => void
  step?: number
  title?: string
  style?: CSSProperties
}

/** Holds the raw string while focused: a controlled number input drops the "." of a half-typed "1.25". */
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
