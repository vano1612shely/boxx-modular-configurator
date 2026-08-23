'use client'

import { For } from '@/shared/ui/control-flow'

import { tone } from '../editor-styles'

export type TabDef<T extends string> = {
  value: T
  label: string
  /** Shown after the label. Zero is drawn, because "none yet" is worth knowing. */
  count?: number
  title?: string
}

type Props<T extends string> = {
  tabs: ReadonlyArray<TabDef<T>>
  value: T
  onChange: (value: T) => void
}

/**
 * The jobs this panel does, one at a time.
 *
 * The editor used to put every section of a context in one column: drawing an
 * outline, dressing its surfaces and arranging its fittings are three different
 * sittings, and they were one scroll with seven accordions in it. Tabs cost one
 * click to move between jobs and save the scroll through six things you are not
 * doing — which is the trade every editor of this kind makes.
 *
 * Sticky under the header rather than inside the scroll, so the row you switch
 * with is still there once you have scrolled a long section.
 */
export function Tabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div
      role="tablist"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        padding: '5px 6px',
        background: tone.panel,
        borderBottom: `1px solid ${tone.line}`,
      }}
    >
      <For each={tabs} getKey={(tab) => tab.value}>
        {(tab) => {
          const active = tab.value === value
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={tab.title}
              onClick={() => onChange(tab.value)}
              style={{
                flex: '0 0 auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 8px',
                borderRadius: 6,
                border: `1px solid ${active ? tone.lineStrong : 'transparent'}`,
                background: active ? tone.raised : 'transparent',
                color: active ? tone.text : tone.textMuted,
                fontSize: 11.5,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              {tab.count === undefined ? null : (
                <span
                  style={{
                    fontSize: 10,
                    fontVariantNumeric: 'tabular-nums',
                    color: active ? tone.textMuted : tone.textFaint,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        }}
      </For>
    </div>
  )
}
