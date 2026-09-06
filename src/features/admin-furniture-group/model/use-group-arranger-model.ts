'use client'

import { useAllFormFields, useForm } from '@payloadcms/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { assetUrl } from '@/shared/lib'

/** One row of the group's `members` array, as the arranger needs it. */
export type ArrangerPiece = {
  /** Index into the array field, which is how the row is addressed on the form. */
  index: number
  name: string
  modelId: number | null
  /** Null until the model's own document has been fetched. */
  modelUrl: string | null
  x: number
  z: number
  rotationYDeg: number
}

function numberAt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function idAt(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number') {
    return (value as { id: number }).id
  }
  return null
}

/**
 * The URL of every model the group names.
 *
 * The form holds relationships, which are ids; the scene needs files. Fetched
 * once per id and kept, so nudging a chair does not re-fetch the chair — and
 * keyed by id rather than by row, so reordering the list costs nothing.
 */
function useModelUrls(ids: ReadonlyArray<number>): Map<number, string> {
  const [urls, setUrls] = useState<Map<number, string>>(new Map())
  const wanted = ids.join(',')

  useEffect(() => {
    const missing = ids.filter((id) => !urls.has(id))
    if (missing.length === 0) return

    let live = true
    const load = async () => {
      const found = new Map<number, string>()

      for (const id of missing) {
        try {
          const response = await fetch(`/api/models/${id}?depth=0`, { credentials: 'include' })
          if (!response.ok) continue
          const doc = (await response.json()) as { url?: string | null; updatedAt?: string | null }
          const url = assetUrl(doc)
          if (url) found.set(id, url)
        } catch {
          // A model that will not load leaves its piece undrawn, which the
          // panel says out loud. Failing the whole arranger would take the
          // other pieces down with it.
        }
      }

      if (live && found.size > 0) {
        setUrls((before) => new Map([...before, ...found]))
      }
    }

    void load()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])

  return urls
}

/**
 * The group's pieces, and the two ways the scene may move one.
 *
 * A bridge to Payload's own form state rather than a store of its own: the row
 * the admin drags is the same row the number fields show and the same row Save
 * sends. Anything else would be a second copy of the arrangement, and the two
 * would disagree the first time somebody typed a coordinate by hand.
 */
export function useGroupArrangerModel() {
  const [fields, dispatch] = useAllFormFields()
  // Writing a value into the field state is not the same as telling the form
  // something changed: Payload keeps `modified` of its own, the Save button is
  // disabled until it turns true, and only the field components set it. Moving
  // a piece here therefore changed the numbers and left Save greyed out, with
  // no way to keep the arrangement but to nudge one of them by hand.
  const { setModified } = useForm()

  const rows = useMemo(() => {
    const count = Array.isArray(fields.members?.rows) ? fields.members.rows.length : 0

    return Array.from({ length: count }, (_, index) => ({
      index,
      name:
        (typeof fields[`members.${index}.name`]?.value === 'string'
          ? (fields[`members.${index}.name`]?.value as string).trim()
          : '') || `Piece ${index + 1}`,
      modelId: idAt(fields[`members.${index}.model`]?.value),
      x: numberAt(fields[`members.${index}.x`]?.value, 0),
      z: numberAt(fields[`members.${index}.z`]?.value, 0),
      rotationYDeg: numberAt(fields[`members.${index}.rotationYDeg`]?.value, 0),
    }))
  }, [fields])

  const ids = useMemo(
    () => [...new Set(rows.flatMap((row) => (row.modelId === null ? [] : [row.modelId])))],
    [rows],
  )
  const urls = useModelUrls(ids)

  const pieces = useMemo<ArrangerPiece[]>(
    () => rows.map((row) => ({ ...row, modelUrl: row.modelId === null ? null : (urls.get(row.modelId) ?? null) })),
    [rows, urls],
  )

  const write = useCallback(
    (index: number, field: 'x' | 'z' | 'rotationYDeg', value: number) => {
      dispatch({ type: 'UPDATE', path: `members.${index}.${field}`, value })
      setModified(true)
    },
    [dispatch, setModified],
  )

  /** Millimetres are noise on a piece of furniture; centimetres are not. */
  const round = (value: number) => Math.round(value * 100) / 100

  return {
    pieces,
    /** True once there is something to arrange, which is what the field renders on. */
    hasPieces: pieces.length > 0,
    /** How many pieces are still waiting for a model to be picked. */
    unresolved: pieces.filter((piece) => piece.modelId === null).length,
    onMove: useCallback(
      (index: number, x: number, z: number) => {
        write(index, 'x', round(x))
        write(index, 'z', round(z))
      },
      [write],
    ),
    onRotate: useCallback(
      (index: number, rotationYDeg: number) => {
        // Kept in [0, 360) so the number field never reads -450.
        write(index, 'rotationYDeg', ((Math.round(rotationYDeg) % 360) + 360) % 360)
      },
      [write],
    ),
  }
}

export type GroupArrangerVm = ReturnType<typeof useGroupArrangerModel>
