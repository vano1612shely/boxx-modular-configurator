'use client'

// Before any Canvas: r3f builds a THREE.Clock the moment a store is created.
import '@/shared/three/quiet-deprecations'

import { ContactShadows } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { memo, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useConfiguration } from '@/entities/configuration'
import {
  floorExtent,
  preloadOpeningModels,
  preloadRoomTextures,
  RoofModel,
  RoomParts,
  RoomShell,
  SceneLighting,
  roomFloorTopY,
  type BuildingScene,
} from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'
import { cn, isCoarsePointer } from '@/shared/lib'
import { SCENE_BACKGROUND } from '@/shared/three/scene-tokens'
import { For, Show } from '@/shared/ui/control-flow'
import { bindSceneCursor, setSceneCursor } from '@/shared/ui/scene-cursor'

import { useRoomTransition } from '../model/use-room-transition'
import { useSceneViewerModel } from '../model/use-scene-viewer-model'
import { BuildingModel } from './BuildingModel'
import { CameraRig } from './CameraRig'
import { RoomFloors } from './RoomFloors'
import { RoomHotspots } from './RoomHotspots'
import { RoomWarmup } from './RoomWarmup'
import { SceneLoader } from './SceneLoader'
import { SceneWarmup } from './SceneWarmup'
import { ShadowUpdates } from './ShadowUpdates'
import { ViewModeBar } from './ViewModeBar'
import { ZoneBar } from './ZoneBar'
import { ZoneFloors } from './ZoneFloors'

type Props = {
  building: BuildingScene
  /**
   * True where the building is being looked at rather than configured.
   *
   * A prop, deliberately, and never a flag in a store: the stores here are
   * module-level singletons that outlive a page, so a read-only order left on
   * one would follow the visitor back into the configurator and disable the
   * product. Everything this turns off is an *edit* affordance — orbiting,
   * entering a room, picking a storey and switching units all stay.
   */
  readOnly?: boolean
  children?: ReactNode
}

export function SceneViewer({ building, readOnly = false, children }: Props) {
  // Read once: a device does not grow a mouse mid-session, and re-reading it
  // per render would churn the Canvas props.
  const [coarse] = useState(isCoarsePointer)
  const vm = useSceneViewerModel(building)
  const bounds = useConfiguratorSession((s) => s.buildingBounds)
  const roofShown = useConfiguratorSession((s) => s.roofShown)
  const transition = useRoomTransition(vm.focusedRoom)
  /** The model whose shaders and textures are on the GPU, or null for none. */
  const [warmed, setWarmed] = useState<string | null>(null)
  const model = building.modelUrl
  // Stable, deliberately: the warm-up's own deadline is a timer keyed on this,
  // and a fresh identity every render would keep resetting it.
  const onWarm = useCallback(() => setWarmed(model), [model])

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
  const exterior = useConfiguration((s) => s.exterior)
  const exteriorPicks = useMemo(
    () =>
      Object.entries(exterior)
        .map(([spot, pick]) => `${spot}=${pick}`)
        .join(';'),
    [exterior],
  )
  const poses = useMemo(
    () =>
      placed
        .map((p) => `${p.instanceId}:${p.x.toFixed(2)},${p.z.toFixed(2)},${Math.round(p.rotationYDeg)}`)
        .join(';'),
    [placed],
  )
  // `transition.staged` as well as the focused room: everything generated for a
  // room — its shell and its fittings — mounts two frames after the focus is
  // written, and the map is only armed for two frames from a change of this
  // string. Without the staged key the counter goes into a room with no shadow
  // under it until something unrelated re-arms the map.
  const shadowTrigger = `${vm.focusedRoom?.key ?? ''}|${transition.staged?.key ?? ''}|${vm.selectedFloor?.key ?? ''}|${roofShown}|${bounds ? 1 : 0}|${poses}`

  // In an effect, not the render body: each preload walks suspend-react's whole
  // global cache comparing key arrays, and these assets never change.
  //
  // Held until the building itself is on the GPU. Nothing here is needed before
  // a room is entered, and started any earlier it is a dozen requests racing
  // the model for the six connections HTTP/1.1 gives the origin — which makes
  // the one thing the visitor is waiting for arrive later.
  const rooms = building.rooms
  useEffect(() => {
    if (warmed !== model) return

    preloadRoomTextures(rooms.map((room) => room.surfaces))
    preloadOpeningModels(rooms)
  }, [rooms, warmed, model])

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
        <SceneWarmup key={model} armed={bounds !== null} onWarm={onWarm} />
        {/* After the building is on the GPU, never alongside it: this is a
            dozen more shaders and half a dozen textures, and the veil is
            already down by the time it runs. */}
        <Show when={warmed === model}>
          <RoomWarmup rooms={rooms} buildingModelUrl={model} />
        </Show>
        <ShadowUpdates trigger={shadowTrigger} />
        <SceneLighting bounds={litBounds} focusedRoom={vm.focusedRoom} />
        <Show when={building.roofModel}>
          {(roof) => (
            <Suspense fallback={null}>
              <RoofModel
                roof={roof}
                visible={roofShown && !vm.isRoomFocused && vm.selectedFloor === null}
              />
            </Suspense>
          )}
        </Show>

        <Suspense fallback={null}>
          <BuildingModel building={building} readOnly={readOnly} />
          {/* Hidden, never unmounted: drei builds two render targets, a
              geometry and three materials in a memo with no cleanup, so every
              remount orphaned a set. A storey is also cut out mid-air, and a
              ground shadow under it would say it were standing on something. */}
          <group visible={!vm.isRoomFocused && vm.selectedFloor === null}>
            <GroundShadow
              y={(bounds?.min[1] ?? 0) - 0.01}
              size={groundSize(bounds)}
              changed={`${exteriorPicks}|${poses}`}
            />
          </group>
          {children}
        </Suspense>
        <Suspense fallback={null}>
          <Show when={transition.staged}>
            {(room) => (
              <>
                <RoomShell room={room} />
                {/* Only for the room actually being stood in: the staged room
                    is the one whose shell is up, so the tints cannot outlive it
                    on the way out. */}
                <Show when={vm.focusedRoom?.key === room.key}>
                  {/* The same gate, and for a sharper reason: a built-in copied
                      out of the building model is drawn a second time the frame
                      the building itself comes back, and `staged` lingers two
                      frames past that. */}
                  <RoomParts
                    parts={room.builtIns}
                    buildingModelUrl={building.modelUrl}
                    floorY={roomFloorTopY(room)}
                  />
                  <ZoneFloors
                    room={room}
                    activeZoneKey={vm.activeZoneKey}
                    onPickZone={vm.onPickZone}
                  />
                </Show>
              </>
            )}
          </Show>
        </Suspense>
        {/* Built-ins that came from the library, in the overview.
            Node-sourced ones are deliberately left out: those ARE the building
            model, which is on screen here, and drawing a copy over it would put
            two counters in the same place. A library model is not on screen
            unless this draws it, and a plan missing a room's counter is a plan
            that disagrees with the room. */}
        <Show when={!vm.isRoomFocused}>
          <For each={vm.visibleRooms} getKey={(room) => room.key}>
            {(room) => (
              <RoomParts
                parts={room.builtIns.filter((part) => part.source === 'model')}
                buildingModelUrl={building.modelUrl}
                floorY={roomFloorTopY(room)}
              />
            )}
          </For>
        </Show>

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
          markers={vm.markers}
          focusedKey={vm.focusedRoom?.key ?? null}
          onOpenMarker={vm.onOpenMarker}
        />
        <CameraRig
          building={building}
          focusedRoom={vm.focusedRoom}
          previewedRoom={vm.previewedRoom}
          floor={vm.selectedFloor}
          enabled={!vm.interactionLock}
        />
      </Canvas>

      <ZoneBar room={vm.focusedRoom} />
      <ViewModeBar floors={building.floors} readOnly={readOnly} />

      {/* `settling` is true for only two frames, so the veil cannot fade in. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-background transition-opacity',
          transition.settling ? 'opacity-70 duration-0' : 'opacity-0 duration-500 ease-out',
        )}
      />

      {/* `bounds` is set once the building is in the scene, not merely
          downloaded — and the veil stays for the warm-up after it, which is
          where the shaders and the textures actually reach the GPU. Lifting on
          `bounds` alone handed the visitor a scene that stalled on the first
          frame it drew, which is the frame the veil was fading on. */}
      <SceneLoader busy={!bounds || warmed !== model} settled={warmed === model} />
    </div>
  )
}

/**
 * The soft blob under the building, redrawn only when what casts it changes.
 *
 * drei renders the whole scene into a depth target and blurs it four times on
 * every frame by default; `frames={1}` cuts that to one — but its counter is
 * a plain local of the component, reset by every render of it, and every
 * render of SceneViewer was one. A room transition renders it several times,
 * each a 650k-triangle depth pass for a blob under a building that has not
 * moved. Memoised on the things that can move it: where the ground is, what
 * stands outside, what stands inside.
 */
const GroundShadow = memo(function GroundShadow({
  y,
  size,
}: {
  y: number
  size: number
  changed: string
}) {
  return (
    <ContactShadows position={[0, y, 0]} opacity={0.4} scale={size} blur={3} far={12} frames={1} />
  )
})

/**
 * Wide enough for the building to stand on with room to spare.
 *
 * A fixed 45 m did for offices; a ten-classroom school is fifty metres long,
 * and a shadow plane it overhangs reads as a slab the building fell off.
 */
function groundSize(bounds: { min: number[]; max: number[] } | null): number {
  if (!bounds) return 45
  const longest = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2])
  return Math.max(45, Math.ceil(longest * 1.5))
}

