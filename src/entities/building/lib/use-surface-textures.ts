'use client'

import { useTexture } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

import type { ShellSurface, SurfaceStyle } from '../model/types'

/**
 * Loads the room's surface textures.
 *
 * Wrapping drei's `useTexture` rather than calling it directly, for two
 * reasons that both bite late and look like unrelated bugs:
 *
 * - the loader leaves `colorSpace` at its default, while every texture baked
 *   into the glb arrives tagged sRGB, so raw base-color maps render washed out
 *   next to the building they are meant to match;
 * - the loader cache is global and keyed by URL, so every consumer of a URL
 *   gets the SAME Texture instance. Mutating wrap or repeat on it would reach
 *   into other walls and other rooms, in mount order. Each consumer therefore
 *   gets its own clone.
 *
 * Tiling itself is baked into the generated UVs, so `repeat` is never touched
 * here — this only has to make the texture legal to sample.
 */
export function useSurfaceTextures(
  surfaces: Record<ShellSurface, SurfaceStyle>,
): Partial<Record<ShellSurface, Texture>> {
  const entries = useMemo(
    () =>
      (Object.entries(surfaces) as Array<[ShellSurface, SurfaceStyle]>).filter(
        ([, style]) => style.url,
      ),
    [surfaces],
  )

  const urls = entries.map(([, style]) => style.url as string)
  // A stable non-empty input: useTexture must be called unconditionally, and
  // an empty array trips its record/array overloads.
  const loaded = useTexture(urls.length > 0 ? urls : PLACEHOLDER) as Texture[]

  // `loaded` is a fresh array on every render, so the URL list is the real
  // input to memoize on.
  const key = urls.join('|')

  const textures = useMemo(() => {
    if (urls.length === 0) return {}

    const map: Partial<Record<ShellSurface, Texture>> = {}
    entries.forEach(([surface], index) => {
      const source = loaded[index]
      if (!source) return
      const texture = source.clone()
      texture.colorSpace = SRGBColorSpace
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.needsUpdate = true
      map[surface] = texture
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    return () => {
      for (const texture of Object.values(textures)) texture.dispose()
    }
  }, [textures])

  return textures
}

/** 1x1 transparent gif — loaded once, never displayed. */
const PLACEHOLDER = [
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
]

/**
 * Warms the loader cache for every room at scene mount, so stepping into a
 * room does not suspend on a network round trip.
 */
export function preloadRoomTextures(surfaceSets: Array<Record<ShellSurface, SurfaceStyle>>) {
  for (const surfaces of surfaceSets) {
    for (const style of Object.values(surfaces)) {
      if (style.url) useTexture.preload(style.url)
    }
  }
}
