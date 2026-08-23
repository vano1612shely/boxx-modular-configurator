'use client'

import type { RoomPart } from '@/entities/building'
import { For, Show } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { AssetPicker, useAssetLibrary } from '../../controls/AssetPicker'
import { NumberInput } from '../../controls/NumberInput'
import { button, s, tone } from '../../editor-styles'

type Props = { vm: SceneEditorVm }

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 8px',
  borderRadius: 6,
}

const iconButton = { ...button(), padding: '5px 8px', fontSize: 12 }

/** What a row calls itself. A path is not a name; the model's own name is. */
function partLabel(part: RoomPart, nameOf: (path: string) => string | null): string {
  if (part.source === 'node') {
    const name = part.nodePath ? nameOf(part.nodePath) : null
    return name ? `⌂ ${name}` : `⌂ ${part.nodePath ?? '?'}`
  }
  const file = (part.modelUrl ?? '').split('/').pop() ?? ''
  return decodeURIComponent(file) || 'Model'
}

/**
 * The things standing in a room, and the numbers for whichever one is picked.
 *
 * One editor for both of a room's lists. A counter that came with the building
 * and a fridge that is being sold are the same job to arrange, and giving each
 * its own panel would have been two of everything below for no difference an
 * admin could name — the difference between them is what they mean, which is
 * what the two tabs above are for.
 */
export function PartList({ vm }: Props) {
  const { assets, refresh } = useAssetLibrary('models')
  const parts = vm.scopedParts
  const picking = vm.mode === 'pick-fitting'
  const selected = vm.selectedPart
  const nameOf = (path: string) => vm.modelNodes.find((node) => node.path === path)?.name ?? null

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button
          type="button"
          style={button(picking ? 'primary' : undefined)}
          title="Click the counter, the sink — anything the building already has"
          onClick={() => vm.onSetMode(picking ? 'select' : 'pick-fitting')}
        >
          {picking ? '⦿ Click it now' : '＋ From the building'}
        </button>
        {/* Adds on pick rather than holding a value: this is a way in, not a
            setting. The list below is what the room has. */}
        <AssetPicker
          collection="models"
          accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
          library={assets}
          onLibraryChange={refresh}
          value={null}
          emptyLabel="＋ From the library"
          onChange={(asset) => {
            if (asset?.url) vm.onAddModelFitting(asset.url)
          }}
        />
      </div>

      {/* The name of whatever is under the pointer, while one is being picked.
          The highlight in the viewport says which object; this says which one
          it is going to be called, since a path never will. */}
      <Show when={picking}>
        <div
          style={{
            marginTop: 6,
            padding: '7px 9px',
            borderRadius: 6,
            background: tone.card,
            border: `1px solid ${vm.hoveredNodeName ? tone.accent : tone.lineSoft}`,
            fontSize: 12,
            color: vm.hoveredNodeName ? tone.text : tone.textFaint,
            minHeight: 30,
          }}
        >
          {vm.hoveredNodeName ?? 'Point at the building — what you are over lights up.'}
        </div>
      </Show>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <For each={parts} getKey={(part) => part.key} fallback={<p style={s.hint}>Nothing yet.</p>}>
          {(part) => (
            <div
              style={{
                ...row,
                background: vm.selectedPartKey === part.key ? tone.raised : 'transparent',
              }}
            >
              <button
                type="button"
                style={{
                  ...button(),
                  flex: 1,
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  padding: '2px 0',
                  fontSize: 12,
                }}
                onClick={() => vm.onSelectPart(vm.selectedPartKey === part.key ? null : part.key)}
              >
                {partLabel(part, nameOf)}
              </button>
              <button
                type="button"
                style={iconButton}
                title="Take it out of the room"
                onClick={() => vm.onRemovePart(part.key)}
              >
                ✕
              </button>
            </div>
          )}
        </For>
      </div>

      <Show when={selected}>
        {(part) => (
          <Show
            when={part.source === 'model'}
            fallback={
              <p style={{ ...s.hint, marginTop: 8 }}>
                A piece of the building stands where the building has it. Nothing to set.
              </p>
            }
          >
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <label style={s.field}>
                <span style={s.label}>X m</span>
                <NumberInput
                  style={s.input}
                  value={part.position[0]}
                  onCommit={(value) =>
                    vm.onMovePart(part.key, value, part.position[1], part.position[2])
                  }
                />
              </label>
              <label style={s.field}>
                <span style={s.label}>Z m</span>
                <NumberInput
                  style={s.input}
                  value={part.position[2]}
                  onCommit={(value) =>
                    vm.onMovePart(part.key, part.position[0], part.position[1], value)
                  }
                />
              </label>
              <label style={s.field}>
                <span style={s.label}>Height m</span>
                <NumberInput
                  style={s.input}
                  step={0.01}
                  value={part.position[1]}
                  onCommit={(value) =>
                    vm.onMovePart(part.key, part.position[0], value, part.position[2])
                  }
                />
              </label>
              <div style={s.field}>
                <span style={s.label}>Facing °</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <NumberInput
                    style={{ ...s.input, flex: 1, minWidth: 0 }}
                    step={5}
                    value={part.yawDeg}
                    onCommit={(value) => vm.onSetPartYaw(part.key, value)}
                  />
                  <button
                    type="button"
                    style={{ ...iconButton, flexShrink: 0 }}
                    title="Quarter turn"
                    onClick={() => vm.onSetPartYaw(part.key, (part.yawDeg + 90) % 360)}
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
                  value={part.scale}
                  onCommit={(value) => vm.onSetPartScale(part.key, value)}
                />
              </label>
            </div>
            <p style={{ ...s.hint, marginTop: 6 }}>
              In the viewport: the white puck under it moves it across the floor, the yellow arrow
              over it sets the height, and the blue grip on the ring turns it. Height is measured
              from this room&rsquo;s floor, so a microwave on a 0.92 m worktop stays on it if the
              storey is ever re-levelled.
            </p>
          </Show>
        )}
      </Show>
    </>
  )
}
