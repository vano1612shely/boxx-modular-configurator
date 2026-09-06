'use client'

// Before any Canvas: r3f builds a THREE.Clock the moment a store is created.
import '@/shared/three/quiet-deprecations'

import { CameraControls, Grid, Line } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Plane, Raycaster, Vector2, Vector3, type Group } from 'three'

import { centreOnFootprint } from '@/shared/three/centre-model'
import { ModelStage } from '@/shared/three/ModelStage'
import { useModel } from '@/shared/three/use-model'
import { For, Show } from '@/shared/ui/control-flow'

import { clashingPieces } from '../lib/overlaps'
import type { ArrangerPiece, GroupArrangerVm } from '../model/use-group-arranger-model'

type Footprint = { width: number; depth: number }

const CLASH = '#f87171'
const SELECTED = '#38bdf8'
const CALM = '#64748b'

/** What a piece covers before its model has arrived to say otherwise. */
const UNKNOWN: Footprint = { width: 0.5, depth: 0.5 }

/**
 * One piece, drawn where the form says it stands.
 *
 * The model is centred on its own footprint exactly as the configurator centres
 * it, so what an admin lines up here is what the room will show. Its size is
 * handed back up because the clash test and the plate beneath it both need it,
 * and neither can know it until the glb has arrived.
 */
function PieceModel({
  piece,
  onMeasured,
}: {
  piece: ArrangerPiece & { modelUrl: string }
  onMeasured: (index: number, footprint: Footprint) => void
}) {
  const scene = useModel(piece.modelUrl)

  const object = useMemo(() => {
    const clone = scene.clone(true)
    const measured = centreOnFootprint(clone)
    return { clone, footprint: { width: measured.width, depth: measured.depth } }
  }, [scene])

  useEffect(() => {
    onMeasured(piece.index, object.footprint)
  }, [object, piece.index, onMeasured])

  return <primitive object={object.clone} />
}

/**
 * The floor plate under a piece: what it covers, and whether that is a problem.
 *
 * Drawn rather than tinting the model itself. A loaded glb is shared with every
 * other view of that file through the loader cache, so colouring its materials
 * to say "this one clashes" would colour it everywhere — including in the room,
 * for the visitor.
 */
function Plate({ footprint, tone }: { footprint: Footprint; tone: 'clash' | 'selected' | 'calm' }) {
  const colour = tone === 'clash' ? CLASH : tone === 'selected' ? SELECTED : CALM
  const halfX = footprint.width / 2
  const halfZ = footprint.depth / 2
  const outline: [number, number, number][] = [
    [-halfX, 0, -halfZ],
    [halfX, 0, -halfZ],
    [halfX, 0, halfZ],
    [-halfX, 0, halfZ],
    [-halfX, 0, -halfZ],
  ]

  return (
    <group position={[0, 0.002, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[footprint.width, footprint.depth]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={tone === 'calm' ? 0.08 : 0.22}
          depthWrite={false}
        />
      </mesh>
      <Line points={outline} color={colour} lineWidth={tone === 'calm' ? 1 : 2} />
    </group>
  )
}

/** Where the pointer meets the floor, in the scene's own metres. */
function useFloorPoint() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const raycaster = useMemo(() => new Raycaster(), [])
  const ndc = useMemo(() => new Vector2(), [])
  const floor = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new Vector3(), [])

  return (event: { clientX: number; clientY: number }): { x: number; z: number } | null => {
    const rect = gl.domElement.getBoundingClientRect()
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    return raycaster.ray.intersectPlane(floor, hit) ? { x: hit.x, z: hit.z } : null
  }
}

type SceneProps = {
  vm: GroupArrangerVm
  selected: number | null
  onSelect: (index: number | null) => void
  onFootprint: (index: number, footprint: Footprint) => void
  footprints: Map<number, Footprint>
}

function Scene({ vm, selected, onSelect, onFootprint, footprints }: SceneProps) {
  const floorPoint = useFloorPoint()
  const controls = useRef<CameraControls | null>(null)
  const groups = useRef(new Map<number, Group>())
  /**
   * The piece under the pointer, live.
   *
   * Kept out of React on purpose. A drag produces a position per pointer move,
   * and writing each one to the form would re-render the whole document editor
   * — every field, every row — for a change only one object in this canvas
   * cares about. The form is told once, when the piece is put down.
   */
  const drag = useRef<{ index: number; grabX: number; grabZ: number; x: number; z: number } | null>(
    null,
  )
  /**
   * Whether the gesture in progress began on bare floor.
   *
   * Clicking the floor is how a selection is let go of, and r3f raises that
   * click on the pointer going *up* — which is the same moment a press that
   * began on a piece ends. So picking a piece selected it and then dropped it
   * again the instant the button came up, and the controls for it were only
   * ever on screen while the button was held down. A press that lands on a
   * piece stops propagating and the floor never sees it, which is exactly what
   * tells the two gestures apart.
   */
  const fromFloor = useRef(false)

  const clashes = useMemo(
    () =>
      clashingPieces(
        vm.pieces.map((piece) => ({
          footprint: footprints.get(piece.index) ?? UNKNOWN,
          x: piece.x,
          z: piece.z,
          rotationYDeg: piece.rotationYDeg,
        })),
      ),
    [vm.pieces, footprints],
  )

  const start = (index: number) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    fromFloor.current = false
    // The camera and the piece share one canvas; without this the scene turns
    // under the very thing being dragged.
    if (controls.current) controls.current.enabled = false

    const point = floorPoint(event.nativeEvent)
    const piece = vm.pieces.find((candidate) => candidate.index === index)
    if (!point || !piece) return

    onSelect(index)
    // Grabbed where it was taken hold of, not by its middle: a table that jumps
    // so its centre meets the cursor is a table nobody aimed.
    drag.current = {
      index,
      grabX: point.x - piece.x,
      grabZ: point.z - piece.z,
      x: piece.x,
      z: piece.z,
    }
  }

  const move = (event: ThreeEvent<PointerEvent>) => {
    const live = drag.current
    if (!live) return

    const point = floorPoint(event.nativeEvent)
    if (!point) return

    live.x = point.x - live.grabX
    live.z = point.z - live.grabZ

    groups.current.get(live.index)?.position.set(live.x, 0, live.z)
  }

  const end = () => {
    const live = drag.current
    drag.current = null
    if (controls.current) controls.current.enabled = true
    if (live) vm.onMove(live.index, live.x, live.z)
  }

  return (
    <>
      <ModelStage />
      <Grid
        cellSize={0.25}
        sectionSize={1}
        cellColor="#334155"
        sectionColor="#475569"
        fadeDistance={26}
        infiniteGrid
      />

      {/* Catches the drag wherever the pointer wanders off to, and a click on
          bare floor is how a selection is let go of. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={() => {
          fromFloor.current = true
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onClick={() => {
          if (fromFloor.current) onSelect(null)
        }}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <For each={vm.pieces} getKey={(piece) => piece.index}>
        {(piece) => (
          <group
            ref={(node) => {
              if (node) groups.current.set(piece.index, node)
              else groups.current.delete(piece.index)
            }}
            position={[piece.x, 0, piece.z]}
            rotation={[0, (piece.rotationYDeg * Math.PI) / 180, 0]}
            onPointerDown={start(piece.index)}
            onPointerMove={move}
            onPointerUp={end}
          >
            <Plate
              footprint={footprints.get(piece.index) ?? UNKNOWN}
              tone={
                clashes.has(piece.index) ? 'clash' : selected === piece.index ? 'selected' : 'calm'
              }
            />
            <Show when={piece.modelUrl}>
              {(url) => (
                <Suspense fallback={null}>
                  <PieceModel piece={{ ...piece, modelUrl: url }} onMeasured={onFootprint} />
                </Suspense>
              )}
            </Show>
          </group>
        )}
      </For>

      <CameraControls
        ref={controls}
        makeDefault
        minDistance={0.5}
        maxDistance={60}
        // Never quite overhead: a polar angle of exactly zero is a degenerate
        // pose, and coming out of one hangs the main thread normalising angles.
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  )
}

export function ArrangerCanvas({
  vm,
  selected,
  onSelect,
}: {
  vm: GroupArrangerVm
  selected: number | null
  onSelect: (index: number | null) => void
}) {
  const [footprints, setFootprints] = useState<Map<number, Footprint>>(new Map())

  // Guarded on the value, not just written: this is called from an effect that
  // runs whenever a model finishes loading, and an unguarded set would put a new
  // Map in state on every one of them and re-run the effect that caused it.
  const onFootprint = useMemo(
    () => (index: number, footprint: Footprint) =>
      setFootprints((before) => {
        const had = before.get(index)
        if (had && had.width === footprint.width && had.depth === footprint.depth) return before
        return new Map(before).set(index, footprint)
      }),
    [],
  )

  return (
    <Canvas camera={{ position: [3.5, 3, 4.5], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={['#15171b']} />
      <Scene
        vm={vm}
        selected={selected}
        onSelect={onSelect}
        onFootprint={onFootprint}
        footprints={footprints}
      />
    </Canvas>
  )
}
