'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { Mesh, Texture } from 'three'

/**
 * Textures uploaded per frame.
 *
 * One at a time would hold the loader up for as many frames as the model has
 * maps; all at once is a single block long enough for the phone to drop the
 * frame the veil is fading on. Two is a compromise with nothing clever behind
 * it — a 2048² map is roughly 22 MB with its mips, so this is the granularity
 * at which the main thread comes back up for air.
 */
const UPLOADS_PER_FRAME = 2

/** Longest the veil may be held waiting on a pass that may never get a frame. */
const DEADLINE_MS = 8000

type Props = {
  /** False until there is something in the scene worth warming. */
  armed: boolean
  /**
   * Called when the scene will draw without stalling — or when waiting any
   * longer for that is worse than not waiting. Stable across renders, or the
   * deadline below restarts on every one of them and never fires.
   */
  onWarm: () => void
}

/** Every texture hanging off a material, whatever slot it happens to sit in. */
function texturesIn(mesh: Mesh, into: Set<Texture>): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

  for (const material of materials) {
    if (!material) continue
    // By shape, not by name: a glb brings whichever of two dozen map slots the
    // exporter felt like writing, and a list of them here would go stale the
    // first time one of them mattered.
    for (const value of Object.values(material as unknown as Record<string, unknown>)) {
      const texture = value as Texture | null
      if (texture?.isTexture) into.add(texture)
    }
  }
}

/**
 * Pays the GPU's one-off costs while the loader is still covering them.
 *
 * A material's program is linked, and a texture is uploaded, the first time
 * something is actually drawn with it — not when the glb finishes downloading.
 * So the frame the veil lifted on was the frame that compiled forty-odd shaders
 * and pushed a few hundred megabytes of texture across, and it is the same
 * story again on the first storey picked and the first room entered. That is
 * the shape of the complaint: it hitches, and the hitches stop coming back once
 * the visitor has been everywhere once.
 *
 * Doing it here does not make the work smaller. It moves it under the veil,
 * where a spinner is already saying to wait, and out of the moment the visitor
 * has just pressed something.
 *
 * Mount it keyed on the model, so a different building gets a fresh pass. The
 * progress it keeps is in refs, and a remount is what resets them.
 */
export function SceneWarmup({ armed, onWarm }: Props) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const pending = useRef<Texture[] | null>(null)
  const done = useRef(false)

  // Frames are what drives the pass below, and there is no promise of any: a
  // backgrounded tab gets no rAF at all, and the veil this holds up would then
  // stay up for as long as the visitor was looking at something else. Giving up
  // costs a stutter, which is the thing being traded away here — holding on
  // costs the scene, which is not.
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(onWarm, DEADLINE_MS)
    return () => clearTimeout(timer)
  }, [armed, onWarm])

  useFrame(() => {
    if (!armed || done.current) return

    if (pending.current === null) {
      const found = new Set<Texture>()
      scene.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.isMesh && mesh.material) texturesIn(mesh, found)
      })
      pending.current = [...found]
    }

    const batch = pending.current.splice(0, UPLOADS_PER_FRAME)
    for (const texture of batch) gl.initTexture(texture)
    if (pending.current.length > 0) return

    // Last, and only once the maps are up: linking a program is what tells the
    // driver which samplers it binds, and it is the pair that the first draw
    // would otherwise have had to do together.
    //
    // Every path out of here ends in `onWarm`, the failed ones included. This
    // holds the veil over the scene, and a warm-up that cannot finish must
    // leave the visitor with a scene that stutters — never with a veil that
    // never lifts.
    done.current = true
    try {
      void gl.compileAsync(scene, camera).then(onWarm, onWarm)
    } catch {
      onWarm()
    }
  })

  return null
}
