import { NodeIO, getBounds, type Node } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const path = process.argv[2]

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await io.read(path)
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]

  const bounds = getBounds(scene)
  console.log('=== SCENE BOUNDS ===')
  console.log('min', bounds.min.map((v) => v.toFixed(2)).join(', '))
  console.log('max', bounds.max.map((v) => v.toFixed(2)).join(', '))

  console.log('\n=== MESH NODES (name | mesh | materials | world bbox) ===')

  const walk = (node: Node) => {
    const mesh = node.getMesh()
    if (mesh) {
      const materials = [
        ...new Set(
          mesh.listPrimitives().map((p) => p.getMaterial()?.getName() ?? '(none)'),
        ),
      ]
      const b = getBounds(node)
      const fmt = (v: number[]) => v.map((n) => n.toFixed(1)).join(',')
      console.log(
        `${node.getName()} | mesh="${mesh.getName()}" | [${materials.join('; ')}] | min(${fmt(b.min)}) max(${fmt(b.max)})`,
      )
    }
    node.listChildren().forEach(walk)
  }

  scene.listChildren().forEach(walk)
}

void main()
