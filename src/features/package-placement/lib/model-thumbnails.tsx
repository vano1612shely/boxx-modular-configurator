'use client'

// Before any Canvas: r3f builds a THREE.Clock the moment a store is created.
import '@/shared/three/quiet-deprecations'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Box3, MathUtils, Vector3, type PerspectiveCamera } from 'three'

import { ModelStage } from '@/shared/three/ModelStage'
import { useModel } from '@/shared/three/use-model'

const SIZE = 256

/**
 * How long a fresh batch waits before its first shot, in milliseconds.
 *
 * The batch arrives with the room the visitor has just entered, and the first
 * shot is the dear one: a second WebGL context, an environment map, a model
 * parsed and framed, a readback. Taken at once, all of that landed on the
 * frames the camera was flying into the room on. The panel shows a placeholder
 * until the picture arrives, and nobody is choosing furniture mid-flight.
 */
const FIRST_SHOT_DELAY = 1200
const cache = new Map<string, string>()
const listeners = new Set<() => void>()

function publish(url: string, dataUrl: string) {
  cache.set(url, dataUrl)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useModelThumbnail(url: string | null | undefined): string | null {
  const get = useCallback(() => (url ? (cache.get(url) ?? null) : null), [url])
  return useSyncExternalStore(subscribe, get, () => null)
}

// Mount once: one shared WebGL context renders the pending models one at a time.
export function ModelThumbnailFactory({ urls }: { urls: ReadonlyArray<string> }) {
  // Which models have had their turn, by url rather than by position. This
  // component outlives the room it was opened from — that is the whole reason
  // it is mounted outside the panel — so a cursor counting up through one
  // room's list is already past the end of the next room's, and every package
  // after the first room fell back to no thumbnail at all. Recording the
  // attempt, not just the success, is what stops a model that cannot be shot
  // from being tried again on every render.
  const [attempted, setAttempted] = useState<ReadonlySet<string>>(() => new Set())
  const pending = useMemo(
    () => urls.filter((url) => url && !cache.has(url) && !attempted.has(url)),
    [urls, attempted],
  )
  const current = pending[0]

  // A batch is known by its last model: shots are taken from the front, so
  // that one stays put until the batch is done, and the next room's batch
  // ends on a different one. The wait is granted per batch, not per shot.
  const batch = pending.length > 0 ? pending[pending.length - 1] : null
  const [readyFor, setReadyFor] = useState<string | null>(null)
  useEffect(() => {
    if (!batch) return
    const timer = window.setTimeout(() => setReadyFor(batch), FIRST_SHOT_DELAY)
    return () => window.clearTimeout(timer)
  }, [batch])

  if (!current || readyFor !== batch) return null

  return (
    <div
      aria-hidden
      // Off-screen, not display:none — a canvas in a hidden subtree may never
      // be composited, leaving nothing to read back.
      style={{
        position: 'fixed',
        left: -SIZE * 2,
        top: 0,
        width: SIZE,
        height: SIZE,
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      <Canvas
        // Without this the drawing buffer is cleared before it can be read.
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        dpr={2}
        camera={{ fov: 35 }}
        frameloop="always"
      >
        <ModelStage />
        <Suspense fallback={null}>
          <Shot
            key={current}
            url={current}
            onDone={() => setAttempted((seen) => new Set(seen).add(current))}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** Camera offset direction for a three-quarter view. */
const DIRECTION = new Vector3(1, 0.75, 1.35).normalize()

function Shot({ url, onDone }: { url: string; onDone: () => void }) {
  const scene = useModel(url)
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as PerspectiveCamera

  const object = useMemo(() => scene.clone(true), [scene])
  const frames = useRef(0)

  useFrame(() => {
    frames.current += 1

    if (frames.current === 1) {
      const box = new Box3().setFromObject(object)
      if (box.isEmpty()) {
        onDone()
        return
      }
      const centre = box.getCenter(new Vector3())
      const radius = Math.max(box.getSize(new Vector3()).length() / 2, 0.001)
      const distance = radius / Math.sin(MathUtils.degToRad(camera.fov) / 2)

      camera.position.copy(centre).addScaledVector(DIRECTION, distance * 1.12)
      camera.lookAt(centre)
      camera.updateProjectionMatrix()
      return
    }

    // By now the scene has been drawn with the framed camera.
    if (frames.current === 3) {
      try {
        publish(url, gl.domElement.toDataURL('image/webp', 0.85))
      } catch {
        // A tainted or lost context must not fail the catalogue.
      }
      onDone()
    }
  })

  return <primitive object={object} />
}
