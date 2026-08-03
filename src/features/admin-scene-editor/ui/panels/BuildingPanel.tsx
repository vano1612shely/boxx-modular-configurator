'use client'

import { Show } from '@/shared/ui/control-flow'

import { Accordion } from '../controls/Accordion'
import { MODE_HINTS, Toolbar } from '../controls/Toolbar'
import { SegmentedControl } from '../controls/SegmentedControl'
import { button, s } from '../editor-styles'
import { CameraSection } from './CameraSection'
import { FloorLevelCard } from './FloorLevelCard'
import { ModelNodesSection } from './ModelNodesSection'
import { RoofModelSection } from './RoofModelSection'
import { RoofVolumesSection } from './RoofVolumesSection'
import { RoomListSection } from './RoomListSection'
import { SelectionPanel } from './SelectionPanel'
import { StoreysSection } from './StoreysSection'
import type { PanelProps } from './shared'

const VIEW_OPTIONS = [
  { value: '3d', label: '3D' },
  { value: 'plan', label: '2D plan', title: 'Top-down — points land exactly where you click' },
] as const

const ROOF_OPTIONS = [
  { value: 'shown', label: 'Shown' },
  { value: 'hidden', label: 'Hidden', title: 'What the visitor sees with the roof toggled off' },
] as const

export function BuildingPanel({ vm, onOpenMenu }: PanelProps) {
  const rooms = vm.draft?.rooms ?? []
  const volumes = vm.draft?.sceneConfig?.roofBlocks ?? []

  const storeyOptions = [
    { value: 'all', label: 'All', title: 'The whole building, as it is today' },
    ...vm.floors.map((floor, index) => ({
      value: String(index),
      label: String(index + 1),
      title: floor.name,
    })),
  ]

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
            {
              label: '⇕ Floor level',
              title: 'The height the next room you draw starts at',
              active: vm.mode === 'floor-level',
              onSelect: () => vm.onSetMode('floor-level'),
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

        {/* Cuts the model exactly as the visitor's storey picker will. */}
        <Show when={vm.floors.length > 0}>
          <SegmentedControl
            label="Storey"
            value={vm.previewFloorIndex === null ? 'all' : String(vm.previewFloorIndex)}
            options={storeyOptions}
            onChange={(value) => vm.onPreviewFloor(value === 'all' ? null : Number(value))}
          />
        </Show>

        <Show when={vm.mode === 'floor-level'}>
          <FloorLevelCard
            vm={vm}
            hint="Sets the height rooms you draw next will start at. Rooms already drawn keep their own."
          />
        </Show>

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

      <Accordion title="Storeys" badge={vm.floors.length}>
        <StoreysSection vm={vm} onOpenMenu={onOpenMenu} />
      </Accordion>

      <Accordion title="Roof — from the model" badge={volumes.length}>
        <RoofVolumesSection vm={vm} onOpenMenu={onOpenMenu} />
      </Accordion>

      <Accordion title="Roof — separate model" badge={vm.roofModelUrl ? 1 : 0}>
        <RoofModelSection vm={vm} />
      </Accordion>

      <Accordion title="Model objects" badge={vm.modelNodes.length}>
        <ModelNodesSection vm={vm} onOpenMenu={onOpenMenu} />
      </Accordion>

      <Accordion title="Default camera">
        <CameraSection vm={vm} />
      </Accordion>
    </>
  )
}
