'use client'

import { ContactShadows } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useConfiguration } from '@/entities/configuration'
import {
  floorExtent,
  preloadOpeningModels,
  preloadRoomTextures,
  RoofModel,
  RoomShell,
  SceneLighting,
  type BuildingScene,
} from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { cn, isCoarsePointer } from '@/shared/lib'
import { SCENE_BACKGROUND } from '@/shared/three/scene-tokens'
import { Show } from '@/shared/ui/control-flow'
import { bindSceneCursor, setSceneCursor } from '@/shared/ui/scene-cursor'

import { useRoomTransition } from '../model/use-room-transition'
import { useSceneViewerModel } from '../model/use-scene-viewer-model'
import { BuildingModel } from './BuildingModel'
import { CameraRig } from './CameraRig'
import { RoomFloors } from './RoomFloors'
import { RoomHotspots } from './RoomHotspots'
import { SceneLoader } from './SceneLoader'
import { ShadowUpdates } from './ShadowUpdates'
import { ViewModeBar } from './ViewModeBar'

type Props = {
  building: BuildingScene
  children?: ReactNode
}

export function SceneViewer({ building, children }: Props) {
  // Read once: a device does not grow a mouse mid-session, and re-reading it
  // per render would churn the Canvas props.
  const [coarse] = useState(isCoarsePointer)
  const vm = useSceneViewerModel(building)
  const bounds = useConfiguratorSession((s) => s.buildingBounds)
  const showCeiling = useConfiguratorSession((s) => s.showCeiling)
  const transition = useRoomTransition(vm.focusedRoom)

  // Framing the storey rather than the building keeps the shadow map's
  // resolution on what is actually on screen.
  const litBounds = useMemo(
    () => (vm.selectedFloor ? floorExtent(vm.selectedFloor, bounds) : bounds),
    [vm.selectedFloor, bounds],
  )

  // Everything that changes what the sun has to draw into the shadow map.
  //
  // Poses, not just how many there are: turning a piece moves nothing in or out
  // of the scene, so a count would not notice, and the shadow would go on
  // pointing the old way until something unrelated re-armed the map. Memoised,
  // or every render of this component would rebuild the string.
  const placed = useConfiguration((s) => s.placed)
  const poses = useMemo(
    () =>
      placed
        .map((p) => `${p.instanceId}:${p.x.toFixed(2)},${p.z.toFixed(2)},${Math.round(p.rotationYDeg)}`)
        .join(';'),
    [placed],
  )
  const shadowTrigger = `${vm.focusedRoom?.key ?? ''}|${vm.selectedFloor?.key ?? ''}|${showCeiling}|${bounds ? 1 : 0}|${poses}`

  // In an effect, not the render body: each preload walks suspend-react's whole
  // global cache comparing key arrays, and these assets never change.
  useEffect(() => {
    preloadRoomTextures(building.rooms.map((room) => room.surfaces))
    preloadOpeningModels(building.rooms)
  }, [building.rooms])

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
        // A DPR-3 phone would otherwise render 1.3 megapixels, which multiplies
        // every per-fragment cost in the scene. `alpha` buys nothing: the
        // background is painted over the whole buffer on the next line.
        dpr={[1, coarse ? 1.5 : 2]}
        gl={{ alpha: false, antialias: !coarse }}
        // Per-material clipping planes are off by default; the selection glow
        // uses one to stop short of the floor instead of z-fighting with it.
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true
          // The building does not move; ShadowUpdates redraws the map on the
          // frames where something that casts into it has actually changed.
          gl.shadowMap.autoUpdate = false
        }}
        className="touch-none"
        onPointerMissed={() => {
          useConfiguration.getState().selectPackage(null)
          // Clicking off a room steps back out of its preview, the same way it
          // drops a selected item. Guarded in the store, so a click on empty
          // ground with nothing previewed does not reframe the camera.
          useConfiguratorSession.getState().clearPreview()
        }}
      >
        <color attach="background" args={[SCENE_BACKGROUND]} />
        <ShadowUpdates trigger={shadowTrigger} />
        <SceneLighting bounds={litBounds} focusedRoom={vm.focusedRoom} />
        <Show when={building.roofModel}>
          {(roof) => (
            <Suspense fallback={null}>
              <RoofModel
                roof={roof}
                visible={showCeiling && !vm.isRoomFocused && vm.selectedFloor === null}
              />
            </Suspense>
          )}
        </Show>

        <Suspense fallback={null}>
          <BuildingModel building={building} />
          {/* Hidden, never unmounted: drei builds two render targets, a
              geometry and three materials in a memo with no cleanup, so every
              remount orphaned a set. A storey is also cut out mid-air, and a
              ground shadow under it would say it were standing on something. */}
          <group visible={!vm.isRoomFocused && vm.selectedFloor === null}>
            <ContactShadows
              position={[0, (bounds?.min[1] ?? 0) - 0.01, 0]}
              opacity={0.4}
              scale={45}
              blur={3}
              far={12}
              // drei defaults this to Infinity: a whole-scene depth render plus
              // four blur passes, every frame, for a blob under a building that
              // does not move. One frame per render of this component is
              // exactly as often as it can have changed.
              frames={1}
            />
          </group>
          {children}
        </Suspense>
        <Suspense fallback={null}>
          <Show when={transition.staged}>{(room) => <RoomShell room={room} />}</Show>
        </Suspense>
        {/* Only outside a room: in one, the floor under the visitor belongs to
            the generated shell and clicking it means nothing. */}
        <Show when={!vm.isRoomFocused}>
          <RoomFloors
            rooms={vm.visibleRooms}
            previewedKey={vm.previewedRoom?.key ?? null}
            onPreviewRoom={vm.onPreviewRoom}
          />
        </Show>
        <RoomHotspots
          rooms={vm.visibleRooms}
          focusedKey={vm.focusedRoom?.key ?? null}
          onFocusRoom={vm.onFocusRoom}
        />
        <CameraRig
          building={building}
          focusedRoom={vm.focusedRoom}
          previewedRoom={vm.previewedRoom}
          floor={vm.selectedFloor}
          enabled={!vm.interactionLock}
        />
      </Canvas>

      <ViewModeBar floors={building.floors} />

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
