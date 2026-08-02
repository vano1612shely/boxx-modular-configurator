'use client'

import { fitRoofToBuilding, type Extent } from '@/entities/building'
import { Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import { AssetPicker, assetRefOf, useAssetLibrary } from '../controls/AssetPicker'
import { NumberInput } from '../controls/NumberInput'
import { button, s } from '../editor-styles'

const NUDGE = 0.05

export function RoofModelSection({ vm }: { vm: SceneEditorVm }) {
  const { assets, refresh } = useAssetLibrary('models')
  const model = assetRefOf(vm.draft?.sceneConfig?.roofModel?.model, assets)
  const { position, yawDeg, scale } = vm.roofPlacement

  const fit = () => {
    const building = measuredBuilding(vm)
    const roof = vm.roofModelBounds
    if (!building || !roof) return
    vm.onFitRoofModel(fitRoofToBuilding(building, roof))
  }

  return (
    <>
      <p style={s.hint}>
        For a roof that is not part of the building model. It appears and disappears with the
        same Ceiling toggle as the volumes above, so both can be used together.
      </p>

      <AssetPicker
        collection="models"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        library={assets}
        onLibraryChange={refresh}
        value={model}
        emptyLabel="No separate roof"
        onChange={(asset) => vm.onSetRoofModel(asset ? { id: asset.id, url: asset.url } : null)}
      />

      <Show when={model !== null}>
        <button
          type="button"
          style={{ ...button('primary'), marginTop: 8 }}
          title="Centre it over the building, resting on the top, scaled to the footprint"
          disabled={!vm.roofModelBounds}
          onClick={fit}
        >
          ⤢ Fit to the building
        </button>

        <div style={{ ...s.row, marginTop: 8 }}>
          <button
            type="button"
            style={{ ...button(), padding: '6px 12px' }}
            title={`Down ${NUDGE} m`}
            onClick={() => vm.onMoveRoofModel(position.x, position.y - NUDGE, position.z)}
          >
            −
          </button>
          <label style={{ ...s.field, flex: 1 }}>
            <span style={s.label}>Height m</span>
            <NumberInput
              style={{ ...s.input, textAlign: 'center' }}
              value={position.y}
              onCommit={(value) => vm.onMoveRoofModel(position.x, value, position.z)}
            />
          </label>
          <button
            type="button"
            style={{ ...button(), padding: '6px 12px' }}
            title={`Up ${NUDGE} m`}
            onClick={() => vm.onMoveRoofModel(position.x, position.y + NUDGE, position.z)}
          >
            +
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <label style={s.field}>
            <span style={s.label}>X m</span>
            <NumberInput
              style={s.input}
              value={position.x}
              onCommit={(value) => vm.onMoveRoofModel(value, position.y, position.z)}
            />
          </label>
          <label style={s.field}>
            <span style={s.label}>Z m</span>
            <NumberInput
              style={s.input}
              value={position.z}
              onCommit={(value) => vm.onMoveRoofModel(position.x, position.y, value)}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <div style={s.field}>
            <span style={s.label}>Facing °</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <NumberInput
                style={{ ...s.input, flex: 1, minWidth: 0 }}
                step={5}
                value={yawDeg}
                onCommit={vm.onSetRoofYaw}
              />
              <button
                type="button"
                style={{ ...button(), padding: '6px 8px', fontSize: 12, flexShrink: 0 }}
                title="Quarter turn"
                onClick={() => vm.onSetRoofYaw((yawDeg + 90) % 360)}
              >
                ↻
              </button>
            </div>
          </div>
          <label style={s.field}>
            <span style={s.label}>Scale</span>
            <NumberInput
              style={s.input}
              step={0.01}
              value={scale}
              onCommit={vm.onSetRoofScale}
            />
          </label>
        </div>

        <p style={{ ...s.hint, marginTop: 8 }}>
          Drag the roof itself to move it across the building; drag its blue arrow for height.
        </p>
      </Show>
    </>
  )
}

function measuredBuilding(vm: SceneEditorVm): Extent | null {
  const footprint = vm.modelFootprint
  if (!footprint) return null

  return {
    min: [footprint.minX, 0, footprint.minZ],
    max: [footprint.maxX, vm.modelHeight, footprint.maxZ],
  }
}
