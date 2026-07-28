'use client'

import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, type Mesh, type Object3D } from 'three'

import type { BuildingScene } from '@/entities/building'
import { useConfiguratorSession } from '@/entities/configurator-session'

import { createNodeResolver } from '@/shared/three/node-path'
import { applyOverviewClipping } from '@/shared/three/overview-clipping'

type Props = {
  building: BuildingScene
}

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

  useEffect(() => {
    const bounds = new Box3().setFromObject(preparedScene)

    useConfiguratorSession.getState().setBuildingBounds({
      min: [bounds.min.x, bounds.min.y, bounds.min.z],
      max: [bounds.max.x, bounds.max.y, bounds.max.z],
    })
  }, [preparedScene])

  // Objects the admin removed from the scene are never rendered, in any mode.
  useEffect(() => {
    const removed: Object3D[] = []
    for (const path of building.hiddenNodePaths) {
      const object = resolveNode(path)
      if (object) {
        object.visible = false
        removed.push(object)
      }
    }
    return () => {
      for (const object of removed) object.visible = true
    }
  }, [building.hiddenNodePaths, resolveNode])

  /**
   * The overview is unchanged: the whole building, with the roof and the room
   * ceilings hidden by volume unless the visitor toggles them on.
   *
   * A focused room is a different scene entirely — generated geometry rendered
   * by RoomShell — so the real model simply steps aside. That is what removes
   * the cut-geometry artefacts: in room mode there is nothing left to cut.
   */
  const rootRef = useRef<Object3D>(null)

  useFrame(() => {
    const root = rootRef.current
    if (!root) return

    const { focusedRoomKey, showCeiling } = useConfiguratorSession.getState()
    const focused = focusedRoomKey !== null

    root.visible = !focused
    if (focused) return

    controller.setHideBoxes(showCeiling ? [] : building.roofBlocks)
  })

  return <primitive ref={rootRef} object={preparedScene} />
}
