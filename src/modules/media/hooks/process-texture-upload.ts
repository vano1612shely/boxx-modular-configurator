import { APIError, type CollectionBeforeOperationHook } from 'payload'
import sharp from 'sharp'

const MAX_SIDE = 2048

const SUPPORTED = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.tif', '.tiff']

export type TextureMeta = {
  width: number
  height: number
  sizeBefore: number
  sizeAfter: number
}

export const processTextureUpload: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update') return args
  if (!req.file?.data) return args

  const name = req.file.name.toLowerCase()
  if (!SUPPORTED.some((ext) => name.endsWith(ext))) {
    throw new APIError(`Unsupported texture format. Use one of: ${SUPPORTED.join(', ')}.`, 400)
  }

  try {
    const sizeBefore = req.file.data.byteLength
    const image = sharp(req.file.data)
    const { width = 0, height = 0 } = await image.metadata()

    const output = await image
      .resize({
        width: width > height ? Math.min(width, MAX_SIDE) : undefined,
        height: height >= width ? Math.min(height, MAX_SIDE) : undefined,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: 88 })
      .toBuffer()

    req.file.data = output
    req.file.size = output.byteLength
    req.file.name = req.file.name.replace(/\.[^.]+$/, '.webp')
    req.file.mimetype = 'image/webp'

    req.context.textureMeta = {
      width: Math.min(width, MAX_SIDE),
      height: Math.min(height, MAX_SIDE),
      sizeBefore,
      sizeAfter: output.byteLength,
    } satisfies TextureMeta
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new APIError(`Texture processing failed: ${message}`, 400)
  }

  return args
}
