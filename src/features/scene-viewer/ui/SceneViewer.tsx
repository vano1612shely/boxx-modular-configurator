'use client'

import { ContactShadows, Loader } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, type ReactNode } from 'react'

import { useConfiguration } from '@/entities/configuration'
import {
  buildingExtent,
  frameBuilding,
  preloadOpeningModels,
  preloadRoomTextures,
  RoomShell,
  SceneLighting,
  type BuildingScene,
} from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { Show } from '@/shared/ui/control-flow'
import { bindSceneCursor, setSceneCursor } from '@/shared/ui/scene-cursor'

import { useSceneViewerModel } from '../model/use-scene-viewer-model'
import { BuildingModel } from './BuildingModel'
import { CameraRig } from './CameraRig'
import { RoomHotspots } from './RoomHotspots'
import { ViewModeBar } from './ViewModeBar'

type Props = {
  building: BuildingScene
  /** Extra 3D content rendered inside the canvas (e.g. placed furniture). */
  children?: ReactNode
}

export function SceneViewer({ building, children }: Props) {
  const vm = useSceneViewerModel(building)
  const bounds = useConfiguratorSession((s) => s.buildingBounds)

  // Every room's finishes are known at page load, so warming them here makes
  // stepping into a room instant instead of a suspend on a network round trip.
  preloadRoomTextures(building.rooms.map((room) => room.surfaces))
  preloadOpeningModels(building.rooms)

  // The same frame CameraRig flies to, so the first painted frame already shows
  // the building. Handed the stored preset raw, a document whose camera was
  // captured from inside opens on a blank wall and only recovers once the rig's
  // effect has run.
  const extent = buildingExtent(building)
  const opening = extent
    ? frameBuilding(extent.min, extent.max, building.camera.fov, {
        position: building.camera.position,
        target: building.camera.target,
      })
    : { position: building.camera.position, target: building.camera.target }

  return (
    <div
      ref={bindSceneCursor}
      className="relative size-full"
      // Anywhere that is not a piece of furniture, a press means the camera.
      onPointerDown={(event) => {
        if (event.button === 0 && !useConfiguration.getState().draggingInstanceId) {
          setSceneCursor('orbiting')
        }
      }}
      onPointerUp={() => setSceneCursor('default')}
      onPointerLeave={() => setSceneCursor('default')}
    >
      <Canvas
        // three r185 deprecated PCFSoftShadowMap (the default for shadows={true});
        // "percentage" maps to the recommended PCFShadowMap.
        shadows="percentage"
        camera={{ position: opening.position, fov: building.camera.fov }}
        // How hard the procedural environment map pushes. It carries most of
        // the soft light in both rigs — the alternative is ambient light, which
        // adds the same flat value to every face whatever way it points.
        scene={{ environmentIntensity: 0.35 }}
        dpr={[1, 2]}
        className="touch-none"
        onPointerMissed={() => useConfiguration.getState().selectPackage(null)}
      >
        <color attach="background" args={['#f2f3f5']} />
        <SceneLighting bounds={bounds} focusedRoom={vm.focusedRoom} />
        <Suspense fallback={null}>
          <BuildingModel building={building} />
          {/* Ground contact only — it sits on the plane the building stands
              on, and a focused room is nowhere near it. */}
          <Show when={!vm.isRoomFocused}>
            <ContactShadows
              position={[0, (bounds?.min[1] ?? 0) - 0.01, 0]}
              opacity={0.4}
              scale={45}
              blur={3}
              far={12}
            />
          </Show>
          {children}
        </Suspense>
        {/* Its own boundary: a texture load must never blank the building,
            the furniture and the shadows along with it. */}
        <Suspense fallback={null}>
          <Show when={vm.focusedRoom}>{(room) => <RoomShell room={room} />}</Show>
        </Suspense>
        <RoomHotspots rooms={vm.rooms} visible={!vm.isRoomFocused} onFocusRoom={vm.onFocusRoom} />
        <CameraRig building={building} focusedRoom={vm.focusedRoom} enabled={!vm.interactionLock} />
      </Canvas>

      <Show when={vm.focusedRoom}>
        {(room) => (
          <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-background/90 py-2 pr-2 pl-4 shadow-md ring-1 ring-border backdrop-blur">
            <span className="text-sm font-medium">{room.name}</span>
            <button
              type="button"
              onClick={vm.onExitRoomFocus}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              View full building
            </button>
          </div>
        )}
      </Show>

      <ViewModeBar />

      <Loader />
    </div>
  )
}
