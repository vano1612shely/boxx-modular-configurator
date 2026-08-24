'use client'

import { useEffect, useRef } from 'react'

import { useModel } from '@/shared/three/use-model'

import { splitModelPieces, type ModelPiece } from '../../lib/split-model'

type Props = {
  url: string
  onPieces: (url: string, pieces: ModelPiece[]) => void
}

/**
 * Reads a chosen model and reports what is in it, then goes away.
 *
 * Splitting a kitchen into its fittings means measuring them, measuring means
 * loading, and loading a glb happens under a Suspense boundary inside the
 * canvas — so the import is started in the panel, carried out here, and
 * finished back in the model. Nothing is drawn: the parts it reports are, a
 * moment later, by the room itself.
 *
 * Mounted only while an import is outstanding and unmounted by its own report,
 * so the effect below fires once per import even though the callback is rebuilt
 * on every render of the editor.
 */
export function ModelImport({ url, onPieces }: Props) {
  const scene = useModel(url)

  const report = useRef(onPieces)
  useEffect(() => {
    report.current = onPieces
  }, [onPieces])

  /**
   * Once per mount, whatever React does with the effect.
   *
   * An import is an append, not a setting, so running it twice is not harmless:
   * development re-runs effects on mount to prove they can be, and a nine-piece
   * kitchen arrived as eighteen fittings standing in pairs. The component is
   * unmounted by its own report, so a second import remounts it and this starts
   * out false again.
   */
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    // The pieces are measured in world space, and a scene straight from the
    // loader has never had its matrices resolved.
    scene.updateMatrixWorld(true)
    report.current(url, splitModelPieces(scene))
  }, [scene, url])

  return null
}
