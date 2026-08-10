'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import type { Room } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { FloatingBar, Pill, SceneOverlay } from '@/shared/ui/boxx'
import { Show } from '@/shared/ui/control-flow'

type Props = {
  /** The focused room, or null while the whole building is on screen. */
  room: Room | null
}

const WHOLE_ROOM = 'Whole room'

/**
 * Steps through a divided room: the whole of it, then each zone, and round.
 *
 * One control rather than a chip per zone, because the whole room is one of the
 * places you can be in and a row of chips has nowhere honest to put it. Wrapping
 * means there is no dead end and no disabled arrow to explain.
 */
export function ZoneBar({ room }: Props) {
  const activeZoneKey = useConfiguratorSession((s) => s.activeZoneKey)
  const setActiveZone = useConfiguratorSession((s) => s.setActiveZone)

  const zones = room?.zones ?? []
  if (zones.length === 0) return null

  const stops: Array<string | null> = [null, ...zones.map((zone) => zone.key)]
  const at = Math.max(stops.indexOf(activeZoneKey), 0)
  const step = (by: number) => setActiveZone(stops[(at + by + stops.length) % stops.length])

  const zone = zones.find((z) => z.key === activeZoneKey) ?? null

  return (
    <SceneOverlay corner="top-center" z="bar" className="max-w-[calc(100%-9rem)]">
      <FloatingBar className="min-w-0 max-w-full">
        <Pill
          variant="ghost"
          aria-label="Previous zone"
          title="Previous zone"
          leadingIcon={<ChevronLeft size={16} />}
          onClick={() => step(-1)}
        />
        <div className="flex min-w-0 items-center gap-2 px-1">
          {/* The dot is the same tint as the floor it stands for, which is the
              only thing tying the name to the half of the room it names. */}
          <Show when={zone}>
            {(picked) => (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: picked.color }}
              />
            )}
          </Show>
          <span className="truncate text-sm leading-normal font-medium">
            {zone?.name ?? WHOLE_ROOM}
          </span>
        </div>
        <Pill
          variant="ghost"
          aria-label="Next zone"
          title="Next zone"
          leadingIcon={<ChevronRight size={16} />}
          onClick={() => step(1)}
        />
      </FloatingBar>
    </SceneOverlay>
  )
}
