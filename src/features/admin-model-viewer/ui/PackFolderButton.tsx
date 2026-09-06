'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type ChangeEvent } from 'react'

import { uploadModelFolder, type UploadProgress } from '@/shared/lib'

import { UploadProgressBar } from './UploadProgressBar'

export function PackFolderButton() {
  const folderInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = progress !== null

  const send = async (files: FileList) => {
    setProgress({ stage: 'optimizing', ratio: 0 })
    setError(null)
    try {
      const model = await uploadModelFolder(files, { onProgress: setProgress })
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
          Upload a model
        </button>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          disabled={busy}
          onClick={() => folderInput.current?.click()}
        >
          Upload a model folder
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

      {!progress && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            color: error ? 'var(--theme-error-500)' : 'var(--theme-elevation-500)',
          }}
        >
          {error ??
            'Models are optimised here in the browser before they are sent, so a 150 MB source ' +
              'uploads as about 11 MB. Pick a single .glb/.gltf/.fbx, or the folder holding a ' +
              '.gltf and its textures. FBX materials are approximate; export glTF where you can.'}
        </p>
      )}
    </div>
  )
}

