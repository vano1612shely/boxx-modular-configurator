'use client'

import { useFormFields } from '@payloadcms/ui'
import { CameraControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { FitOnce, ModelStage } from '@/shared/three/ModelStage'

/**
 * Inline 3D viewer on a document page — orbit to inspect the asset.
 *
 * Works from either end of the relationship. On a model's own page the file is
 * right there in `filename`; on a furniture package or a building it is an id
 * in `model`, which has to be resolved before there is anything to load. Both
 * are worth previewing: a list of names tells you nothing about what you are
 * actually about to place in someone's room.
 */

function Preview({ url }: { url: string }) {
  const { scene } = useGLTF(url, false, true)
  const object = useMemo(() => scene.clone(true), [scene])

  return (
    <>
      <FitOnce object={object} />
      <primitive object={object} />
    </>
  )
}

/** The related model's file, once Payload gives us something to resolve. */
function useRelatedModelUrl(value: unknown): string | null {
  // Keyed by the id it was fetched for, so switching the relationship shows
  // nothing rather than the previous model until the new one arrives.
  const [resolved, setResolved] = useState<{ id: number; url: string | null } | null>(null)

  const id =
    typeof value === 'number'
      ? value
      : value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number'
        ? (value as { id: number }).id
        : null

  useEffect(() => {
    if (id === null) return

    let live = true
    const load = async () => {
      const response = await fetch(`/api/models/${id}?depth=0`, { credentials: 'include' })
      if (!response.ok) return
      const doc = (await response.json()) as { url?: string | null }
      if (live) setResolved({ id, url: doc.url ?? null })
    }

    void load()
    return () => {
      live = false
    }
  }, [id])

  return id !== null && resolved?.id === id ? resolved.url : null
}

export function ModelPreviewField() {
  const [hovered, setHovered] = useState(false)
  const filename = useFormFields(([fields]) => fields.filename?.value as string | undefined)
  const related = useFormFields(([fields]) => fields.model?.value)
  const relatedUrl = useRelatedModelUrl(related)

  const url = filename ? `/api/models/file/${encodeURIComponent(filename)}` : relatedUrl

  if (!url) {
    return (
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: 13 }}>
        Pick a 3D model to see the preview.
      </p>
    )
  }

  return (
    <div
      // Orbiting only while the pointer is actually over the viewer, so
      // scrolling past this field scrolls the page instead of zooming a model.
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        height: 420,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--theme-elevation-150)',
        marginBottom: 16,
      }}
    >
      <Canvas camera={{ position: [4, 3, 5], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#1c1e22']} />
        <ModelStage />
        <Suspense fallback={null}>
          <Preview url={url} />
        </Suspense>
        <CameraControls makeDefault enabled={hovered} minDistance={0.1} maxDistance={400} />
      </Canvas>
    </div>
  )
}

export default ModelPreviewField
