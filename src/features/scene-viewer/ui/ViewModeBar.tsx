'use client'

import {
  Box,
  Building2,
  ChevronUp,
  Footprints,
  Home,
  LayoutGrid,
  LocateFixed,
  RotateCw,
} from 'lucide-react'
import { useState } from 'react'

import type { BuildingFloor } from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession, type ViewMode } from '@/entities/configurator-session'
import { cn } from '@/shared/lib'
import { FloatingBar, Pill, SceneOverlay } from '@/shared/ui/boxx'
import { For, Show } from '@/shared/ui/control-flow'

const WHOLE_BUILDING = 'Whole building'

/**
 * Props that either put a label on a pill or leave it an icon with a tooltip.
 *
 * `labelFrom` has to follow: a "desktop" pill with nothing to show still renders
 * its label span, and the bar pays a gap for the emptiness.
 */
function spellOut(text: string, show: boolean) {
  return show
    ? { children: text, labelFrom: 'desktop' as const, title: text }
    : { children: null, labelFrom: 'always' as const, title: text, 'aria-label': text }
}

type Props = {
  floors: BuildingFloor[]
  /** True on a saved order, where nothing can be picked up and so nothing is selected. */
  readOnly?: boolean
}

export function ViewModeBar({ floors, readOnly = false }: Props) {
  const setViewMode = useConfiguratorSession((s) => s.setViewMode)
  const requestMoveTo = useConfiguratorSession((s) => s.requestMoveTo)
  const rotateView = useConfiguratorSession((s) => s.rotateView)
  const recenter = useConfiguratorSession((s) => s.recenter)
  const pickedView = useConfiguratorSession((s) => s.pickedView)
  const isRoomFocused = useConfiguratorSession((s) => s.focusedRoomKey !== null)
  const selectedFloorKey = useConfiguratorSession((s) => s.selectedFloorKey)
  const selectFloor = useConfiguratorSession((s) => s.selectFloor)
  const selectedInstanceId = useConfiguration((s) => s.selectedInstanceId)
  const placed = useConfiguration((s) => s.placed)
  /** Whether the storey picker is up, the one thing in the bar that stacks. */
  const [pickingFloor, setPickingFloor] = useState(false)

  const overviewLabel = isRoomFocused ? 'Dollhouse' : 'Overview'
  const selected = placed.find((p) => p.instanceId === selectedInstanceId) ?? null

  // A storey the building no longer has reads as the whole of it, which is what
  // a stale pick from a previously configured building should do.
  const currentFloor = floors.find((floor) => floor.key === selectedFloorKey) ?? null
  // Two, not one: with a single storey the picker would offer the building and
  // the whole of the building under two names.
  const hasFloors = floors.length >= 2 && !isRoomFocused

  const pick = (mode: ViewMode) => {
    setPickingFloor(false)
    setViewMode(mode)
  }

  const pickFloor = (key: string | null) => {
    setPickingFloor(false)
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
        'w-max transition-[bottom] duration-300',
        // Centred on the scene the side panel leaves, not on the frame — and it
        // asks the panel how wide it is rather than carrying a copy of the
        // figure, which went stale the moment the panel learned to shrink.
        'desktop:left-[calc(50%_-_var(--scene-panel,0px)/2)]',
        // Clear of the furniture sheet, which only a phone has.
        isRoomFocused && 'bottom-[calc(5rem+env(safe-area-inset-bottom))] desktop:bottom-4',
      )}
    >
      <Show when={pickingFloor}>
        <FloatingBar
          shape="panel"
          className="absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 flex-col items-stretch"
        >
          <Pill variant="ghost" selected={currentFloor === null} onClick={() => pickFloor(null)}>
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

      {/* Only the control that is currently saying something spells itself out.
          A labelled pill apiece made a bar wide enough to sit across the
          building it is meant to be steering. */}
      <FloatingBar>
        <Pill
          {...spellOut(overviewLabel, pickedView === 'dollhouse')}
          variant="ghost"
          selected={pickedView === 'dollhouse'}
          leadingIcon={isRoomFocused ? <Box size={16} /> : <Home size={16} />}
          onClick={() => pick('dollhouse')}
        />
        <Pill
          {...spellOut('Top view', pickedView === 'top')}
          variant="ghost"
          selected={pickedView === 'top'}
          leadingIcon={<LayoutGrid size={16} />}
          onClick={() => pick('top')}
        />
        {/* A quarter of a turn, taking four presses to go round. It only
            rewrites the bearing, so it works from the top view as well — where
            dragging at a three-degree tilt is awkward — and it leaves the zoom
            and the pan where the visitor put them. */}
        <Pill
          {...spellOut('Turn 90°', false)}
          variant="ghost"
          leadingIcon={<RotateCw size={16} />}
          onClick={() => rotateView(1)}
        />
        {/* Once the visitor has closed in on one corner of the plan there is
            nothing on screen saying where the rest of the building went. This
            is the way back: the whole of it again, from overhead, centred —
            and, unlike "Top view", it puts a picked storey back as well. */}
        <Show when={!isRoomFocused}>
          <Pill
            {...spellOut('Recenter', false)}
            variant="ghost"
            leadingIcon={<LocateFixed size={16} />}
            onClick={recenter}
          />
        </Show>
        <Show when={hasFloors}>
          <FloatingBar.Divider />
          <Pill
            {...spellOut(currentFloor?.name ?? WHOLE_BUILDING, currentFloor !== null)}
            variant="ghost"
            selected={currentFloor !== null}
            aria-expanded={pickingFloor}
            leadingIcon={
              <>
                <Building2 size={16} />
                <ChevronUp
                  size={14}
                  aria-hidden
                  className={cn('order-last transition-transform', pickingFloor && 'rotate-180')}
                />
              </>
            }
            onClick={() => setPickingFloor((up) => !up)}
          />
        </Show>
        {/* Only inside a room. From the building view it walked the camera to
            eye level inside the glb, where the walls it flew through are still
            drawn and stand between the visitor and what they picked. A room
            already hides its own walls, so there the move works.

            And only where something can be selected: on a saved order nothing
            ever is, so this would be a button permanently greyed out. */}
        <Show when={isRoomFocused && !readOnly}>
          <FloatingBar.Divider />
          <Pill
            {...spellOut('Move to selected', false)}
            variant="ghost"
            disabled={!selected}
            leadingIcon={<Footprints size={16} />}
            onClick={moveToSelected}
          />
        </Show>
      </FloatingBar>
    </SceneOverlay>
  )
}
