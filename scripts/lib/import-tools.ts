import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { NodeIO, type Document, type Node } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import type { Payload } from 'payload'

/**
 * What the building and furniture importers share: taking nodes out of a
 * client's glb by name, and putting a file into the catalogue.
 */

export const CACHE = path.resolve('.import-cache')

export async function io() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS)
}

/**
 * The nodes the analyzer listed under this name.
 *
 * The analyzer names nodes as three.js does, and three.js tidies a name on
 * the way in — spaces to underscores, dots and brackets dropped — so a 3ds Max
 * "ground001_Material #324_0" is listed as "ground001_Material_#324_0". The
 * same tidying is applied here, so the listed name finds the node.
 *
 * Nodes, not node: an exporter splits a big mesh at its vertex limit into
 * sibling nodes of one name, and each of the mobile-office stairs comes as two
 * — the second holding a slice of the treads and the landing. A name means all
 * of them; taking the first alone left that slice in the building and out of
 * the option, and the two fought over the landing once the option stood there.
 */
export function findAllByName(document: Document, name: string): Node[] {
  const tidy = (value: string) => value.replace(/\s/g, '_').replace(/[[\].:/]/g, '')
  const wanted = tidy(name)
  return document
    .getRoot()
    .listNodes()
    .filter((node) => tidy(node.getName()) === wanted)
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

/** Uploads, or replaces the file on the row already carrying that title. */
export async function upsertUpload(
  payload: Payload,
  collection: 'models' | 'textures',
  title: string,
  file: { data: Buffer; name: string; mimetype: string },
) {
  const found = await payload.find({
    collection,
    where: { title: { equals: title } },
    limit: 1,
    depth: 0,
  })

  const body = { data: file.data, mimetype: file.mimetype, name: file.name, size: file.data.byteLength }

  if (found.docs.length > 0) {
    const updated = await payload.update({
      collection,
      id: found.docs[0].id,
      data: { title },
      file: body,
    })
    payload.logger.info(`${collection}: replaced "${title}" (${updated.filesize} bytes)`)
    return updated
  }

  const created = await payload.create({ collection, data: { title }, file: body })
  payload.logger.info(`${collection}: uploaded "${title}" (${created.filesize} bytes)`)
  return created
}

/**
 * A prepared file, made once and kept under `.import-cache/<slug>/`.
 *
 * `reuse` takes the cached copy when there is one — most of an import's
 * runtime is preparing glbs, and a second run for a changed row need not
 * repeat it.
 */
export function cached(slug: string, name: string, make: () => Promise<Buffer>, reuse: boolean) {
  const file = path.join(CACHE, slug, name)
  mkdirSync(path.dirname(file), { recursive: true })

  return async () => {
    if (reuse) {
      try {
        const data = readFileSync(file)
        console.log(`reusing ${name} (${(data.byteLength / 1024 / 1024).toFixed(1)} MB)`)
        return data
      } catch {
        // Not cached yet — fall through and make it.
      }
    }
    const data = await make()
    writeFileSync(file, data)
    console.log(`prepared ${name} (${(data.byteLength / 1024 / 1024).toFixed(1)} MB)`)
    return data
  }
}
