'use client'

import { ArrowLeft, ChevronDown, DoorOpen } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import { buildingSummary, FactsPanel, roomFacts } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { areaIn, cn, formatArea, type AreaUnit } from '@/shared/lib'
import { Chip, FloatingBar, Pill, SceneOverlay } from '@/shared/ui/boxx'
import { Show } from '@/shared/ui/control-flow'

type Props = {
  building: BuildingScene
  /** The admin's unit for floor areas; the reader may override it for the session. */
  defaultAreaUnit: AreaUnit
}

/**
 * The configurator's header without the one control that changes anything.
 *
 * "Change selection" is gone and nothing takes its place: a saved order has no
 * selection to change, and a link back to the quiz from somebody else's order
 * would be an invitation to start over on a page that is not theirs. Everything
 * else here reports — the building, its facts, the room being stood in, the
 * units those facts are read in — and reporting is what this page is for.
 */
export function OrderHeader({ building, defaultAreaUnit }: Props) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const activeZoneKey = useConfiguratorSession((s) => s.activeZoneKey)
  const clearFocus = useConfiguratorSession((s) => s.exitRoomFocus)
  const override = useConfiguratorSession((s) => s.areaUnitOverride)
  const setAreaUnit = useConfiguratorSession((s) => s.setAreaUnit)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const unit = override ?? defaultAreaUnit
  const facts = useMemo(() => buildingSummary(building, unit), [building, unit])

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
      className="max-w-[calc(100%-5rem)] desktop:max-w-[calc(100%-24rem)]"
    >
      <div className="pointer-events-none flex min-w-0 flex-col items-start gap-2">
        <Show
          when={room}
          fallback={
            <>
              <FloatingBar shape="panel" className="pointer-events-auto min-w-0 max-w-full">
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
