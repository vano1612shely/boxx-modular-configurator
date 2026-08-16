'use client'

import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import type { Group } from 'three'

import { stripNonVisual } from './strip-non-visual'

/**
 * A model from the library, with nothing in it that lights or films the scene.
 *
 * Every model in this app arrives through the same upload, and an FBX brings
 * the artist's lamps and camera along with the furniture — see stripNonVisual
 * for what that costs. Cleaning happens here rather than at each of the dozen
 * places a model is drawn, so a call site added later cannot forget.
 *
 * The scene is cleaned in place. drei hands out one object per URL and every
 * consumer clones it, so doing this once is both correct and the cheapest
 * moment for it — and running it again on an already-clean model finds nothing.
 *
 * Also covers the models already in the library, which were converted before
 * anything stripped them and would otherwise need re-uploading.
 */
export function useModel(url: string): Group {
  const { scene } = useGLTF(url, false, true)

  // Memoised on the object rather than run in the body: the strip mutates it,
  // and doing that on every render of every placement is work for nothing.
  return useMemo(() => {
    stripNonVisual(scene)
    return scene
  }, [scene])
}
