'use client'

import { useMemo } from 'react'
import { Box3, Vector3, type Group } from 'three'

import { useModel } from '@/shared/three/use-model'

import { setMeasuredFootprint } from '../lib/measured-footprints'
import type { FurniturePackageEntity } from '../model/types'

export type CentredPackage = {
  /** A clone of the package, centred on its footprint with its base at y = 0. */
  object: Group
  /** How tall it is, in metres. */
  height: number
}

/**
 * A furniture package placed the way every consumer agrees it is placed.
 *
 * Here rather than inside whoever is drawing it, because "where the middle of
 * this thing is" is a fact about the package: the drag clamps, the collision
 * tests and the saved coordinates all assume a footprint centred on the
 * placement point, and a second copy of this recentring would be the one that
 * drifted — furniture on a saved order standing half a table off from where the
 * customer left it. The measured footprint is published for the same reason: it
 * is what corrects the admin's estimate, and it can only be known once the glb
 * is here.
 */
export function useCentredPackage(pkg: FurniturePackageEntity): CentredPackage {
  const scene = useModel(pkg.modelUrl)

  return useMemo(() => {
    const clone = scene.clone(true)

    const bounds = new Box3().setFromObject(clone)
    const size = bounds.getSize(new Vector3())
    const centre = bounds.getCenter(new Vector3())

    // Y is left alone: the model stands on the floor, so its base sits there.
    clone.position.x -= centre.x
    clone.position.z -= centre.z

    setMeasuredFootprint(pkg.id, { width: size.x, depth: size.z })

    return { object: clone, height: size.y }
  }, [scene, pkg.id])
}

/** The package and nothing else — no handles, no outline, no pointer surface. */
export function PackageModel({ pkg }: { pkg: FurniturePackageEntity }) {
  const { object } = useCentredPackage(pkg)

  return <primitive object={object} />
}
