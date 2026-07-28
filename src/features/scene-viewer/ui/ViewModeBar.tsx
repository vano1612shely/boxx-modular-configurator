'use client'

import { Box, ChevronUp, Footprints, Home, Layers, LayoutGrid, Eye } from 'lucide-react'
import { useState } from 'react'

import { useConfiguration } from '@/entities/configuration'
import { useConfiguratorSession, type ViewMode } from '@/entities/configurator-session'
import { cn } from '@/shared/lib'
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

  const itemClass = (active: boolean, disabled = false) =>
    cn(
      'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
      active ? 'bg-neutral-900 text-white' : 'text-neutral-800 hover:bg-neutral-100',
      disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
    )

  return (
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <Show when={sideOpen}>
        <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 gap-1 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-black/5">
          <For each={SIDE_VIEWS} getKey={(v) => v.mode}>
            {(view) => (
              <button
                type="button"
                onClick={() => pick(view.mode)}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  viewMode === view.mode
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-800 hover:bg-neutral-100',
                )}
              >
                {view.label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <div className="flex items-center gap-1 rounded-full bg-white p-1.5 shadow-xl ring-1 ring-black/5">
        <button type="button" onClick={() => pick('dollhouse')} className={itemClass(viewMode === 'dollhouse')}>
          {isRoomFocused ? <Box size={16} /> : <Home size={16} />}
          {isRoomFocused ? 'Dollhouse' : 'Overview'}
        </button>
        <button type="button" onClick={() => pick('top')} className={itemClass(viewMode === 'top')}>
          <LayoutGrid size={16} />
          Top view
        </button>
        <button
          type="button"
          onClick={() => setSideOpen((v) => !v)}
          className={itemClass(isSideView)}
        >
          <Eye size={16} />
          Side views
          <ChevronUp size={14} className={cn('transition-transform', sideOpen && 'rotate-180')} />
        </button>
        <span className="h-6 w-px bg-neutral-200" />
        <button
          type="button"
          disabled={!selected}
          onClick={moveToSelected}
          className={itemClass(false, !selected)}
        >
          <Footprints size={16} />
          Move to
        </button>
        <Show when={!isRoomFocused}>
          <span className="h-6 w-px bg-neutral-200" />
          <button
            type="button"
            onClick={toggleCeiling}
            title={showCeiling ? 'Hide ceiling & roof' : 'Show ceiling & roof'}
            className={itemClass(showCeiling)}
          >
            <Layers size={16} />
            Ceiling
          </button>
        </Show>
      </div>
    </div>
  )
}
