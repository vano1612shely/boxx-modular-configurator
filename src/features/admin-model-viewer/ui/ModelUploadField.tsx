'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useRef, useState, type ChangeEvent } from 'react'

import { formatBytes, uploadModelFolder, type UploadProgress } from '@/shared/lib'

import { UploadProgressBar } from './UploadProgressBar'

/**
 * Replaces Payload's own upload area for models.
 *
 * Two reasons it has to own the request rather than hand a file to the form.
 * The file is optimised here before it is sent, which is most of the wait and
 * needs to be visible; and Payload submits through `fetch`, which the spec
 * gives no upload progress events at all — so the built-in Save can only ever
 * be a disabled button with nothing behind it.
 */
export function ModelUploadField() {
  const { id } = useDocumentInfo()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const busy = progress !== null

  const send = async (files: FileList) => {
    setProgress({ stage: 'optimizing', ratio: 0 })
    setError(null)
    setDone(null)

    try {
      const model = await uploadModelFolder(files, { onProgress: setProgress })
      setProgress(null)

      if (id) {
        setDone(`Replaced with ${model.title}.`)
        router.refresh()
        return
      }
      router.push(`/admin/collections/models/${model.id}`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Upload failed.')
      setProgress(null)
    }
  }

  const onPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files?.length) void send(files)
    event.target.value = ''
  }

  return (
    <div style={{ marginBottom: 'var(--base)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn--style-primary btn--size-small"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {id ? 'Replace the model' : 'Choose a model'}
        </button>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          disabled={busy}
          onClick={() => folderInput.current?.click()}
        >
          Choose a folder
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".glb,.gltf,.fbx"
        style={{ display: 'none' }}
        onChange={onPicked}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        // Not in the React DOM typings; both are needed for a directory picker.
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        style={{ display: 'none' }}
        onChange={onPicked}
      />

      {progress && <UploadProgressBar progress={progress} />}

      <p
        style={{
          margin: '8px 0 0',
          fontSize: 12,
          color: error
            ? 'var(--theme-error-500)'
            : done
              ? 'var(--theme-success-600, var(--theme-elevation-600))'
              : 'var(--theme-elevation-500)',
        }}
      >
        {error ??
          done ??
          'The model is optimised here in your browser before it is sent, so a ' +
            `${formatBytes(150 * 1024 * 1024)} source uploads as about ` +
            `${formatBytes(11 * 1024 * 1024)}. Pick a single .glb/.gltf/.fbx, or the folder ` +
            'holding a .gltf and its textures. Saving is not needed — the file is stored as ' +
            'soon as the bar finishes.'}
      </p>
    </div>
  )
}

export default ModelUploadField
