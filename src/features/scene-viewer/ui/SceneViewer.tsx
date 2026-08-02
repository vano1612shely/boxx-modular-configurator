'use client'

import { ContactShadows } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, type ReactNode } from 'react'

import { useConfiguration } from '@/entities/configuration'
import {
  preloadOpeningModels,
  preloadRoomTextures,
  RoofModel,
  RoomShell,
  SceneLighting,
  type BuildingScene,
} from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { cn } from '@/shared/lib'
import { SCENE_BACKGROUND } from '@/shared/three/scene-tokens'
import { Show } from '@/shared/ui/control-flow'
import { bindSceneCursor, setSceneCursor } from '@/shared/ui/scene-cursor'

import { useRoomTransition } from '../model/use-room-transition'
import { useSceneViewerModel } from '../model/use-scene-viewer-model'
import { BuildingModel } from './BuildingModel'
import { CameraRig } from './CameraRig'
import { RoomHotspots } from './RoomHotspots'
import { SceneLoader } from './SceneLoader'
import { ViewModeBar } from './ViewModeBar'

type Props = {
  building: BuildingScene
  children?: ReactNode
}

export function SceneViewer({ building, children }: Props) {
  const vm = useSceneViewerModel(building)
  const bounds = useConfiguratorSession((s) => s.buildingBounds)
  const showCeiling = useConfiguratorSession((s) => s.showCeiling)
  const transition = useRoomTransition(vm.focusedRoom)

  preloadRoomTextures(building.rooms.map((room) => room.surfaces))
  preloadOpeningModels(building.rooms)

  const opening = { position: building.camera.position, target: building.camera.target }

  return (
    <div
      ref={bindSceneCursor}
      className="relative size-full"
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
        // The environment map carries most of the soft light in both rigs.
        scene={{ environmentIntensity: 0.35 }}
        dpr={[1, 2]}
        // Per-material clipping planes are off by default; the selection glow
        // uses one to stop short of the floor instead of z-fighting with it.
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true
        }}
        className="touch-none"
        onPointerMissed={() => useConfiguration.getState().selectPackage(null)}
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <SceneLighting bounds={bounds} focusedRoom={vm.focusedRoom} />
        <Show when={building.roofModel}>
          {(roof) => (
            <Suspense fallback={null}>
              <RoofModel roof={roof} visible={showCeiling && !vm.isRoomFocused} />
            </Suspense>
          )}
        </Show>

        <Suspense fallback={null}>
          <BuildingModel building={building} />
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
        <Suspense fallback={null}>
          <Show when={transition.staged}>{(room) => <RoomShell room={room} />}</Show>
        </Suspense>
        <RoomHotspots rooms={vm.rooms} visible={!vm.isRoomFocused} onFocusRoom={vm.onFocusRoom} />
        <CameraRig building={building} focusedRoom={vm.focusedRoom} enabled={!vm.interactionLock} />
      </Canvas>

      <ViewModeBar />

      {/* `settling` is true for only two frames, so the veil cannot fade in. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-background transition-opacity',
          transition.settling ? 'opacity-70 duration-0' : 'opacity-0 duration-500 ease-out',
        )}
      />

      {/* `bounds` is set once the building is in the scene, not merely downloaded. */}
      <SceneLoader busy={!bounds} />
    </div>
  )
}
