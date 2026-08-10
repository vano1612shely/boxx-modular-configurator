'use client'

import type { CutFailure, RoomDoc, Zone } from '@/entities/building'
import { polygonAreaSqFt, polygonSignedArea } from '@/entities/building'
import { ROOM_TYPE_OPTIONS } from '@/modules/shared/room-types'
import { ZONE_TINTS } from '@/shared/three/scene-tokens'
import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { button, s } from '../../editor-styles'

const WHY_NOT: Record<CutFailure, string> = {
  'short-path': 'A cut needs at least a start and an end.',
  'ends-off-outline': 'Start on a wall — the one lit up under the pointer.',
  'ends-together': 'The cut ends where it started, so there is nothing on either side of it.',
  'leaves-the-room': 'Corners go inside the floor being divided, or on one of its walls.',
  'crosses-itself': 'The line crosses itself. Undo the last corner and go round the other way.',
  'empty-side': 'One side of that cut has no floor in it.',
}

/**
 * Both units, empty meaning "measure the outline".
 *
 * The room's own field, over again for a smaller piece of floor — same rule,
 * same placeholder, so an admin who has learnt one has learnt the other.
 */
function ZoneAreas({ vm, zone }: { vm: SceneEditorVm; zone: Zone }) {
  const traced = {
    areaSqFt: Math.round(polygonAreaSqFt(zone.polygon)),
    areaSqM: Math.round(Math.abs(polygonSignedArea(zone.polygon)) * 10) / 10,
  }
  const authored = zone.areaSqFt !== null || zone.areaSqM !== null

  const field = (key: 'areaSqFt' | 'areaSqM', unit: string) => (
    <label style={s.field}>
      <span style={s.label}>{unit}</span>
      <input
        type="number"
        style={{ ...s.input, minWidth: 0 }}
        placeholder={String(traced[key])}
        value={zone[key] ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          const next = Number.parseFloat(raw)
          vm.onUpdateZone(zone.key, {
            [key]: raw === '' || Number.isNaN(next) ? null : next,
          })
        }}
      />
    </label>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 4 }}>
      {field('areaSqFt', 'ft²')}
      {field('areaSqM', 'm²')}
      <button
        type="button"
        style={{ ...button('ghost'), flexShrink: 0, alignSelf: 'end' }}
        title={authored ? 'Follow the outline again' : 'Write the traced figures in'}
        onClick={() =>
          vm.onUpdateZone(zone.key, authored ? { areaSqFt: null, areaSqM: null } : traced)
        }
      >
        {authored ? 'Auto' : '= traced'}
      </button>
    </div>
  )
}

/** Taken tints are shown but not offered: two alike would defeat the point of them. */
function TintPicker({ vm, zone }: { vm: SceneEditorVm; zone: Zone }) {
  const taken = vm.zones.filter((other) => other.key !== zone.key).map((other) => other.color)

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <For each={ZONE_TINTS} getKey={(tint) => tint}>
        {(tint) => {
          const mine = zone.color === tint
          const used = taken.includes(tint)
          return (
            <button
              type="button"
              disabled={used}
              title={used ? 'Another zone has this one' : 'Tint this zone'}
              onClick={() => vm.onUpdateZone(zone.key, { color: tint })}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                background: tint,
                cursor: used ? 'not-allowed' : 'pointer',
                opacity: used ? 0.25 : 1,
                border: mine ? '2px solid #fff' : '1px solid #2a2e34',
                outline: mine ? '1px solid #3b82f6' : 'none',
              }}
            />
          )
        }}
      </For>
    </div>
  )
}

export function RoomZonesSection({ vm, room }: { vm: SceneEditorVm; room: RoomDoc }) {
  const cutting = vm.mode === 'cut-zone'
  const target = vm.zones.find((zone) => zone.key === vm.selectedZoneKey) ?? null

  const startCut = (key: string | null) => {
    vm.onSelectZone(key)
    vm.onSetMode('cut-zone')
  }

  return (
    <>
      <Show when={cutting}>
        <div style={s.card}>
          <h3 style={s.heading}>Dividing {target ? target.name : room.name}</h3>
          <p style={s.hint}>
            The wall under the pointer lights up. Click it to start, click your way across the
            floor — as many corners as you need — then click any wall to finish, the one you
            started from included. Touching a wall again is the cut: it saves itself. The line is
            not a wall; it is only where one zone stops and the next begins.
          </p>
          {/* Corners land on a 5 cm grid, so the lengths are what you can aim
              for — a segment reading 0.80 is 80 cm, not 79 rounded up. */}
          <p style={s.mono}>
            {vm.cutPoints.length < 2
              ? `${vm.cutPoints.length} points`
              : vm.cutPoints
                  .slice(1)
                  .map((point, i) =>
                    Math.hypot(point.x - vm.cutPoints[i].x, point.z - vm.cutPoints[i].z).toFixed(2),
                  )
                  .join(' → ')}
          </p>
          <Show when={vm.cutError}>
            {(reason) => <p style={{ ...s.hint, color: '#f87171' }}>{WHY_NOT[reason]}</p>}
          </Show>
          <div style={s.row}>
            <button
              type="button"
              style={button()}
              disabled={vm.cutPoints.length === 0}
              onClick={vm.onUndoCutPoint}
            >
              ↶ Corner
            </button>
            <button type="button" style={button()} onClick={vm.onCancelZoneCut}>
              Cancel
            </button>
          </div>
        </div>
      </Show>

      <For
        each={vm.zones}
        getKey={(zone) => zone.key}
        fallback={
          <Show when={!cutting}>
            <p style={s.hint}>
              One space, one use. Divide it when a room does two jobs with nothing built between
              them — a conference end and a kitchen end, each with its own furniture and its own
              floor area.
            </p>
          </Show>
        }
      >
        {(zone) => {
          const picked = vm.selectedZoneKey === zone.key
          return (
            <div
              style={{
                ...s.card,
                borderLeft: `3px solid ${zone.color}`,
                outline: picked ? '1px solid #3b82f6' : 'none',
              }}
              onClick={() => vm.onSelectZone(picked ? null : zone.key)}
            >
              <div style={s.row}>
                <input
                  style={{ ...s.input, flex: 1 }}
                  value={zone.name}
                  onChange={(event) => vm.onUpdateZone(zone.key, { name: event.target.value })}
                />
                <select
                  style={s.select}
                  value={zone.roomType}
                  onChange={(event) =>
                    vm.onUpdateZone(zone.key, {
                      roomType: event.target.value as Zone['roomType'],
                    })
                  }
                >
                  <For each={ROOM_TYPE_OPTIONS} getKey={(option) => option.value}>
                    {(option) => <option value={option.value}>{option.label}</option>}
                  </For>
                </select>
              </div>

              <ZoneAreas vm={vm} zone={zone} />
              <TintPicker vm={vm} zone={zone} />

              <button
                type="button"
                style={{ ...button(), width: '100%' }}
                disabled={cutting}
                onClick={() => startCut(zone.key)}
              >
                Divide this zone
              </button>
            </div>
          )
        }}
      </For>

      <Show when={!cutting}>
        <div style={s.row}>
          <button
            type="button"
            style={{ ...button('primary'), flex: 1 }}
            onClick={() => startCut(null)}
            disabled={vm.zones.length > 0}
            title={
              vm.zones.length > 0
                ? 'The room is already divided — divide one of its zones instead'
                : undefined
            }
          >
            ✂ Divide the room
          </button>
          <Show when={vm.zones.length > 0}>
            {/* All of them, never one: zones tile the room, so dropping a single
                zone would leave a piece of floor that belongs to nobody. */}
            <button type="button" style={s.danger} title="Back to one space" onClick={vm.onClearZones}>
              ✕
            </button>
          </Show>
        </div>
      </Show>
    </>
  )
}
