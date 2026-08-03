'use client'

import {
  Box,
  Building2,
  ChevronUp,
  Footprints,
  Home,
  Layers,
  LayoutGrid,
  Eye,
} from 'lucide-react'
import { useState } from 'react'

import type { BuildingFloor } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession, type ViewMode } from '@/entities/configurator-session'
import { cn } from '@/shared/lib'
import { FloatingBar, Pill, SceneOverlay } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

const SIDE_VIEWS: Array<{ mode: ViewMode; label: string }> = [
  { mode: 'side-front', label: 'Front' },
  { mode: 'side-right', label: 'Right' },
  { mode: 'side-back', label: 'Back' },
  { mode: 'side-left', label: 'Left' },
]

const WHOLE_BUILDING = 'Whole building'

type Props = {
  floors: BuildingFloor[]
}

/** Which of the two stacked pickers is open; only one may be. */
type OpenMenu = 'side' | 'floor' | null

export function ViewModeBar({ floors }: Props) {
  const viewMode = useConfiguratorSession((s) => s.viewMode)
  const setViewMode = useConfiguratorSession((s) => s.setViewMode)
  const requestMoveTo = useConfiguratorSession((s) => s.requestMoveTo)
  const isRoomFocused = useConfiguratorSession((s) => s.focusedRoomKey !== null)
  const showCeiling = useConfiguratorSession((s) => s.showCeiling)
  const toggleCeiling = useConfiguratorSession((s) => s.toggleCeiling)
  const selectedFloorKey = useConfiguratorSession((s) => s.selectedFloorKey)
  const selectFloor = useConfiguratorSession((s) => s.selectFloor)
  const selectedInstanceId = useConfiguration((s) => s.selectedInstanceId)
  const placed = useConfiguration((s) => s.placed)
  const [open, setOpen] = useState<OpenMenu>(null)

  const isSideView = viewMode.startsWith('side-')
  const selected = placed.find((p) => p.instanceId === selectedInstanceId) ?? null

  // A storey the building no longer has reads as the whole of it, which is what
  // a stale pick from a previously configured building should do.
  const currentFloor = floors.find((floor) => floor.key === selectedFloorKey) ?? null
  // Two, not one: with a single storey the picker would offer the building and
  // the whole of the building under two names.
  const hasFloors = floors.length >= 2 && !isRoomFocused

  const pick = (mode: ViewMode) => {
    setOpen(null)
    setViewMode(mode)
  }

  const pickFloor = (key: string | null) => {
    setOpen(null)
    selectFloor(key)
  }

  const moveToSelected = () => {
    if (!selected) return

    const rad = (selected.rotationYDeg * Math.PI) / 180
    const distance = 4.5
    requestMoveTo(
      [selected.x + Math.sin(rad) * distance, 1.7, selected.z + Math.cos(rad) * distance],
      [selected.x, 0.9, selected.z],
    )
  }

  return (
    <SceneOverlay
      corner="bottom-center"
      className={cn(
        'w-max transition-all duration-300',
        isRoomFocused &&
          'bottom-[calc(5rem+env(safe-area-inset-bottom))] desktop:bottom-4 desktop:left-[calc(50%-11rem)] lg:left-[calc(50%-13rem)]',
      )}
    >
      <Show when={open === 'side'}>
        <FloatingBar
          shape="panel"
          className="absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 flex-col items-stretch"
        >
          <For each={SIDE_VIEWS} getKey={(v) => v.mode}>
            {(view) => (
              <Pill
                variant="ghost"
                selected={viewMode === view.mode}
                onClick={() => pick(view.mode)}
              >
                {view.label}
              </Pill>
            )}
          </For>
        </FloatingBar>
      </Show>

      <Show when={open === 'floor'}>
        <FloatingBar
          shape="panel"
          className="absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 flex-col items-stretch"
        >
          <Pill
            variant="ghost"
            selected={currentFloor === null}
            onClick={() => pickFloor(null)}
          >
            {WHOLE_BUILDING}
          </Pill>
          <For each={floors} getKey={(floor) => floor.key}>
            {(floor) => (
              <Pill
                variant="ghost"
                selected={currentFloor?.key === floor.key}
                onClick={() => pickFloor(floor.key)}
              >
                {floor.name}
              </Pill>
            )}
          </For>
        </FloatingBar>
      </Show>

      <FloatingBar>
        <Pill
          variant="ghost"
          labelFrom="desktop"
          selected={viewMode === 'dollhouse'}
          leadingIcon={isRoomFocused ? <Box size={16} /> : <Home size={16} />}
          onClick={() => pick('dollhouse')}
        >
          {isRoomFocused ? 'Dollhouse' : 'Overview'}
        </Pill>
        <Pill
          variant="ghost"
          labelFrom="desktop"
          selected={viewMode === 'top'}
          leadingIcon={<LayoutGrid size={16} />}
          onClick={() => pick('top')}
        >
          Top view
        </Pill>
        <Pill
          variant="ghost"
          labelFrom="desktop"
          selected={isSideView}
          aria-expanded={open === 'side'}
          leadingIcon={
            <>
              <Eye size={16} />
              <ChevronUp
                size={14}
                aria-hidden
                className={cn('order-last transition-transform', open === 'side' && 'rotate-180')}
              />
            </>
          }
          onClick={() => setOpen((current) => (current === 'side' ? null : 'side'))}
        >
          Side views
        </Pill>
        <Show when={hasFloors}>
          <FloatingBar.Divider />
          <Pill
            variant="ghost"
            labelFrom="desktop"
            selected={currentFloor !== null}
            aria-expanded={open === 'floor'}
            title={currentFloor ? `Showing ${currentFloor.name}` : 'Showing the whole building'}
            leadingIcon={
              <>
                <Building2 size={16} />
                <ChevronUp
                  size={14}
                  aria-hidden
                  className={cn(
                    'order-last transition-transform',
                    open === 'floor' && 'rotate-180',
                  )}
                />
              </>
            }
            onClick={() => setOpen((current) => (current === 'floor' ? null : 'floor'))}
          >
            {currentFloor?.name ?? WHOLE_BUILDING}
          </Pill>
        </Show>
        <FloatingBar.Divider />
        <Pill
          variant="ghost"
          labelFrom="desktop"
          disabled={!selected}
          leadingIcon={<Footprints size={16} />}
          onClick={moveToSelected}
        >
          Move to
        </Pill>
        {/* A storey is already cut below its own ceiling, so the toggle has
            nothing left to say while one is picked. */}
        <Show when={!isRoomFocused && currentFloor === null}>
          <FloatingBar.Divider />
          <Pill
            variant="ghost"
            labelFrom="desktop"
            selected={showCeiling}
            leadingIcon={<Layers size={16} />}
            title={showCeiling ? 'Hide ceiling & roof' : 'Show ceiling & roof'}
            onClick={toggleCeiling}
          >
            Ceiling
          </Pill>
        </Show>
      </FloatingBar>
    </SceneOverlay>
  )
}
