import { addDataAndFileToRequest, type Endpoint } from 'payload'

import { packGltfFolder, type FolderFile } from '../lib/pack-gltf'

export const packModel: Endpoint = {
  path: '/pack',
  method: 'post',
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ errors: [{ message: 'Unauthorized.' }] }, { status: 401 })
    }

    await addDataAndFileToRequest(req)

    // The client sends every file under `files` and their paths, in the same order, as `paths`.
    const incoming = req.files?.files
    const uploaded = incoming ? (Array.isArray(incoming) ? incoming : [incoming]) : []
    const paths = (req.data?.paths ?? []) as string[]

    if (!uploaded.length) {
      return Response.json({ errors: [{ message: 'No files were sent.' }] }, { status: 400 })
    }
    if (paths.length !== uploaded.length) {
      return Response.json(
        { errors: [{ message: 'Each file must arrive with the path it had in the folder.' }] },
        { status: 400 },
      )
    }

    const files: FolderFile[] = uploaded.map((file, index) => ({
      path: paths[index],
      data: new Uint8Array(file.data),
    }))

    try {
      const packed = await packGltfFolder(files)
      const title = (req.data?.title as string | undefined) || packed.name.replace(/\.glb$/i, '')

      const doc = await req.payload.create({
        collection: 'models',
        data: { title },
        file: {
          data: packed.data,
          name: packed.name,
          mimetype: 'model/gltf-binary',
          size: packed.data.byteLength,
        },
        req,
      })

      return Response.json({ doc }, { status: 201 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not pack that folder.'
      req.payload.logger.warn(`Folder upload failed: ${message}`)
      return Response.json({ errors: [{ message }] }, { status: 400 })
    }
  },
}
