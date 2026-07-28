'use client'

import type { OpeningFit, RoomDoc } from '@/entities/building'
import { OPENING_KIND_OPTIONS } from '@/modules/shared/room-shell'
import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import {
  AssetPicker,
  assetRefOf,
  useAssetLibrary,
  type AssetRef,
} from '../../controls/AssetPicker'
import { NumberInput } from '../../controls/NumberInput'
import { SegmentedControl } from '../../controls/SegmentedControl'
import { button, s } from '../../editor-styles'

type OpeningKindValue = (typeof OPENING_KIND_OPTIONS)[number]['value']

/** Short enough for a 340px sidebar; the long wording lives on the field. */
const FIT_OPTIONS = [
  { value: 'stretch', label: 'Fill', title: 'Stretch to meet the reveal exactly' },
  { value: 'contain', label: 'Fit', title: 'Keep the proportions, fit inside the opening' },
  { value: 'none', label: 'Raw', title: 'Leave the model at the size it was authored' },
] as const

type SlotProps = {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
  kind: OpeningKindValue
  label: string
  library: AssetRef[]
  onLibraryChange: () => void
}

function ModelSlot({
  vm,
  roomIndex,
  room,
  kind,
  label,
  library,
  onLibraryChange,
}: SlotProps) {
  const entry = room.openingModels?.[kind]
  const model = assetRefOf(entry?.model, library)

  const fit: OpeningFit = entry?.fit ?? 'stretch'
  const yawDeg = entry?.yawDeg ?? 0
  const depth = entry?.depth ?? 0

  return (
    <div style={{ ...s.card, gap: 6, padding: 8 }}>
      <span style={s.heading}>{label}</span>

      <AssetPicker
        collection="models"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        library={library}
        onLibraryChange={onLibraryChange}
        value={model}
        emptyLabel="Flat leaf (no model)"
        onChange={(asset) =>
          vm.onSetOpeningModel(roomIndex, kind, {
            model: asset ? { id: asset.id, url: asset.url } : null,
          })
        }
      />

      {/* Nothing below this means anything without something to place. */}
      <Show when={model !== null}>
        <SegmentedControl
          label="Size"
          value={fit}
          options={FIT_OPTIONS}
          onChange={(value) => vm.onSetOpeningModel(roomIndex, kind, { fit: value })}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={s.field}>
            <span style={s.label}>Facing °</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <NumberInput
                style={{ ...s.input, flex: 1, minWidth: 0 }}
                step={5}
                title="Turn the model until its front faces out of the room"
                value={yawDeg}
                onCommit={(value) => vm.onSetOpeningModel(roomIndex, kind, { yawDeg: value })}
              />
              <button
                type="button"
                style={{ ...button(), padding: '6px 8px', fontSize: 12, flexShrink: 0 }}
                title="Quarter turn"
                onClick={() =>
                  vm.onSetOpeningModel(roomIndex, kind, { yawDeg: (yawDeg + 90) % 360 })
                }
              >
                ↻
              </button>
            </div>
          </div>

          <label style={s.field}>
            <span style={s.label}>Into wall m</span>
            <NumberInput
              style={s.input}
              step={0.01}
              title="0 sits it in the middle of the wall; + pushes it outward"
              value={depth}
              onCommit={(value) => vm.onSetOpeningModel(roomIndex, kind, { depth: value })}
            />
          </label>
        </div>
      </Show>
    </div>
  )
}

/**
 * Real doors and windows.
 *
 * A flat leaf is convincing from one angle and every room view is seen from
 * another, so a model with a frame, a handle and recessed glass replaces it.
 * Assigned per kind: one door serves every doorway in the room, and individual
 * swings are set on the openings themselves.
 */
export function RoomOpeningModelsSection({
  vm,
  roomIndex,
  room,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
}) {
  const { assets, refresh } = useAssetLibrary('models')

  return (
    <>
      <p style={s.hint}>
        A model replaces the flat leaf for every opening of that kind in this room.{' '}
        <strong>Facing</strong> turns it so its front points out of the room.
      </p>
      <For each={OPENING_KIND_OPTIONS} getKey={(option) => option.value}>
        {(option) => (
          <ModelSlot
            vm={vm}
            roomIndex={roomIndex}
            room={room}
            kind={option.value}
            label={option.label}
            library={assets}
            onLibraryChange={refresh}
          />
        )}
      </For>
    </>
  )
}
