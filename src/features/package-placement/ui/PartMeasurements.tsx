'use client'

import { Suspense, useEffect } from 'react'

import type { RoomPart } from '@/entities/building'
import { partGeometryKey } from '@/entities/building'
import { measureShape } from '@/entities/furniture-package'
import { centreOnFootprint } from '@/shared/three/centre-model'
import { createNodeResolver } from '@/shared/three/node-path'
import { partObject } from '@/shared/three/part-object'
import { useModel } from '@/shared/three/use-model'
import { For } from '@/shared/ui/control-flow'

import { hasPartObstacle, setPartObstacle } from '../lib/part-obstacles'

type Props = {
  parts: ReadonlyArray<RoomPart>
  buildingModelUrl: string
}

/**
 * Reads one fitting and writes down what it fills. Draws nothing.
 *
 * Separate from `RoomParts`, which draws them, for two reasons. Layering is the
 * first: what a model fills is a question the placement feature asks, and the
 * building entity that draws a room has no business knowing that a chair is
 * about to be dragged at it. The second is that the answer outlives the
 * drawing — a kitchen is measured once and stays measured while the visitor
 * walks in and out of the room it stands in.
 *
 * Loading the model a second time costs a clone: drei hands out one parse per
 * URL, and these are the same URLs the room is already drawing.
 */
function MeasureModel({
  part,
  buildingModelUrl,
}: {
  part: RoomPart
  buildingModelUrl: string
}) {
  const scene = useModel(part.modelUrl ?? '')
  const key = partGeometryKey(part, buildingModelUrl)

  useEffect(() => {
    if (hasPartObstacle(key)) return

    // One piece of the file when the part names one, so a microwave is measured
    // as a microwave rather than as the kitchen it was imported with.
    const taken = partObject(scene, part.nodePath)
    if (!taken) return

    const { object: clone, bounds: measured } = taken
    clone.updateMatrixWorld(true)

    const footprint = {
      width: measured.width * part.scale,
      depth: measured.depth * part.scale,
    }

    setPartObstacle(key, {
      x: part.position[0],
      z: part.position[2],
      rotationYDeg: part.yawDeg,
      footprint,
      // The grid is measured in the model's own metres, so a scaled part cannot
      // use it and falls back to its rectangle. Scaling a fitting is rare, and
      // the rectangle is the rule everything followed before shapes existed.
      shape: part.scale === 1 ? measureShape(clone, footprint) : null,
    })
  }, [scene, key, part.nodePath, part.position, part.scale, part.yawDeg])

  return null
}

/**
 * The same, for a piece of the building's own model.
 *
 * A node carries its own pose, so where it stands is measured rather than
 * authored: the box is taken before the object is centred, and its middle is
 * where the thing is. No facing — a box measured in world space is already
 * square to the world, whichever way the node itself is turned.
 */
function MeasureNode({ part, buildingModelUrl }: { part: RoomPart; buildingModelUrl: string }) {
  const scene = useModel(buildingModelUrl)
  const key = partGeometryKey(part, buildingModelUrl)

  useEffect(() => {
    if (hasPartObstacle(key) || !part.nodePath) return

    const source = createNodeResolver(scene)(part.nodePath)
    if (!source) return

    scene.updateMatrixWorld(true)
    const clone = source.clone(true)
    clone.matrix.copy(source.matrixWorld)
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale)

    const measured = centreOnFootprint(clone)
    clone.updateMatrixWorld(true)

    const footprint = { width: measured.width, depth: measured.depth }

    setPartObstacle(key, {
      x: measured.centreX,
      z: measured.centreZ,
      rotationYDeg: 0,
      footprint,
      shape: measureShape(clone, footprint),
    })
  }, [scene, key, part.nodePath, buildingModelUrl])

  return null
}

/**
 * Everything standing still in the room, measured so furniture can be stopped by it.
 *
 * Mounted for the room the visitor is in, over its built-ins and whatever
 * arrangement is standing. Each part suspends on its own and draws nothing, so
 * nothing on screen waits for any of it.
 */
export function PartMeasurements({ parts, buildingModelUrl }: Props) {
  return (
    <For each={parts} getKey={(part) => partGeometryKey(part, buildingModelUrl)}>
      {(part) => (
        <Suspense fallback={null}>
          {part.source === 'node' ? (
            <MeasureNode part={part} buildingModelUrl={buildingModelUrl} />
          ) : (
            <MeasureModel part={part} buildingModelUrl={buildingModelUrl} />
          )}
        </Suspense>
      )}
    </For>
  )
}
