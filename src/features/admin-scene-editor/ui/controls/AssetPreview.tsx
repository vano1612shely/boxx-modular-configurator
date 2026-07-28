'use client'

import { useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import { createPortal } from 'react-dom'

import { FitOnce, ModelStage } from '@/shared/three/ModelStage'
import { Show } from '@/shared/ui/control-flow'

import { tone } from '../editor-styles'
import type { AssetCollection, AssetRef } from './asset-library'

/**
 * What the thing you are about to pick actually looks like.
 *
 * A list of filenames is not a choice you can make — "adskMatBasic_Wall_
 * Interior_baseColor.jpeg" and "Floor_Finish_baseColor.jpeg" tell you nothing
 * about which one is the plaster. A texture shows its image; a model has no
 * image to show, so it gets rendered.
 *
 * Rendered through a portal because the sidebar scrolls: an absolutely
 * positioned panel inside it is clipped by the scroll box, which is exactly
 * where a preview needs not to be.
 */

const SIZE = 190

type Props = {
  asset: AssetRef
  collection: AssetCollection
  /** Where the row being hovered is, in viewport coordinates. */
  anchor: DOMRect
}

function ModelBody({ url }: { url: string }) {
  const { scene } = useGLTF(url, false, true)
  const object = useMemo(() => scene.clone(true), [scene])

  return (
    <>
      <FitOnce object={object} />
      <primitive object={object} />
    </>
  )
}

export function AssetPreview({ asset, collection, anchor }: Props) {
  // Only ever rendered in response to a pointer, so there is no server pass to
  // guard against — but `document` still has to exist before we portal into it.
  if (typeof document === 'undefined' || !asset.url) return null

  // Left of the row, since the panel this hangs off lives on the right edge.
  // Clamped so a row near the top or bottom still shows the whole preview.
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
        {/* Tiled, not stretched: a wall finish is judged by its repeat. */}
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
