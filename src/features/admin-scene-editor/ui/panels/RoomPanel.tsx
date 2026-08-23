'use client'

import { roomOpenings } from '@/entities/building'
import { For, Match, Switch } from '@/shared/ui/control-flow'

import { roomTypeIdOf } from '../../model/use-room-types'
import type { RoomTab } from '../../model/use-scene-editor-model'

import { Accordion } from '../controls/Accordion'
import { SegmentedControl } from '../controls/SegmentedControl'
import { Tabs } from '../controls/Tabs'
import { s } from '../editor-styles'
import { FloorLevelCard } from './FloorLevelCard'
import { RoomBuiltInsSection } from './room/RoomBuiltInsSection'
import { RoomDaylightCard } from './room/RoomDaylightCard'
import { RoomDimensionsCard } from './room/RoomDimensionsCard'
import { RoomOpeningModelsSection } from './room/RoomOpeningModelsSection'
import { RoomOpeningsSection } from './room/RoomOpeningsSection'
import { RoomSetsSection } from './room/RoomSetsSection'
import { RoomSurfacesSection } from './room/RoomSurfacesSection'
import { RoomWallsSection } from './room/RoomWallsSection'
import { RoomZonesSection } from './room/RoomZonesSection'
import type { PanelProps } from './shared'

export function RoomPanel({ vm }: PanelProps) {
  const roomIndex = vm.selectedRoomIndex
  const room = roomIndex === null ? undefined : vm.draft?.rooms?.[roomIndex]
  if (roomIndex === null || !room) return null

  const openingCount = roomOpenings(room.openings).length
  // Zones live in a json column, so the draft types them as unknown.
  const hasZones = Array.isArray(room.zones) && room.zones.length > 0

  const tabs: Array<{ value: RoomTab; label: string; count?: number; title?: string }> = [
    { value: 'shape', label: 'Shape', title: 'The outline, its zones, its openings and its walls' },
    { value: 'look', label: 'Look', title: 'Surfaces, daylight and the models in its openings' },
    { value: 'built-ins', label: 'Built in', count: vm.builtIns.length },
    { value: 'sets', label: 'Sets', count: vm.fittedSets.length },
  ]

  return (
    <>
      {/* What the room IS, and nothing about how it is being looked at — that
          moved onto the viewport, next to the thing it changes. */}
      <div style={s.header}>
        <div style={s.row}>
          <input
            style={{
              ...s.input,
              flex: 1,
              fontWeight: 600,
              ...(room.name?.trim() ? null : s.inputInvalid),
            }}
            placeholder="Name this room"
            value={room.name}
            onChange={(e) => vm.onUpdateRoom(roomIndex, { name: e.target.value })}
          />
          {/* A room's type is a relationship, so the value here is its id. */}
          <select
            style={s.select}
            value={roomTypeIdOf(room.roomType)}
            onChange={(e) => vm.onUpdateRoom(roomIndex, { roomType: Number(e.target.value) })}
          >
            <For each={vm.roomTypes} getKey={(type) => type.id}>
              {(type) => <option value={type.id}>{type.name}</option>}
            </For>
          </select>
        </div>

        {/* Refused while the room has zones rather than silently throwing them
            out: somebody typed their names, their types and their areas, and
            the room may well be named after them. */}
        <SegmentedControl
          label="Use"
          value={room.isRestroom ? 'restroom' : 'room'}
          options={[
            { value: 'room', label: 'Room', title: 'Furnished by the visitor' },
            {
              value: 'restroom',
              label: 'Restroom',
              title: hasZones
                ? 'Undivide the room first — see Zones under Shape'
                : 'Gets its outline, its marker and its own camera. Nothing is furnished in it, and it cannot be divided.',
              disabled: hasZones,
            },
          ]}
          onChange={(value) => vm.onUpdateRoom(roomIndex, { isRestroom: value === 'restroom' })}
        />
      </div>

      <Tabs tabs={tabs} value={vm.roomTab} onChange={vm.onRoomTab} />

      {/* The only part that scrolls. What the room IS stays above it. */}
      <div style={s.scroll}>
        <Switch>
        <Match when={vm.roomTab === 'shape'}>
          <div style={{ padding: '10px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FloorLevelCard vm={vm} hint="The height this room's floor sits at." />
            <RoomDimensionsCard vm={vm} roomIndex={roomIndex} room={room} />
          </div>

          <div style={{ marginTop: 10 }}>
            <Accordion title="Zones" badge={vm.zones.length} defaultOpen={vm.zones.length > 0}>
              <RoomZonesSection vm={vm} room={room} />
            </Accordion>

            <Accordion title="Openings" badge={openingCount} defaultOpen>
              <RoomOpeningsSection vm={vm} roomIndex={roomIndex} room={room} />
            </Accordion>

            <Accordion title="Walls">
              <RoomWallsSection vm={vm} roomIndex={roomIndex} room={room} />
            </Accordion>
          </div>
        </Match>

        <Match when={vm.roomTab === 'look'}>
          <div style={{ padding: '10px 12px 0' }}>
            <RoomDaylightCard vm={vm} roomIndex={roomIndex} room={room} />
          </div>

          <div style={{ marginTop: 10 }}>
            <Accordion title="Surfaces" defaultOpen>
              <RoomSurfacesSection vm={vm} roomIndex={roomIndex} room={room} />
            </Accordion>

            <Accordion title="Door & window models">
              <RoomOpeningModelsSection vm={vm} roomIndex={roomIndex} room={room} />
            </Accordion>
          </div>
        </Match>

        <Match when={vm.roomTab === 'built-ins'}>
          <RoomBuiltInsSection vm={vm} />
        </Match>

          <Match when={vm.roomTab === 'sets'}>
            <RoomSetsSection vm={vm} />
          </Match>
        </Switch>
      </div>
    </>
  )
}
