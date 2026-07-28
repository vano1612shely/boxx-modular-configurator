'use client'

import { roomOpenings } from '@/entities/building'
import { ROOM_TYPE_OPTIONS } from '@/modules/shared/room-types'
import { For } from '@/shared/ui/control-flow'

import { Accordion } from '../controls/Accordion'
import { SegmentedControl } from '../controls/SegmentedControl'
import { MODE_HINTS, Toolbar } from '../controls/Toolbar'
import { button, s } from '../editor-styles'
import { RoomDaylightCard } from './room/RoomDaylightCard'
import { RoomDimensionsCard } from './room/RoomDimensionsCard'
import { RoomFloorLevelCard } from './room/RoomFloorLevelCard'
import { RoomOpeningModelsSection } from './room/RoomOpeningModelsSection'
import { RoomOpeningsSection } from './room/RoomOpeningsSection'
import { RoomSurfacesSection } from './room/RoomSurfacesSection'
import { RoomWallsSection } from './room/RoomWallsSection'
import type { PanelProps } from './shared'

const VIEW_OPTIONS = [
  { value: '3d', label: '3D' },
  { value: 'plan', label: '2D plan' },
] as const

const MODEL_OPTIONS = [
  { value: 'ghost', label: 'Ghost', title: 'Faint, so you can line the outline up against it' },
  { value: 'hidden', label: 'Hidden' },
] as const

/**
 * One room, and nothing else.
 *
 * No roof, no outliner, no building camera — this panel is the generated room
 * and the handful of numbers it is made from. The only way back out is the
 * button at the top, so a stray Esc or a misplaced click cannot lose your
 * place mid-edit.
 */
export function RoomPanel({ vm }: PanelProps) {
  const roomIndex = vm.selectedRoomIndex
  const room = roomIndex === null ? undefined : vm.draft?.rooms?.[roomIndex]
  if (roomIndex === null || !room) return null

  const openingCount = roomOpenings(room.openings).length

  return (
    <>
      <div style={s.header}>
        <button
          type="button"
          style={{ ...button(), width: '100%', textAlign: 'left' }}
          onClick={vm.onExitRoom}
        >
          ← Back to building
        </button>

        <div>
          <p style={s.eyebrow}>Room</p>
          <div style={s.row}>
            <input
              style={{ ...s.input, flex: 1, fontWeight: 600 }}
              value={room.name}
              onChange={(e) => vm.onUpdateRoom(roomIndex, { name: e.target.value })}
            />
            <select
              style={s.select}
              value={room.roomType}
              onChange={(e) =>
                vm.onUpdateRoom(roomIndex, {
                  roomType: e.target.value as (typeof ROOM_TYPE_OPTIONS)[number]['value'],
                })
              }
            >
              <For each={ROOM_TYPE_OPTIONS} getKey={(option) => option.value}>
                {(option) => <option value={option.value}>{option.label}</option>}
              </For>
            </select>
          </div>
        </div>

        <Toolbar
          hint={MODE_HINTS[vm.mode]}
          tools={[
            {
              label: 'Select',
              active: vm.mode === 'select',
              onSelect: () => vm.onSetMode('select'),
            },
            {
              label: '⌷ Door',
              active: vm.mode === 'place-opening' && vm.openingKind === 'door',
              onSelect: () => {
                vm.onSetOpeningKind('door')
                vm.onSetMode('place-opening')
              },
            },
            {
              label: '⊞ Window',
              active: vm.mode === 'place-opening' && vm.openingKind === 'window',
              onSelect: () => {
                vm.onSetOpeningKind('window')
                vm.onSetMode('place-opening')
              },
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
            label="Model"
            value={vm.ghostModel ? 'ghost' : 'hidden'}
            options={MODEL_OPTIONS}
            onChange={(value) => vm.onSetGhostModel(value === 'ghost')}
          />
        </div>
      </div>

      <div style={{ padding: '10px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RoomFloorLevelCard vm={vm} />
        <RoomDaylightCard vm={vm} roomIndex={roomIndex} room={room} />
        <RoomDimensionsCard vm={vm} roomIndex={roomIndex} room={room} />
      </div>

      <div style={{ marginTop: 10 }}>
        <Accordion title="Openings" badge={openingCount} defaultOpen>
          <RoomOpeningsSection vm={vm} roomIndex={roomIndex} room={room} />
        </Accordion>

        <Accordion title="Door & window models">
          <RoomOpeningModelsSection vm={vm} roomIndex={roomIndex} room={room} />
        </Accordion>

        <Accordion title="Walls">
          <RoomWallsSection vm={vm} roomIndex={roomIndex} room={room} />
        </Accordion>

        <Accordion title="Surfaces">
          <RoomSurfacesSection vm={vm} roomIndex={roomIndex} room={room} />
        </Accordion>

        <Accordion title="Room camera">
          <p style={s.hint}>
            Where the visitor lands when they step into this room. Frame it in 3D, then capture.
          </p>
          <button
            type="button"
            style={button()}
            onClick={() => vm.onSetRoomCameraFromView(roomIndex)}
          >
            Set from current view
          </button>
        </Accordion>
      </div>
    </>
  )
}
