'use client'

import { Show } from '@/shared/ui/control-flow'

import { Accordion } from '../controls/Accordion'
import { MODE_HINTS, Toolbar } from '../controls/Toolbar'
import { SegmentedControl } from '../controls/SegmentedControl'
import { button, s } from '../editor-styles'
import { CameraSection } from './CameraSection'
import { ModelNodesSection } from './ModelNodesSection'
import { RoofVolumesSection } from './RoofVolumesSection'
import { RoomListSection } from './RoomListSection'
import { SelectionPanel } from './SelectionPanel'
import type { PanelProps } from './shared'

const VIEW_OPTIONS = [
  { value: '3d', label: '3D' },
  { value: 'plan', label: '2D plan', title: 'Top-down — points land exactly where you click' },
] as const

const ROOF_OPTIONS = [
  { value: 'shown', label: 'Shown' },
  { value: 'hidden', label: 'Hidden', title: 'What the visitor sees with the roof toggled off' },
] as const

/** Everything that belongs to the building as a whole. */
export function BuildingPanel({ vm, onOpenMenu }: PanelProps) {
  const rooms = vm.draft?.rooms ?? []
  const volumes = vm.draft?.sceneConfig?.roofBlocks ?? []

  return (
    <>
      <div style={s.header}>
        <div>
          <p style={s.eyebrow}>Building</p>
          <h2 style={s.title}>{vm.doc?.title ?? 'Scene'}</h2>
        </div>

        <Toolbar
          hint={MODE_HINTS[vm.mode]}
          tools={[
            { label: 'Select', active: vm.mode === 'select', onSelect: () => vm.onSetMode('select') },
            {
              label: '✏ Draw room',
              active: vm.mode === 'draw-room',
              onSelect: () => vm.onSetMode('draw-room'),
            },
            {
              label: '▩ Roof volume',
              active: vm.mode === 'block-roof',
              onSelect: () => vm.onSetMode('block-roof'),
            },
          ]}
        />

        <div style={s.segmentGroup}>
          <SegmentedControl
            label="View"
            value={vm.planMode ? 'plan' : '3d'}
            options={VIEW_OPTIONS}
            onChange={(value) => vm.onSetPlanMode(value === 'plan')}
          />
          <SegmentedControl
            label="Roof"
            value={vm.roofHidden ? 'hidden' : 'shown'}
            options={ROOF_OPTIONS}
            onChange={(value) => vm.onSetRoofHidden(value === 'hidden')}
          />
        </div>

        <Show when={vm.mode === 'draw-room' && vm.drawingPoints.length > 0}>
          <div style={s.row}>
            <Show when={vm.drawingPoints.length >= 3}>
              <button type="button" style={button('primary')} onClick={vm.onFinishRoom}>
                Finish room ({vm.drawingPoints.length} points)
              </button>
            </Show>
            <button type="button" style={button()} onClick={vm.onCancelDrawing}>
              Cancel
            </button>
          </div>
        </Show>
      </div>

      <SelectionPanel vm={vm} />

      <Accordion title="Rooms" badge={rooms.length} defaultOpen>
        <RoomListSection vm={vm} onOpenMenu={onOpenMenu} />
      </Accordion>

      <Accordion title="Roof volumes" badge={volumes.length}>
        <RoofVolumesSection vm={vm} onOpenMenu={onOpenMenu} />
      </Accordion>

      {/* Closed by default: a 187-row outliner is a power tool, not the first
          thing you should have to scroll past. */}
      <Accordion title="Model objects" badge={vm.modelNodes.length}>
        <ModelNodesSection vm={vm} onOpenMenu={onOpenMenu} />
      </Accordion>

      <Accordion title="Default camera">
        <CameraSection vm={vm} />
      </Accordion>
    </>
  )
}
