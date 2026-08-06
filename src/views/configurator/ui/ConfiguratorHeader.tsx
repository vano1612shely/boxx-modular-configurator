'use client'

import { ArrowLeft, ChevronDown, DoorOpen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { BuildingScene } from '@/entities/building'
import { buildingSummary } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { changeSelectionHref, type IntakeAnswers } from '@/features/building-intake'
import { cn } from '@/shared/lib'
import { Chip, FloatingBar, Pill, PillLink, SceneOverlay } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

export function ConfiguratorHeader({
  building,
  region,
  answers,
}: {
  building: BuildingScene
  region?: string
  answers: IntakeAnswers
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
  const [detailsOpen, setDetailsOpen] = useState(false)
  const facts = useMemo(() => buildingSummary(building), [building])

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
          <div className="flex min-w-0 flex-col items-start gap-2">
            <FloatingBar shape="panel" className="min-w-0 max-w-full">
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
              <Pill
                variant="ghost"
                selected={detailsOpen}
                aria-expanded={detailsOpen}
                aria-label="Building details"
                title="Building details"
                leadingIcon={
                  <ChevronDown
                    size={16}
                    className={cn('transition-transform', detailsOpen && 'rotate-180')}
                  />
                }
                onClick={() => setDetailsOpen((open) => !open)}
              />
            </FloatingBar>

            {/* Whatever the building has been given, and nothing else: an empty
                row would read as a fact the building lacks rather than one
                nobody has filled in yet. */}
            <Show when={detailsOpen}>
              <FloatingBar shape="panel" className="w-max max-w-full flex-col items-stretch">
                <dl className="flex flex-col gap-1.5 px-2 py-1">
                  <For each={facts} getKey={(fact) => fact.label}>
                    {(fact) => (
                      <div className="flex items-baseline justify-between gap-8">
                        <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                        <dd className="text-sm font-medium">{fact.value}</dd>
                      </div>
                    )}
                  </For>
                </dl>
              </FloatingBar>
            </Show>
          </div>
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
