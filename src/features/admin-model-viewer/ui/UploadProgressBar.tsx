'use client'

import { formatBytes, type UploadProgress } from '@/shared/lib'

export function stageLabel(progress: UploadProgress): string {
  switch (progress.stage) {
    case 'converting':
      return 'Converting the FBX…'
    case 'optimizing':
      return progress.total
        ? `Optimising — texture ${progress.done ?? 0} of ${progress.total}`
        : 'Optimising…'
    case 'uploading':
      return progress.sizeAfter !== undefined && progress.sent !== undefined
        ? `Uploading — ${formatBytes(progress.sent)} of ${formatBytes(progress.sizeAfter)}`
        : 'Uploading…'
    default:
      return 'Saving…'
  }
}

/** What the optimisation saved, once there is something to say about it. */
export function savingLabel(progress: UploadProgress): string | null {
  if (progress.sizeBefore === undefined || progress.sizeAfter === undefined) return null
  if (progress.sizeBefore <= progress.sizeAfter) return null

  const times = progress.sizeBefore / progress.sizeAfter
  return `${formatBytes(progress.sizeBefore)} → ${formatBytes(progress.sizeAfter)} · ${times.toFixed(1)}× less to send`
}

export function UploadProgressBar({ progress }: { progress: UploadProgress }) {
  const ratio = Math.max(0, Math.min(1, progress.ratio ?? 0))
  const percent = Math.round(ratio * 100)
  const saving = savingLabel(progress)

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          marginBottom: 6,
          color: 'var(--theme-elevation-600)',
        }}
      >
        <span>{stageLabel(progress)}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={stageLabel(progress)}
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--theme-elevation-100)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: 999,
            background: 'var(--theme-success-500, #22c55e)',
            transition: 'width 200ms linear',
          }}
        />
      </div>

      {saving && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          {saving}
        </p>
      )}
    </div>
  )
}
