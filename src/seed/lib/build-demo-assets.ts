import {
  Document,
  NodeIO,
  type Buffer as GltfBuffer,
  type Material,
  type Node,
  type Scene,
} from '@gltf-transform/core'

type Vec3 = [number, number, number]

function boxGeometry(w: number, h: number, d: number) {
  const x = w / 2
  const z = d / 2

  const faces: Array<{ normal: Vec3; corners: Vec3[] }> = [
    { normal: [1, 0, 0], corners: [[x, 0, z], [x, 0, -z], [x, h, -z], [x, h, z]] },
    { normal: [-1, 0, 0], corners: [[-x, 0, -z], [-x, 0, z], [-x, h, z], [-x, h, -z]] },
    { normal: [0, 1, 0], corners: [[-x, h, z], [x, h, z], [x, h, -z], [-x, h, -z]] },
    { normal: [0, -1, 0], corners: [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]] },
    { normal: [0, 0, 1], corners: [[-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]] },
    { normal: [0, 0, -1], corners: [[x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z]] },
  ]

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  faces.forEach((face, faceIndex) => {
    const base = faceIndex * 4
    face.corners.forEach((corner) => {
      positions.push(...corner)
      normals.push(...face.normal)
    })
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  }
}

type BoxSpec = {
  name: string
  size: Vec3
  position: Vec3
  material: Material
}

class GlbBuilder {
  readonly document = new Document()
  private readonly buffer: GltfBuffer
  private readonly scene: Scene
  private readonly materials = new Map<string, Material>()

  constructor(sceneName: string) {
    this.buffer = this.document.createBuffer()
    this.scene = this.document.createScene(sceneName)
    this.document.getRoot().setDefaultScene(this.scene)
  }

  material(name: string, hex: number, roughness = 0.9): Material {
    const existing = this.materials.get(name)
    if (existing) return existing

    const r = ((hex >> 16) & 0xff) / 255
    const g = ((hex >> 8) & 0xff) / 255
    const b = (hex & 0xff) / 255

    const material = this.document
      .createMaterial(name)
      .setBaseColorFactor([r, g, b, 1])
      .setMetallicFactor(0)
      .setRoughnessFactor(roughness)

    this.materials.set(name, material)
    return material
  }

  addBox({ name, size, position, material }: BoxSpec, parent?: Node): Node {
    const { positions, normals, indices } = boxGeometry(...size)

    const position_ = this.document
      .createAccessor()
      .setType('VEC3')
      .setArray(positions)
      .setBuffer(this.buffer)
    const normal = this.document
      .createAccessor()
      .setType('VEC3')
      .setArray(normals)
      .setBuffer(this.buffer)
    const index = this.document
      .createAccessor()
      .setType('SCALAR')
      .setArray(indices)
      .setBuffer(this.buffer)

    const primitive = this.document
      .createPrimitive()
      .setAttribute('POSITION', position_)
      .setAttribute('NORMAL', normal)
      .setIndices(index)
      .setMaterial(material)

    const mesh = this.document.createMesh(name).addPrimitive(primitive)
    const node = this.document.createNode(name).setMesh(mesh).setTranslation(position)

    if (parent) {
      parent.addChild(node)
    } else {
      this.scene.addChild(node)
    }

    return node
  }

  addGroup(name: string, position: Vec3 = [0, 0, 0]): Node {
    const node = this.document.createNode(name).setTranslation(position)
    this.scene.addChild(node)
    return node
  }

  async toBuffer(): Promise<globalThis.Buffer> {
    const io = new NodeIO()
    return globalThis.Buffer.from(await io.writeBinary(this.document))
  }
}

/**
 * Demo 2-office building, 12m x 6m footprint, origin at the center of the floor.
 * Mesh naming mirrors what we require from real client assets:
 * exterior walls match the "wall" pattern, the roof matches "roof".
 */
export async function buildDemoBuilding(): Promise<globalThis.Buffer> {
  const b = new GlbBuilder('DemoBuilding')

  const floorMat = b.material('FloorWood', 0xb08d57, 0.8)
  const wallMat = b.material('WallPaint', 0xf2f0ec)
  const roofMat = b.material('RoofSteel', 0x8a8f98, 0.6)

  b.addBox({ name: 'Floor', size: [12.4, 0.1, 6.4], position: [0, -0.1, 0], material: floorMat })
  b.addBox({ name: 'Wall_North', size: [12.4, 3, 0.15], position: [0, 0, -3.08], material: wallMat })
  b.addBox({ name: 'Wall_South', size: [12.4, 3, 0.15], position: [0, 0, 3.08], material: wallMat })
  b.addBox({ name: 'Wall_West', size: [0.15, 3, 6], position: [-6.08, 0, 0], material: wallMat })
  b.addBox({ name: 'Wall_East', size: [0.15, 3, 6], position: [6.08, 0, 0], material: wallMat })
  b.addBox({ name: 'Partition_Center', size: [0.15, 3, 6], position: [0, 0, 0], material: wallMat })
  b.addBox({ name: 'Roof', size: [12.7, 0.15, 6.7], position: [0, 3, 0], material: roofMat })

  return b.toBuffer()
}

/** "Office Core" package: desk + chair + cabinet. Footprint ~2.6m x 2.0m. */
export async function buildOfficeCorePackage(): Promise<globalThis.Buffer> {
  const b = new GlbBuilder('OfficeCore')

  const wood = b.material('DeskWood', 0x6b4f35, 0.7)
  const fabric = b.material('ChairFabric', 0x2f3237)
  const metal = b.material('CabinetMetal', 0xd9d9d9, 0.4)

  const group = b.addGroup('OfficeCore')

  b.addBox({ name: 'Desk', size: [1.6, 0.75, 0.8], position: [-0.3, 0, -0.4], material: wood }, group)
  b.addBox({ name: 'Chair_Seat', size: [0.5, 0.45, 0.5], position: [-0.3, 0, 0.45], material: fabric }, group)
  b.addBox({ name: 'Chair_Back', size: [0.5, 0.55, 0.08], position: [-0.3, 0.45, 0.66], material: fabric }, group)
  b.addBox({ name: 'Cabinet', size: [0.45, 1.1, 0.9], position: [0.85, 0, -0.35], material: metal }, group)

  return b.toBuffer()
}

/** "Conference Core" package: table + 6 chairs. Footprint ~3.4m x 2.9m. */
export async function buildConferenceCorePackage(): Promise<globalThis.Buffer> {
  const b = new GlbBuilder('ConferenceCore')

  const wood = b.material('TableWood', 0x54402d, 0.7)
  const fabric = b.material('ChairFabric', 0x2f3237)

  const group = b.addGroup('ConferenceCore')

  b.addBox({ name: 'Table', size: [2.4, 0.75, 1.1], position: [0, 0, 0], material: wood }, group)

  const chairXs = [-0.8, 0, 0.8]
  chairXs.forEach((x, i) => {
    b.addBox({ name: `Chair_A${i + 1}`, size: [0.5, 0.45, 0.5], position: [x, 0, 0.95], material: fabric }, group)
    b.addBox({ name: `Chair_B${i + 1}`, size: [0.5, 0.45, 0.5], position: [x, 0, -0.95], material: fabric }, group)
  })

  return b.toBuffer()
}
