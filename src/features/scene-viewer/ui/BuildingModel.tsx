'use client'

import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, type Material, type Mesh, type Object3D } from 'three'

import {
  extentWithoutSite,
  findFloor,
  hiddenExteriorNodes,
  type BuildingScene,
  type PartExtent,
  type ZoneBox,
} from '@/entities/building'
import { useConfiguration } from '@/entities/configuration'
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

  const exteriorSelection = useConfiguration((s) => s.exterior)

  /**
   * Objects an exterior spot owns but is not currently showing.
   *
   * Deliberately absent from the bounds above: measuring what is on screen would
   * refly the camera every time a visitor tried a different ramp. Measuring the
   * union instead leaves the frame still while the geometry inside it changes,
   * which is what switching between choices should feel like.
   */
  const exteriorHidden = useMemo(
    () => hiddenExteriorNodes(building.exteriorSlots, exteriorSelection),
    [building.exteriorSlots, exteriorSelection],
  )

  useEffect(() => {
    const removed: Object3D[] = []
    for (const path of [...hiddenNodePaths, ...exteriorHidden]) {
      const object = resolveNode(path)
      if (object) {
        object.visible = false
        removed.push(object)
      }
    }
    return () => {
      for (const object of removed) object.visible = true
    }
  }, [hiddenNodePaths, exteriorHidden, resolveNode])

  /**
   * Which spot each object of the model belongs to, for the ones that offer a
   * choice. A spot with a single entry is scenery, not a picker, so it is left
   * out and its geometry stays as inert as the walls.
   */
  const claimedBy = useMemo(() => {
    const owners = new Map<Object3D, string>()
    for (const slot of building.exteriorSlots) {
      if (slot.variants.length < 2) continue
      for (const variant of slot.variants) {
        for (const path of variant.nodes) {
          resolveNode(path)?.traverse((object) => owners.set(object, slot.key))
        }
      }
    }
    return owners
  }, [building.exteriorSlots, resolveNode])

  /**
   * Whether a hit is ours to answer for, and which spot it lands on.
   *
   * The pointer is judged on the frontmost thing under it, across the whole
   * scene, so a bought ramp standing in front of the wall keeps its own hover
   * instead of the wall behind taking it away. Anything that is not part of this
   * model is left to whoever drew it.
   */
  const ownerOf = (object: Object3D): { ours: boolean; slotKey: string | null } => {
    let node: Object3D | null = object
    while (node) {
      const slotKey = claimedBy.get(node)
      if (slotKey) return { ours: true, slotKey }
      if (node === preparedScene) return { ours: true, slotKey: null }
      node = node.parent
    }
    return { ours: false, slotKey: null }
  }

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const front = event.intersections[0]?.object
    if (!front) return

    const owner = ownerOf(front)
    if (!owner.ours) return

    const session = useConfiguratorSession.getState()
    // Guarded because this runs on every pointer move over the building, and an
    // unconditional write would re-render the panel at pointer rate.
    if (session.hoveredSlotKey !== owner.slotKey) session.hoverExteriorSlot(owner.slotKey)
  }

  const onPointerOut = () => {
    const session = useConfiguratorSession.getState()
    if (session.hoveredSlotKey !== null) session.hoverExteriorSlot(null)
  }

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const front = event.intersections[0]?.object
    if (!front) return

    const owner = ownerOf(front)
    if (!owner.ours || owner.slotKey === null) return

    event.stopPropagation()
    useConfiguratorSession.getState().openExteriorSlot(owner.slotKey)
  }

  // Nothing claimed means nothing to answer for, and the model stays out of the
  // pointer's way entirely rather than being raycast on every move for nothing.
  const interactive = claimedBy.size > 0

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
    // The roof goes with any storey, even one whose volume was drawn around it:
    // looking at a storey means looking into it.
    controller.setHideBoxes(floor || !showCeiling ? building.roofBlocks : NOTHING_HIDDEN)
  })

  return (
    <primitive
      ref={rootRef}
      object={preparedScene}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerOut={interactive ? onPointerOut : undefined}
      onClick={interactive ? onClick : undefined}
    />
  )
}
