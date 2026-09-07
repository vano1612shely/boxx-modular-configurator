'use client'

import { ArrowLeft, ChevronDown, DoorOpen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import { buildingSummary, FactsPanel, roomFacts } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { changeSelectionHref, type IntakeAnswers } from '@/features/building-intake'
import { areaIn, cn, formatArea, type AreaUnit } from '@/shared/lib'
import { Chip, FloatingBar, Pill, PillLink, SceneOverlay } from '@/shared/ui/boxx'
import { Show } from '@/shared/ui/control-flow'

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
  const activeZoneKey = useConfiguratorSession((s) => s.activeZoneKey)
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
  const zone = room?.zones.find((z) => z.key === activeZoneKey) ?? null

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

              <FactsPanel facts={facts} open={detailsOpen} unit={unit} onUnit={setAreaUnit} />
            </>
          }
        >
          {(focused) => (
            <>
              <FloatingBar shape="panel" className="pointer-events-auto min-w-0 max-w-full">
                {/* Icon alone on a phone, where the room's own name is what the
                    width is needed for. `labelFrom` keeps the words as the
                    button's accessible name, so it is still "Back to building"
                    to a screen reader at every size. */}
                <Pill
                  variant="primary"
                  leadingIcon={<ArrowLeft size={16} />}
                  labelFrom="desktop"
                  onClick={clearFocus}
                >
                  Back to building
                </Pill>
                <FloatingBar.Divider />
                <Chip icon={<DoorOpen />} className="min-w-0 shrink">
                  <span className="truncate">{focused.name}</span>
                </Chip>
                <FloatingBar.Divider />
                {toggle}
              </FloatingBar>

              <FactsPanel
                facts={roomFacts(focused, zone, unit, building.roomTypeNames)}
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
