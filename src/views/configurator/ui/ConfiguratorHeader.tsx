'use client'

import { ArrowLeft, ChevronDown, DoorOpen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { BuildingScene, RoomZone, SummaryFact } from '@/entities/building'
import { buildingSummary, roomArea } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { changeSelectionHref, type IntakeAnswers } from '@/features/building-intake'
import { ROOM_TYPE_OPTIONS } from '@/modules/shared/room-types'
import { areaIn, areaUnitLabel, AREA_UNITS, cn, formatArea, type AreaUnit } from '@/shared/lib'
import { Card, Chip, Eyebrow, FloatingBar, Pill, PillLink, SceneOverlay } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

const ROOM_TYPE_LABELS = new Map(ROOM_TYPE_OPTIONS.map((o) => [o.value, o.label]))

/**
 * The ft²/m² switch, sized to sit on the same line as the figure it converts.
 *
 * Beside the number rather than in a row of its own: it is a property of that
 * one figure, and a panel-wide control implied it governed the whole list.
 */
function UnitSwitch({
  unit,
  onUnit,
}: {
  unit: AreaUnit
  onUnit: (unit: AreaUnit) => void
}) {
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

/**
 * The facts panel: open on desktop, behind a chevron on the phone.
 *
 * One tree, switched in CSS. There is no JS breakpoint in this codebase —
 * `isCoarsePointer` reports the pointer, not the width — and mounting two trees
 * for one list would leave the same `<dl>` in the DOM twice.
 */
function FactsPanel({
  facts,
  open,
  unit,
  onUnit,
  className,
}: {
  facts: SummaryFact[]
  open: boolean
  unit: AreaUnit
  onUnit: (unit: AreaUnit) => void
  className?: string
}) {
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

/** Name is in the bar beside it, so the panel states what the bar cannot. */
function roomFacts(room: RoomZone, unit: AreaUnit): SummaryFact[] {
  return [
    { label: 'Type', value: ROOM_TYPE_LABELS.get(room.roomType) ?? room.roomType },
    // Always present: a room has an outline, so there is always an area to
    // measure even when nobody has written one down.
    { label: 'Approx. floor area', value: formatArea(roomArea(room, unit), unit), inUnits: true },
  ]
}

export function ConfiguratorHeader({
  building,
  region,
  answers,
  defaultAreaUnit,
}: {
  building: BuildingScene
  region?: string
  answers: IntakeAnswers
  defaultAreaUnit: AreaUnit
}) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const clearFocus = useConfiguratorSession((s) => s.exitRoomFocus)
  const override = useConfiguratorSession((s) => s.areaUnitOverride)
  const setAreaUnit = useConfiguratorSession((s) => s.setAreaUnit)
  // "Change selection" takes the exact place of "Back to building" — same
  // component, same index, so React keeps the row and swaps the control under
  // the pointer. A press queued while the scene was busy would then land on the
  // link and throw away everything the visitor had configured. An input made
  // before the link existed cannot have meant it; `timeStamp` records when the
  // press happened, not when it was dispatched, so the two are tellable apart.
  const shownAt = useRef(0)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const unit = override ?? defaultAreaUnit
  const facts = useMemo(() => buildingSummary(building, unit), [building, unit])

  useEffect(() => {
    shownAt.current = focusedRoomKey === null ? performance.now() : 0
  }, [focusedRoomKey])

  const room = building.rooms.find((r) => r.key === focusedRoomKey) ?? null

  const area = areaIn(unit, { sqft: building.sqft, sqm: building.sqm }, null)
  const meta = [
    `${building.unitCount} ${building.line.unitLabel}`,
    area === null ? null : formatArea(area, unit),
  ]
    .filter(Boolean)
    .join(' · ')

  const toggle = (
    <Pill
      variant="ghost"
      selected={detailsOpen}
      aria-expanded={detailsOpen}
      aria-label="Details"
      title="Details"
      className="desktop:hidden"
      leadingIcon={
        <ChevronDown
          size={16}
          className={cn('transition-transform', detailsOpen && 'rotate-180')}
        />
      }
      onClick={() => setDetailsOpen((open) => !open)}
    />
  )

  return (
    <SceneOverlay
      as="header"
      corner="top-left"
      z="header"
      // Room focus is the one state where the furniture aside is mounted on the
      // right; outside it the width belongs to the quote button alone.
      className={cn(
        'max-w-[calc(100%-5rem)]',
        room
          ? 'desktop:max-w-[calc(100%-24rem)] lg:max-w-[calc(100%-28rem)]'
          : 'desktop:max-w-[calc(100%-14rem)]',
      )}
    >
      {/* The column is the overlay's only direct child, so it is the one thing
          SceneOverlay hands pointer events back to — and a permanently open
          panel would then swallow every camera drag that started inside its box.
          Events are handed to the bar and the card instead. */}
      <div className="pointer-events-none flex min-w-0 flex-col items-start gap-2">
        <Show
          when={room}
          fallback={
            <>
              <FloatingBar shape="panel" className="pointer-events-auto min-w-0 max-w-full">
                <PillLink
                  href={changeSelectionHref(answers, region)}
                  variant="secondary"
                  leadingIcon={<ArrowLeft size={16} />}
                  labelFrom="desktop"
                  onClick={(event) => {
                    if (event.timeStamp < shownAt.current) event.preventDefault()
                  }}
                >
                  Change selection
                </PillLink>
                <FloatingBar.Divider />
                <div className="min-w-0">
                  <h1 className="truncate text-sm leading-normal font-medium">{building.title}</h1>
                  <p className="truncate text-xs text-muted-foreground">{meta}</p>
                </div>
                <FloatingBar.Divider />
                {toggle}
              </FloatingBar>

              <FactsPanel
                facts={facts}
                open={detailsOpen}
                unit={unit}
                onUnit={setAreaUnit}
              />
            </>
          }
        >
          {(focused) => (
            <>
              <FloatingBar shape="panel" className="pointer-events-auto min-w-0 max-w-full">
                <Pill variant="primary" leadingIcon={<ArrowLeft size={16} />} onClick={clearFocus}>
                  <span className="hidden desktop:inline">Back to building</span>
                  <span className="desktop:hidden">Building</span>
                </Pill>
                <FloatingBar.Divider />
                <Chip icon={<DoorOpen />} className="min-w-0 shrink">
                  <span className="truncate">{focused.name}</span>
                </Chip>
                <FloatingBar.Divider />
                {toggle}
              </FloatingBar>

              <FactsPanel
                facts={roomFacts(focused, unit)}
                open={detailsOpen}
                unit={unit}
                onUnit={setAreaUnit}
              />
            </>
          )}
        </Show>
      </div>
    </SceneOverlay>
  )
}
