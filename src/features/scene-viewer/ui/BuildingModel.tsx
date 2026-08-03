'use client'

import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, type Mesh, type Object3D } from 'three'

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

export function BuildingModel({ building }: Props) {
  const { scene } = useGLTF(building.modelUrl, false, true)

  const { preparedScene, controller, resolveNode } = useMemo(() => {
    scene.updateMatrixWorld(true)

    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })

    return {
      preparedScene: scene,
      controller: applyOverviewClipping(scene),
      resolveNode: createNodeResolver(scene),
    }
  }, [scene])

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

  const showCeiling = useConfiguratorSession((s) => s.showCeiling)
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
    // Everything above the storey is already outside it, roof included.
    controller.setHideBoxes(floor || showCeiling ? NOTHING_HIDDEN : building.roofBlocks)
  })

  return <primitive ref={rootRef} object={preparedScene} />
}
