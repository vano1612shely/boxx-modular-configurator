'use client'

import { ArrowLeft, DoorOpen } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { BuildingScene } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { Chip, FloatingBar, Pill, PillLink, SceneOverlay } from '@/shared/ui/boxx'
import { Show } from '@/shared/ui/control-flow'

export function ConfiguratorHeader({
  building,
  region,
}: {
  building: BuildingScene
  region?: string
}) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const clearFocus = useConfiguratorSession((s) => s.exitRoomFocus)
  // "Change selection" takes the exact place of "Back to building" — same
  // component, same index, so React keeps the row and swaps the control under
  // the pointer. A press queued while the scene was busy would then land on the
  // link and throw away everything the visitor had configured. An input made
  // before the link existed cannot have meant it; `timeStamp` records when the
  // press happened, not when it was dispatched, so the two are tellable apart.
  const shownAt = useRef(0)

  useEffect(() => {
    shownAt.current = focusedRoomKey === null ? performance.now() : 0
  }, [focusedRoomKey])

  const room = building.rooms.find((r) => r.key === focusedRoomKey) ?? null

  const meta = [
    `${building.unitCount} ${building.line.unitLabel}`,
    building.dimensions,
    building.sqft ? `${building.sqft} sq ft` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Capped so the opposite corner stays free for the quote button.
  return (
    <SceneOverlay
      as="header"
      corner="top-left"
      z="header"
      className="max-w-[calc(100%-5rem)] desktop:max-w-[calc(100%-14rem)]"
    >
      <Show
        when={room}
        fallback={
          <FloatingBar shape="panel" className="min-w-0">
            <PillLink
              href={region ? `/configurator?region=${encodeURIComponent(region)}` : '/configurator'}
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
          </FloatingBar>
        }
      >
        {(focused) => (
          <FloatingBar shape="panel" className="min-w-0">
            <Pill
              variant="primary"
              leadingIcon={<ArrowLeft size={16} />}
              onClick={clearFocus}
            >
              <span className="hidden desktop:inline">Back to building</span>
              <span className="desktop:hidden">Building</span>
            </Pill>
            <FloatingBar.Divider />
            <Chip icon={<DoorOpen />} className="min-w-0 shrink">
              <span className="truncate">{focused.name}</span>
            </Chip>
          </FloatingBar>
        )}
      </Show>
    </SceneOverlay>
  )
}
