'use client'

import type { AreaUnit } from '@/shared/lib'
import { areaUnitLabel, AREA_UNITS, cn } from '@/shared/lib'
import { Card, Eyebrow } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

import type { SummaryFact } from '../lib/building-summary'

/**
 * The ft²/m² switch, sized to sit on the same line as the figure it converts.
 *
 * Beside the number rather than in a row of its own: it is a property of that
 * one figure, and a panel-wide control implied it governed the whole list.
 */
function UnitSwitch({ unit, onUnit }: { unit: AreaUnit; onUnit: (unit: AreaUnit) => void }) {
  return (
    <span
      role="group"
      aria-label="Units"
      className="inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-border"
    >
      <For each={AREA_UNITS} getKey={(value) => value}>
        {(value) => (
          <button
            type="button"
            aria-pressed={unit === value}
            onClick={() => onUnit(value)}
            className={cn(
              // Roomier for a finger, tight for a cursor: the two sit side by
              // side, so the worst a mis-tap can do is pick the other unit.
              'px-2 py-1 text-[0.625rem] leading-4 transition-colors',
              'desktop:px-1.5 desktop:py-px',
              unit === value
                ? 'bg-ink text-surface'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {areaUnitLabel(value)}
          </button>
        )}
      </For>
    </span>
  )
}

export type FactsPanelProps = {
  facts: SummaryFact[]
  /** Whether the phone shows it. On desktop it is always up. */
  open: boolean
  unit: AreaUnit
  onUnit: (unit: AreaUnit) => void
  className?: string
}

/**
 * The facts panel: open on desktop, behind a chevron on the phone.
 *
 * One tree, switched in CSS. There is no JS breakpoint in this codebase —
 * `isCoarsePointer` reports the pointer, not the width — and mounting two trees
 * for one list would leave the same `<dl>` in the DOM twice.
 */
export function FactsPanel({ facts, open, unit, onUnit, className }: FactsPanelProps) {
  return (
    <Card
      tone="surface"
      radius="panel"
      elevation="float"
      hairline
      pad="sm"
      className={cn(
        'pointer-events-auto w-[min(19rem,100%)]',
        // Capped and scrollable: the header paints over the view bar — both are
        // z 20 and the header renders later — so a panel tall enough to reach
        // the bottom would cover the bar's pickers instead of sliding under.
        'max-h-[calc(100dvh-13rem)] overflow-y-auto overscroll-contain',
        'hidden desktop:block',
        open && 'block',
        className,
      )}
    >
      <dl className="flex flex-col gap-2">
        <For each={facts} getKey={(fact) => fact.label}>
          {(fact) => (
            <div className="flex items-center justify-between gap-4">
              <Eyebrow as="dt" className="shrink-0">
                {fact.label}
              </Eyebrow>
              <dd className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-right text-sm font-medium tabular-nums">
                  {fact.value}
                </span>
                <Show when={fact.inUnits}>
                  <UnitSwitch unit={unit} onUnit={onUnit} />
                </Show>
              </dd>
            </div>
          )}
        </For>
      </dl>
    </Card>
  )
}
