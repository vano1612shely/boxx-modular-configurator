'use client'

// Before any Canvas: r3f builds a THREE.Clock the moment a store is created.
import '@/shared/three/quiet-deprecations'

import { useFormFields } from '@payloadcms/ui'
import { CameraControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { assetUrl } from '@/shared/lib'
import { FitOnce, ModelStage, previewUrl } from '@/shared/three/ModelStage'

function Preview({ url }: { url: string }) {
  // Separate cache key from the Scene Editor's copy of the same building.
  const { scene } = useGLTF(previewUrl(url), false, true)
  const object = useMemo(() => scene.clone(true), [scene])

  return (
    <>
      <FitOnce object={object} />
      <primitive object={object} />
    </>
  )
}

function useRelatedModelUrl(value: unknown): string | null {
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
      const doc = (await response.json()) as { url?: string | null; updatedAt?: string | null }
      if (live) setResolved({ id, url: assetUrl(doc) })
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
  const updatedAt = useFormFields(([fields]) => fields.updatedAt?.value as string | undefined)
  const related = useFormFields(([fields]) => fields.model?.value)
  const relatedUrl = useRelatedModelUrl(related)

  // Replacing a file keeps its name, so without the stamp the preview kept
  // showing the parse of whatever was uploaded under that name first.
  const url = filename
    ? assetUrl({ url: `/api/models/file/${encodeURIComponent(filename)}`, updatedAt })
    : relatedUrl

  if (!url) {
    return (
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: 13 }}>
        Pick a 3D model to see the preview.
      </p>
    )
  }

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      // Entering fires only on crossing the edge, and there is no crossing when
      // the page opens with the pointer already over the box — which happens
      // whenever the preview loads in under a cursor that has not moved. The
      // model then would not turn until the pointer left and came back. Both of
      // these are ways of learning the pointer is here without having watched it
      // arrive; the guard keeps a move that changes nothing from re-rendering.
      onPointerMove={() => !hovered && setHovered(true)}
      onPointerDown={() => setHovered(true)}
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
