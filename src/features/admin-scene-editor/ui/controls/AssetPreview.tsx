'use client'

// Before any Canvas: r3f builds a THREE.Clock the moment a store is created.
import '@/shared/three/quiet-deprecations'

import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import { createPortal } from 'react-dom'

import { FitOnce, ModelStage, previewUrl } from '@/shared/three/ModelStage'
import { Show } from '@/shared/ui/control-flow'

import { tone } from '../editor-styles'
import type { AssetCollection, AssetRef } from './asset-library'
import { useModel } from '@/shared/three/use-model'

const SIZE = 190

type Props = {
  asset: AssetRef
  collection: AssetCollection
  anchor: DOMRect
}

function ModelBody({ url }: { url: string }) {
  const scene = useModel(previewUrl(url))
  const object = useMemo(() => scene.clone(true), [scene])

  return (
    <>
      <FitOnce object={object} />
      <primitive object={object} />
    </>
  )
}

export function AssetPreview({ asset, collection, anchor }: Props) {
  if (typeof document === 'undefined' || !asset.url) return null

  const top = Math.min(
    Math.max(anchor.top + anchor.height / 2 - SIZE / 2, 8),
    Math.max(window.innerHeight - SIZE - 8, 8),
  )

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left: Math.max(anchor.left - SIZE - 12, 8),
        width: SIZE,
        zIndex: 1000,
        borderRadius: 10,
        overflow: 'hidden',
        background: tone.shell,
        border: `1px solid ${tone.lineStrong}`,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        pointerEvents: 'none',
      }}
    >
      <Show
        when={collection === 'textures'}
        fallback={
          <div style={{ height: SIZE }}>
            <Canvas camera={{ position: [2.4, 1.8, 3], fov: 45 }} dpr={[1, 1.5]}>
              <color attach="background" args={[tone.well]} />
              <ModelStage />
              <Suspense fallback={null}>
                <ModelBody url={asset.url} />
              </Suspense>
            </Canvas>
          </div>
        }
      >
        <div
          style={{
            height: SIZE,
            background: `left top / 50% auto repeat url(${asset.url})`,
          }}
        />
      </Show>
      <div
        style={{
          padding: '6px 8px',
          fontSize: 11,
          color: tone.textMuted,
          borderTop: `1px solid ${tone.line}`,
          wordBreak: 'break-all',
        }}
      >
        {asset.title}
      </div>
    </div>,
    document.body,
  )
}
