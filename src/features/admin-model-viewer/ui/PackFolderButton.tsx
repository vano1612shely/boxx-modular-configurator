'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { uploadModelFolder, type UploadStage } from '@/shared/lib'

export function PackFolderButton() {
  const input = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [stage, setStage] = useState<UploadStage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = stage !== null

  const send = async (files: FileList) => {
    setStage('uploading')
    setError(null)
    try {
      const model = await uploadModelFolder(files, { onStage: setStage })
      router.push(`/admin/collections/models/${model.id}`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Upload failed.')
      setStage(null)
    }
  }

  return (
    <div style={{ marginBottom: 'var(--base)' }}>
      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {stage === 'converting'
          ? 'Converting the FBX…'
          : stage === 'uploading'
            ? 'Packing…'
            : 'Upload a model folder'}
      </button>

      <input
        ref={input}
        type="file"
        multiple
        // Not in the React DOM typings; both are needed for a directory picker.
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        style={{ display: 'none' }}
        onChange={(event) => {
          const files = event.target.files
          if (files?.length) void send(files)
          event.target.value = ''
        }}
      />

      <p
        style={{
          margin: '6px 0 0',
          fontSize: 12,
          color: error ? 'var(--theme-error-500)' : 'var(--theme-elevation-500)',
        }}
      >
        {error ??
          'Pick the folder holding the model and its textures — a .gltf is packed into one .glb, ' +
            'an .fbx is converted to one. A single .glb can go through New above. FBX materials ' +
            'are approximate; export glTF from your tool where you can.'}
      </p>
    </div>
  )
}

export default PackFolderButton
