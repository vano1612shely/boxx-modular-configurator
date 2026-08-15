'use client'

import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, type Material, type Mesh, type Object3D } from 'three'

import {
  extentWithoutSite,
  findFloor,
  type BuildingScene,
  type PartExtent,
  type ZoneBox,
} from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'

import { createNodeResolver } from '@/shared/three/node-path'
import { applyOverviewClipping } from '@/shared/three/overview-clipping'

type Props = {
  building: BuildingScene
}

/** Hoisted: a fresh literal would be a new value on every frame. */
const NOTHING_HIDDEN: ZoneBox[] = []

/**
 * Largest world dimension, in metres, under which a part stops casting shadow.
 *
 * More than half the model's triangles are fittings — diffusers, sockets,
 * chrome — and every one of them was drawn into the shadow map. At 2048² over a
 * building-sized frustum a texel is a couple of centimetres, so a socket casts
 * three or four of them, and `shadow-radius: 8` then blurs those away to
 * nothing. The map is redrawn on every change that arms it — a storey picked, a
 * room left, the roof appearing — so this comes off the price of each of those,
 * not just off the first frame.
 *
 * Receiving is left alone: a small part in shadow still has to look like it.
 */
const SHADOW_CASTER_SIZE = 0.4

/** Largest world-space dimension of a measured box. */
function longestSide(box: Box3): number {
  return Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z)
}

export function BuildingModel({ building }: Props) {
  const { scene } = useGLTF(building.modelUrl, false, true)
  // Two, not one: with a single storey there is nothing the picker can cut to,
  // and the clipping planes would be six tests a fragment for no cut.
  const cuttable = building.floors.length >= 2

  const { preparedScene, controller, resolveNode } = useMemo(() => {
    scene.updateMatrixWorld(true)
    const measured = new Box3()

    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return

      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const box = mesh.geometry.boundingBox

      // A part with nothing measurable keeps its shadow: the rule is there to
      // drop what demonstrably cannot show one, not what it cannot read.
      mesh.castShadow =
        !box ||
        longestSide(measured.copy(box).applyMatrix4(mesh.matrixWorld)) >= SHADOW_CASTER_SIZE
      mesh.receiveShadow = true

      // A single transmissive material — a plastic diffuser, a few thousand
      // triangles — makes three draw the whole scene a second time every frame,
      // into a full-resolution multisampled half-float target. Ordinary
      // translucency looks near enough on a part that size and costs nothing.
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const physical = material as Material & { transmission?: number }
        if (!physical || typeof physical.transmission !== 'number') continue
        if (physical.transmission <= 0) continue
        physical.transmission = 0
        physical.transparent = true
        physical.opacity = Math.min(physical.opacity, 0.65)
        physical.needsUpdate = true
      }
    })

    return {
      preparedScene: scene,
      controller: applyOverviewClipping(scene, { cuttable }),
      resolveNode: createNodeResolver(scene),
    }
  }, [scene, cuttable])

  const hiddenNodePaths = building.hiddenNodePaths
  useEffect(() => {
    // Box3 never consults `visible`, so hidden nodes must be dropped explicitly.
    const dropped = new Set<Object3D>()
    for (const path of hiddenNodePaths) {
      resolveNode(path)?.traverse((object) => dropped.add(object))
    }

    const parts: PartExtent[] = []
    const scratch = new Box3()

    preparedScene.updateMatrixWorld(true)
    preparedScene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh || !mesh.geometry || dropped.has(object)) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const box = mesh.geometry.boundingBox
      if (!box) return
      scratch.copy(box).applyMatrix4(mesh.matrixWorld)
      parts.push({
        min: [scratch.min.x, scratch.min.y, scratch.min.z],
        max: [scratch.max.x, scratch.max.y, scratch.max.z],
      })
    })

    const measured = extentWithoutSite(parts)
    if (!measured) return

    // Publish only on a real change: the camera scope is memoised on this
    // object's identity, so equal-but-new bounds refly the camera.
    const current = useConfiguratorSession.getState().buildingBounds
    const same =
      current !== null &&
      current.min.every((value, axis) => value === measured.min[axis]) &&
      current.max.every((value, axis) => value === measured.max[axis])
    if (same) return

    useConfiguratorSession.getState().setBuildingBounds(measured)
  }, [preparedScene, hiddenNodePaths, resolveNode])

  useEffect(() => {
    const removed: Object3D[] = []
    for (const path of hiddenNodePaths) {
      const object = resolveNode(path)
      if (object) {
        object.visible = false
        removed.push(object)
      }
    }
    return () => {
      for (const object of removed) object.visible = true
    }
  }, [hiddenNodePaths, resolveNode])

  const roofShown = useConfiguratorSession((s) => s.roofShown)
  const selectedFloorKey = useConfiguratorSession((s) => s.selectedFloorKey)

  const floor = useMemo(
    () => findFloor(building.floors, selectedFloorKey),
    [building.floors, selectedFloorKey],
  )

  const rootRef = useRef<Object3D>(null)

  useFrame(() => {
    const root = rootRef.current
    if (!root) return

    const focused = useConfiguratorSession.getState().focusedRoomKey !== null

    root.visible = !focused
    if (focused) return

    // A storey is stated as what stays, not as what goes: the cut has to reach
    // the shadow map, and only clipping planes do.
    controller.setKeepBox(floor?.box ?? null)
    // The roof goes with any storey, even one whose volume was drawn around it:
    // looking at a storey means looking into it. Otherwise it follows the tilt,
    // which the rig reads off the live pose.
    controller.setHideBoxes(floor || !roofShown ? building.roofBlocks : NOTHING_HIDDEN)
  })

  return <primitive ref={rootRef} object={preparedScene} />
}
