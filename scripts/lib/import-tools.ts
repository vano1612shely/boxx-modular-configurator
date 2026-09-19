import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { NodeIO, type Document, type Node } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import type { Payload } from 'payload'

/**
 * What the building and furniture importers share: taking nodes out of a
 * client's glb by name, and putting a file into the catalogue.
 */

/**
 * The client's glb files, which the catalogue's models are cut from.
 *
 * Only cutting opens them. An import that finds its files in `catalogue/`
 * never looks here, so a machine with the repository and nothing else can
 * fill a database — which is the case on every machine but the one that
 * did the cutting.
 */
export const SOURCES = process.env.MODEL_SOURCES ?? path.join(os.homedir(), 'Downloads')

/** The catalogue's files as the app stores them, kept in the repository. */
export const CATALOGUE = path.resolve(import.meta.dirname, '../../catalogue')

export async function io() {
  // The decoder for reading what the app stores — every stored model is
  // meshopt-compressed — and the encoder so that a document read that way can
  // be written again.
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
}

/** A client's file, read — or a message saying where the files go. */
export async function readSource(file: string): Promise<Document> {
  if (!existsSync(file)) {
    throw new Error(
      `Cutting needs the client's file ${path.basename(file)}, and there is no ${file}. ` +
        `Put the client's glb files in ${SOURCES}, or point MODEL_SOURCES at the folder ` +
        'that has them. An import that finds its files in catalogue/ needs neither.',
    )
  }
  return (await io()).read(file)
}

/**
 * A name as three.js tidies it on the way in — spaces to underscores, dots
 * and brackets dropped — so a 3ds Max "ground001_Material #324_0" and the
 * analyzer's "ground001_Material_#324_0" are the same name.
 */
export function tidyName(value: string): string {
  return value.replace(/\s/g, '_').replace(/[[\].:/]/g, '')
}

/**
 * The nodes the analyzer listed under this name.
 *
 * Nodes, not node: an exporter splits a big mesh at its vertex limit into
 * sibling nodes of one name, and each of the mobile-office stairs comes as two
 * — the second holding a slice of the treads and the landing. A name means all
 * of them; taking the first alone left that slice in the building and out of
 * the option, and the two fought over the landing once the option stood there.
 */
export function findAllByName(document: Document, name: string): Node[] {
  const wanted = tidyName(name)
  return document
    .getRoot()
    .listNodes()
    .filter((node) => tidyName(node.getName()) === wanted)
}

/**
 * Keeps the named nodes and their subtrees, and empties everything else.
 *
 * A kept node's ancestors stay for its world matrix to survive; a branch left
 * with no mesh and no children goes, deepest first, until nothing empty is
 * left. Throws when a name finds nothing — a silent miss would upload a
 * piece of furniture with its chair missing.
 */
export function keepOnlyNodes(document: Document, names: string[]) {
  const root = document.getRoot()

  const keep = new Set<Node>()
  for (const name of names) {
    const found = findAllByName(document, name)
    if (found.length === 0) throw new Error(`Model has no node "${name}" to cut out.`)
    for (const node of found) node.traverse((child) => keep.add(child))
  }
  for (const node of [...keep]) {
    let parent = node.getParentNode()
    while (parent) {
      keep.add(parent)
      parent = parent.getParentNode()
    }
  }
  for (const node of root.listNodes()) {
    if (!keep.has(node) && node.getMesh()) node.setMesh(null)
  }
  let pruned = true
  while (pruned) {
    pruned = false
    for (const node of root.listNodes()) {
      if (keep.has(node) || node.getMesh() || node.listChildren().length > 0) continue
      node.dispose()
      pruned = true
    }
  }
}

/**
 * Moves everything under one node, so a transform applies to the whole file.
 *
 * Re-centring by editing each node's translation would miss geometry baked
 * into meshes; a parent transform cannot miss anything.
 */
export function wrapScene(document: Document, name: string): Node {
  const root = document.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  const holder = document.createNode(name)
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    holder.addChild(child)
  }
  scene.addChild(holder)
  return holder
}

type UploadFile = { data: Buffer; name: string; mimetype: string }

/** Uploads, or replaces the file on the row already carrying that title. */
async function upsertUpload(
  payload: Payload,
  collection: 'models' | 'textures',
  title: string,
  file: UploadFile,
  /** Tell the upload hooks the file is already what they would make of it. */
  asIs: boolean,
) {
  const found = await payload.find({
    collection,
    where: { title: { equals: title } },
    limit: 1,
    depth: 0,
  })

  const body = { data: file.data, mimetype: file.mimetype, name: file.name, size: file.data.byteLength }
  const context = asIs ? { storeAsIs: true } : {}

  if (found.docs.length > 0) {
    const updated = await payload.update({
      collection,
      id: found.docs[0].id,
      data: { title },
      file: body,
      context,
    })
    payload.logger.info(`${collection}: replaced "${title}" (${updated.filesize} bytes)`)
    return updated
  }

  const created = await payload.create({ collection, data: { title }, file: body, context })
  payload.logger.info(`${collection}: uploaded "${title}" (${created.filesize} bytes)`)
  return created
}

/** What the upload hooks turn every file into, and so what the catalogue holds. */
const STORED = {
  models: { extension: '.glb', mimetype: 'model/gltf-binary' },
  textures: { extension: '.webp', mimetype: 'image/webp' },
} as const

export type CatalogueFile = {
  id: number
  filename: string
  url: string
  /** The copy in `catalogue/`, which is byte for byte the file the app stores. */
  file: string
}

/**
 * Puts one file of the catalogue in place, and says which row holds it.
 *
 * `catalogue/<collection>/<name>` is the file as the app stores it, made the
 * first time it was imported. When it is there it is uploaded exactly as it
 * is, and the upload hooks are told to leave it alone: another machine then
 * stores the same bytes this one did, and every node path written against the
 * file stays true of it — and nobody waits on the optimiser for a file that
 * has been through it. When it is not there, or `recut` says to do it over,
 * `make` cuts it from the client's source, the upload optimises it as it would
 * anything, and what was stored is written into the folder: for the next
 * import, and for git.
 */
export async function catalogueFile(
  payload: Payload,
  collection: 'models' | 'textures',
  title: string,
  name: string,
  make: () => Promise<UploadFile>,
  recut: boolean,
): Promise<CatalogueFile> {
  const stored = STORED[collection]
  const file = path.join(CATALOGUE, collection, `${name}${stored.extension}`)
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

  if (!recut && existsSync(file)) {
    const data = readFileSync(file)
    const doc = await upsertUpload(
      payload,
      collection,
      title,
      { data, name: path.basename(file), mimetype: stored.mimetype },
      true,
    )
    console.log(`${collection}/${path.basename(file)}: from the catalogue (${mb(data.byteLength)} MB)`)
    return { id: doc.id, filename: doc.filename as string, url: doc.url as string, file }
  }

  const doc = await upsertUpload(payload, collection, title, await make(), false)
  mkdirSync(path.dirname(file), { recursive: true })
  copyFileSync(path.resolve(collection, doc.filename as string), file)
  console.log(`${collection}/${path.basename(file)}: cut and stored (${mb(doc.filesize as number)} MB) — commit it`)
  return { id: doc.id, filename: doc.filename as string, url: doc.url as string, file }
}
