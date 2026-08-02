'use client'

import { ArrowLeft, DoorOpen } from 'lucide-react'

import type { BuildingScene } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { Show } from '@/shared/ui/control-flow'

export function ConfiguratorHeader({ building }: { building: BuildingScene }) {
  const focusedRoomKey = useConfiguratorSession((s) => s.focusedRoomKey)
  const clearFocus = useConfiguratorSession((s) => s.exitRoomFocus)

  const room = building.rooms.find((r) => r.key === focusedRoomKey) ?? null

  const meta = [
    `${building.unitCount} ${building.line.unitLabel}`,
    building.dimensions,
    building.sqft ? `${building.sqft} sq ft` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Max width is capped to leave the opposite corner free for the quote button.
  return (
    <header className="pointer-events-none absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-20 flex max-w-[calc(100%-5rem)] items-center gap-2 desktop:max-w-[calc(100%-14rem)]">
      <Show when={room}>
        {(focused) => (
          <>
            <button
              type="button"
              onClick={clearFocus}
              className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full bg-neutral-900 py-2.5 pr-4 pl-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowLeft size={16} strokeWidth={2.5} />
              <span className="hidden desktop:inline">Back to building</span>
              <span className="desktop:hidden">Building</span>
            </button>

            <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-white/95 py-2 pr-4 pl-3 shadow-md ring-1 ring-black/5 backdrop-blur">
              <DoorOpen size={15} className="shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-semibold">{focused.name}</span>
            </div>
          </>
        )}
      </Show>

      <Show when={room === null}>
        <div className="pointer-events-auto min-w-0 rounded-2xl bg-white/95 px-4 py-2.5 shadow-md ring-1 ring-black/5 backdrop-blur">
          <h1 className="truncate text-sm font-semibold">{building.title}</h1>
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        </div>
      </Show>
    </header>
  )
}
