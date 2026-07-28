'use client'

import { For } from '@/shared/ui/control-flow'

import { s, segmentItem } from '../editor-styles'

/**
 * A labelled two-or-three-way switch.
 *
 * The editor used to show "View 3D | 2D plan  Preview Off | Building | Room"
 * as one undifferentiated row of buttons, which read as six unrelated tools.
 * A named track per question makes each one answerable at a glance.
 */

export type SegmentOption<T extends string> = {
  value: T
  label: string
  title?: string
}

type Props<T extends string> = {
  label: string
  value: T
  options: ReadonlyArray<SegmentOption<T>>
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <div style={s.field}>
      <span style={s.label}>{label}</span>
      <div role="group" aria-label={label} style={s.segmentTrack}>
        <For each={options} getKey={(option) => option.value}>
          {(option) => (
            <button
              type="button"
              aria-pressed={option.value === value}
              title={option.title}
              style={segmentItem(option.value === value)}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
