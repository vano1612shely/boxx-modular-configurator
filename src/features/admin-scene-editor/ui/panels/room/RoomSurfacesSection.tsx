'use client'

import type { RoomDoc } from '@/entities/building'
import { TEXTURED_SURFACE_OPTIONS } from '@/modules/shared/room-shell'
import { For } from '@/shared/ui/control-flow'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import {
  AssetPicker,
  assetRefOf,
  useAssetLibrary,
  type AssetRef,
} from '../../controls/AssetPicker'
import { NumberInput } from '../../controls/NumberInput'
import { s } from '../../editor-styles'

type SurfaceKey = (typeof TEXTURED_SURFACE_OPTIONS)[number]['value']

function TextureSlot({
  vm,
  roomIndex,
  room,
  surface,
  label,
  library,
  onLibraryChange,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
  surface: SurfaceKey
  label: string
  library: AssetRef[]
  onLibraryChange: () => void
}) {
  const entry = ((room.surfaces ?? {}) as Record<string, Record<string, unknown> | undefined>)[
    surface
  ]
  const texture = assetRefOf(entry?.texture, library)

  return (
    <div style={{ ...s.card, gap: 6, padding: 8 }}>
      <span style={s.heading}>{label}</span>

      <AssetPicker
        collection="textures"
        accept="image/*"
        library={library}
        onLibraryChange={onLibraryChange}
        value={texture}
        swatch
        emptyLabel="No texture"
        onChange={(asset) =>
          vm.onSetSurface(roomIndex, surface, {
            texture: asset ? { id: asset.id, url: asset.url } : null,
          })
        }
      />

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={s.label}>tile m</span>
        <NumberInput
          style={{ ...s.inputTiny, width: 62 }}
          step={0.1}
          title="Meters covered by one horizontal repeat"
          value={(entry?.tileWidth as number) ?? 1}
          onCommit={(tileWidth) => vm.onSetSurface(roomIndex, surface, { tileWidth })}
        />
        <span style={s.label}>×</span>
        <NumberInput
          style={{ ...s.inputTiny, width: 62 }}
          step={0.1}
          title="Meters covered by one vertical repeat"
          value={(entry?.tileHeight as number) ?? 1}
          onCommit={(tileHeight) => vm.onSetSurface(roomIndex, surface, { tileHeight })}
        />
      </div>
    </div>
  )
}

export function RoomSurfacesSection({
  vm,
  roomIndex,
  room,
}: {
  vm: SceneEditorVm
  roomIndex: number
  room: RoomDoc
}) {
  const { assets, refresh } = useAssetLibrary('textures')

  return (
    <>
      <p style={s.hint}>
        Pick a texture already in the library, or ↑ to upload a new one. Tile size is the
        real-world span of one repeat, in meters.
      </p>
      <For each={TEXTURED_SURFACE_OPTIONS} getKey={(option) => option.value}>
        {(option) => (
          <TextureSlot
            vm={vm}
            roomIndex={roomIndex}
            room={room}
            surface={option.value}
            label={option.label}
            library={assets}
            onLibraryChange={refresh}
          />
        )}
      </For>
    </>
  )
}
