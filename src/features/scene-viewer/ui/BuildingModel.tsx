'use client'

import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, type Material, type Mesh, type Object3D } from 'three'

import {
  claimedNodes,
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
    () => new Set(hiddenExteriorNodes(building.exteriorSlots, exteriorSelection)),
    [building.exteriorSlots, exteriorSelection],
  )

  /**
   * Every object whose visibility this component owns.
   *
   * The union rather than the current answer: what is hidden changes with the
   * visitor's pick, and an object that stops being hidden has to be told so.
   */
  const switchable = useMemo(
    () => [...new Set([...hiddenNodePaths, ...claimedNodes(building.exteriorSlots)])],
    [hiddenNodePaths, building.exteriorSlots],
  )

  /**
   * Re-asserted every frame, next to the root's own visibility, rather than
   * applied once from an effect.
   *
   * An effect owns its work only until something destroys it — a re-suspend of
   * the boundary this sits in throws its cleanup, which puts every hidden object
   * back on screen, and the built-in ramp comes back from under a chosen one.
   * State derived from a store is cheaper to re-derive than to defend, and this
   * is a handful of booleans on a handful of objects.
   */
  useFrame(() => {
    for (const path of switchable) {
      const object = resolveNode(path)
      if (!object) continue
      const hidden = hiddenNodePaths.includes(path) || exteriorHidden.has(path)
      if (object.visible === hidden) object.visible = !hidden
    }
  })

  useEffect(() => {
    const paths = switchable
    const resolve = resolveNode
    return () => {
      for (const path of paths) {
        const object = resolve(path)
        if (object) object.visible = true
      }
    }
  }, [switchable, resolveNode])

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

  return (
    <primitive
      ref={rootRef}
      object={preparedScene}
      onClick={interactive ? onClick : undefined}
    />
  )
}
