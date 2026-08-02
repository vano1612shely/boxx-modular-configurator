'use client'

import { useFormFields } from '@payloadcms/ui'

import { formatBytes, formatCount, savingPercent } from '@/shared/lib'

function useNumber(path: string): number | null {
  const value = useFormFields(([fields]) => fields[path]?.value)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function useTuple(path: string): number[] | null {
  const value = useFormFields(([fields]) => fields[path]?.value)
  return Array.isArray(value) && value.every((n) => typeof n === 'number') ? value : null
}

export function ModelMetaField() {
  const before = useNumber('meta.sizeBefore')
  const after = useNumber('meta.sizeAfter')
  const triangles = useNumber('meta.triangles')
  const meshes = useNumber('meta.meshes')
  const materials = useNumber('meta.materials')
  const textures = useNumber('meta.textures')
  const min = useTuple('meta.bboxMin')
  const max = useTuple('meta.bboxMax')

  if (after === null) {
    return (
      <p style={{ color: 'var(--theme-elevation-500)', fontSize: 13, marginBottom: 16 }}>
        Not measured. Models are measured and optimized as they are uploaded — this one arrived
        another way, or the optimizer stepped aside.
      </p>
    )
  }

  const saved = savingPercent(before, after)
  const size =
    min && max
      ? [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map((n) => n.toFixed(2)).join(' × ')
      : null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 20 }}>{formatBytes(after)}</strong>
        {before !== null && before !== after && (
          <span style={{ color: 'var(--theme-elevation-500)', fontSize: 13 }}>
            from {formatBytes(before)}
            {saved !== null && ` — ${saved}% smaller`}
          </span>
        )}
      </div>

      <p style={{ color: 'var(--theme-elevation-500)', fontSize: 13, margin: '4px 0 0' }}>
        {[
          triangles !== null && `${formatCount(triangles)} triangles`,
          meshes !== null && `${formatCount(meshes)} meshes`,
          materials !== null && `${formatCount(materials)} materials`,
          textures !== null && `${formatCount(textures)} textures`,
          size && `${size} m`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  )
}

export default ModelMetaField
