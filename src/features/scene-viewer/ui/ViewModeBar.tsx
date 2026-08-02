'use client'

import { Box, ChevronUp, Footprints, Home, Layers, LayoutGrid, Eye } from 'lucide-react'
import { useState } from 'react'

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

export function ViewModeBar() {
  const viewMode = useConfiguratorSession((s) => s.viewMode)
  const setViewMode = useConfiguratorSession((s) => s.setViewMode)
  const requestMoveTo = useConfiguratorSession((s) => s.requestMoveTo)
  const isRoomFocused = useConfiguratorSession((s) => s.focusedRoomKey !== null)
  const showCeiling = useConfiguratorSession((s) => s.showCeiling)
  const toggleCeiling = useConfiguratorSession((s) => s.toggleCeiling)
  const selectedInstanceId = useConfiguration((s) => s.selectedInstanceId)
  const placed = useConfiguration((s) => s.placed)
  const [sideOpen, setSideOpen] = useState(false)

  const isSideView = viewMode.startsWith('side-')
  const selected = placed.find((p) => p.instanceId === selectedInstanceId) ?? null

  const pick = (mode: ViewMode) => {
    setSideOpen(false)
    setViewMode(mode)
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
      <Show when={sideOpen}>
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
          aria-expanded={sideOpen}
          leadingIcon={
            <>
              <Eye size={16} />
              <ChevronUp
                size={14}
                aria-hidden
                className={cn('order-last transition-transform', sideOpen && 'rotate-180')}
              />
            </>
          }
          onClick={() => setSideOpen((v) => !v)}
        >
          Side views
        </Pill>
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
        <Show when={!isRoomFocused}>
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
