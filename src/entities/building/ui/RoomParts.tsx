'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { MathUtils, type Material, type Mesh, type Object3D } from 'three'

import { createNodeResolver } from '@/shared/three/node-path'
import { partObject } from '@/shared/three/part-object'
import { useModel } from '@/shared/three/use-model'
import { For } from '@/shared/ui/control-flow'

import type { RoomPart } from '../model/types'

type Props = {
  parts: ReadonlyArray<RoomPart>
  /** The building's own glb — where a node part is copied from. */
  buildingModelUrl: string
  /** Top face of this room's floor; a part's height is measured from it. */
  floorY: number
}

/**
 * A material of the building's, freed from the building's own clipping.
 *
 * `applyOverviewClipping` hangs a shared `clippingPlanes` array and a hide-box
 * discard in `onBeforeCompile` on every material of the building model, and
 * `Material.clone()` copies both. Inside a room the controller is never asked
 * again — BuildingModel's frame loop returns as soon as a room is focused — so
 * whichever storey was last picked would go on cutting a counter that is no
 * longer part of the building being cut.
 */
function detached(material: Material): Material {
  const clone = material.clone()
  clone.clippingPlanes = null
  clone.clipShadows = false
  clone.onBeforeCompile = () => {}
  clone.needsUpdate = true
  return clone
}

function disposeMaterials(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material?.dispose()
    }
  })
}

/** Never a click surface: the zone floors and the drag plane are behind it. */
function makeInert(root: Object3D) {
  root.traverse((node) => {
    node.raycast = () => {}
  })
}

/**
 * A piece of the building's own model, standing where the building has it.
 *
 * Entering a room hides the building wholesale — `root.visible = !focused`, and
 * visibility in three is inherited, so there is no leaving one node behind. The
 * copy is what gets to stay. Its pose comes with it: a path is relative to the
 * root but a clone carries only its own local matrix, so the source's world
 * matrix is baked in, which is what makes a counter land on the wall it was
 * modelled against rather than at the origin.
 */
function NodePart({ part, buildingModelUrl }: { part: RoomPart; buildingModelUrl: string }) {
  const scene = useModel(buildingModelUrl)

  const object = useMemo(() => {
    if (!part.nodePath) return null

    const source = createNodeResolver(scene)(part.nodePath)
    if (!source) return null

    scene.updateMatrixWorld(true)
    const clone = source.clone(true)
    clone.matrix.copy(source.matrixWorld)
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)

    clone.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(detached)
        : detached(mesh.material)
    })
    makeInert(clone)

    return clone
  }, [scene, part.nodePath])

  useEffect(() => {
    if (!object) return
    return () => disposeMaterials(object)
  }, [object])

  if (!object) return null

  return <primitive object={object} />
}

/**
 * A model from the library, standing where the admin put it.
 *
 * Centred on its footprint and stood on its own base first, so the numbers an
 * admin types mean what they say: x and z are the middle of the thing, and y is
 * its height above this room's floor rather than above whatever level its
 * exporter happened to use.
 */
function ModelPart({ part, floorY }: { part: RoomPart; floorY: number }) {
  const scene = useModel(part.modelUrl ?? '')
  const nodePath = part.nodePath

  const object = useMemo(() => {
    const taken = partObject(scene, nodePath)
    if (!taken) return null

    const clone = taken.object
    clone.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    makeInert(clone)

    return clone
  }, [scene, nodePath])

  if (!object) return null

  return (
    <group
      position={[part.position[0], floorY + part.position[1], part.position[2]]}
      rotation={[0, MathUtils.degToRad(part.yawDeg), 0]}
      scale={part.scale}
    >
      <primitive object={object} />
    </group>
  )
}

/**
 * The fittings of one room, drawn inside it.
 *
 * One component for both lists a room carries, because a counter that came with
 * the building and a fridge that was bought are the same thing to the renderer:
 * something standing still where the admin said. What differs is who decides
 * whether it is on screen, and that is the caller's business.
 *
 * Each part suspends on its own. The staged room shares one boundary with the
 * walls, so a single slow model behind a shared `Suspense` would blank the
 * whole room until it arrived.
 */
export function RoomParts({ parts, buildingModelUrl, floorY }: Props) {
  return (
    <For each={parts} getKey={(part) => part.key}>
      {(part) => (
        <Suspense fallback={null}>
          {part.source === 'node' ? (
            <NodePart part={part} buildingModelUrl={buildingModelUrl} />
          ) : (
            <ModelPart part={part} floorY={floorY} />
          )}
        </Suspense>
      )}
    </For>
  )
}
