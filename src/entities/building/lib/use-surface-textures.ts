'use client'

import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

import type { ShellSurface, SurfaceStyle } from '../model/types'

/**
 * Enough anisotropic filtering that a floor still has a surface at the far wall.
 *
 * Without it these textures read as flat grey, and the reason is not the
 * texture. A floor is seen almost edge-on, so one screen pixel covers a long
 * thin strip of it; with no anisotropy the GPU picks a mip level for the
 * *longest* side of that strip and averages a speckled finish down to its own
 * mean colour. Anisotropic sampling walks the strip instead and the speckle
 * survives.
 *
 * Capped rather than taken at the maximum: the gain past 8 is not visible on a
 * room's worth of surfaces, and the cost is paid on every pixel of the largest
 * things in the frame.
 */
const MAX_ANISOTROPY = 8

/**
 * One prepared texture per URL, for as long as the page lives.
 *
 * drei hands out one texture per URL and the app needs it in a different state
 * — repeat wrapping, sRGB, anisotropy — so a copy is made. It used to be made
 * per room and thrown away on the way out, which put the same three 2048²
 * maps back on the GPU, mipmaps and all, on every entry: a quarter of a second
 * with the camera already moving. Three maps for a whole product line are
 * nothing to hold on to.
 */
const prepared = new Map<string, Texture>()

function prepare(source: Texture, url: string, anisotropy: number): Texture {
  const held = prepared.get(url)
  if (held) return held

  const texture = source.clone()
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = anisotropy
  texture.needsUpdate = true
  prepared.set(url, texture)
  return texture
}

// drei's texture cache is keyed by URL and shared, so consumers must clone before
// mutating; the loader also leaves colorSpace default while glb textures are sRGB.
export function useSurfaceTextures(
  surfaces: Record<ShellSurface, SurfaceStyle>,
): Partial<Record<ShellSurface, Texture>> {
  const anisotropy = useThree((state) =>
    Math.min(MAX_ANISOTROPY, state.gl.capabilities.getMaxAnisotropy()),
  )
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

  return useMemo(() => {
    if (urls.length === 0) return {}

    const map: Partial<Record<ShellSurface, Texture>> = {}
    entries.forEach(([surface, style], index) => {
      const source = loaded[index]
      if (!source) return
      map[surface] = prepare(source, style.url as string, anisotropy)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, anisotropy])
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
