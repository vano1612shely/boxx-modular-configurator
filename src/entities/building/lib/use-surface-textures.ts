'use client'

import { useTexture } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

import type { ShellSurface, SurfaceStyle } from '../model/types'

// drei's texture cache is keyed by URL and shared, so consumers must clone before
// mutating; the loader also leaves colorSpace default while glb textures are sRGB.
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

  // `loaded` is a fresh array each render, so memoize on the URL list instead.
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

export function preloadRoomTextures(surfaceSets: Array<Record<ShellSurface, SurfaceStyle>>) {
  for (const surfaces of surfaceSets) {
    for (const style of Object.values(surfaces)) {
      if (style.url) useTexture.preload(style.url)
    }
  }
}
