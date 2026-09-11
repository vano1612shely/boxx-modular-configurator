'use client'

import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Camera,
  type Material,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three'

import {
  copyBuildingNode,
  instantiateOpening,
  shellMaterialsFor,
  useSurfaceTextures,
  type Room,
  type ShellSurface,
  type SurfaceStyle,
} from '@/entities/building'
import { useModel } from '@/shared/three/use-model'
import { For } from '@/shared/ui/control-flow'

/**
 * Pays a room's one-off GPU costs before any room is entered.
 *
 * The building's own warm-up covers the building. A room is different
 * geometry with different materials — the generated shell, the door, the
 * window, the zone tints — and the first draw of each of those linked its
 * shader program and pushed its textures across, on the frame the camera had
 * just started its flight in: four hundred milliseconds of nothing moving,
 * with the veil already lifting. Now each of them is compiled and uploaded
 * here, once the building is up and the visitor is looking at it.
 *
 * Two things make the work stick. The materials compiled are the ones the
 * rooms will actually draw with — `shellMaterial` and `openingMaterial` hand
 * out the same instances for the life of the page — and three only deletes a
 * program when the last material holding it is disposed, which these never
 * are. And the lights are the scene's own: the rig keeps the same shape in a
 * room as outside one, so what is compiled here is what a room draws with.
 */
export function RoomWarmup({ rooms, buildingModelUrl }: { rooms: Room[]; buildingModelUrl: string }) {
  const surfaceSets = useMemo(() => distinctSurfaceSets(rooms), [rooms])
  const openingUrls = useMemo(() => distinctOpeningUrls(rooms), [rooms])
  const nodePaths = useMemo(() => distinctBuiltInNodes(rooms), [rooms])

  return (
    <>
      <For each={surfaceSets} getKey={(set) => set.key}>
        {(set) => (
          <Suspense fallback={null}>
            <WarmSurfaces surfaces={set.surfaces} />
          </Suspense>
        )}
      </For>
      <For each={openingUrls} getKey={(url) => url}>
        {(url) => (
          <Suspense fallback={null}>
            <WarmOpening url={url} />
          </Suspense>
        )}
      </For>
      <Suspense fallback={null}>
        <WarmBuiltIns buildingModelUrl={buildingModelUrl} nodePaths={nodePaths} />
      </Suspense>
      <WarmTints />
    </>
  )
}

type SurfaceSet = { key: string; surfaces: Record<ShellSurface, SurfaceStyle> }

function distinctSurfaceSets(rooms: Room[]): SurfaceSet[] {
  const sets = new Map<string, SurfaceSet>()
  for (const room of rooms) {
    const key = Object.entries(room.surfaces)
      .map(([surface, style]) => `${surface}=${style.url ?? ''}`)
      .sort()
      .join('|')
    if (!sets.has(key)) sets.set(key, { key, surfaces: room.surfaces })
  }
  return [...sets.values()]
}

function distinctOpeningUrls(rooms: Room[]): string[] {
  const urls = new Set<string>()
  for (const room of rooms) {
    for (const style of Object.values(room.openingModels)) {
      if (style?.url) urls.add(style.url)
    }
  }
  return [...urls]
}

/** Fittings copied out of the building itself — a kitchen counter, its sink. */
function distinctBuiltInNodes(rooms: Room[]): string[] {
  const paths = new Set<string>()
  for (const room of rooms) {
    for (const part of room.builtIns) {
      if (part.source === 'node' && part.nodePath) paths.add(part.nodePath)
    }
  }
  return [...paths]
}

/** One geometry for every stand-in mesh; what is drawn does not matter, only with what. */
const STAND_IN = new PlaneGeometry(1, 1)

/** Kept referenced for the life of the page: what holds a program is a material that is not disposed. */
const anchors = new Set<Material>()

function compile(
  gl: WebGLRenderer,
  camera: Camera,
  scene: Scene,
  materials: Material[],
  textures: Texture[] = [],
) {
  for (const texture of textures) gl.initTexture(texture)

  const group = new Group()
  for (const material of materials) {
    anchors.add(material)
    group.add(new Mesh(STAND_IN, material))
  }
  // Parallel where the driver allows it; the promise is the driver's business.
  void gl.compileAsync(group, camera, scene).catch(() => undefined)
}

function WarmSurfaces({ surfaces }: { surfaces: Record<ShellSurface, SurfaceStyle> }) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const textures = useSurfaceTextures(surfaces)

  useEffect(() => {
    compile(gl, camera, scene, shellMaterialsFor(textures), Object.values(textures))
  }, [gl, camera, scene, textures])

  return null
}

function WarmOpening({ url }: { url: string }) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const model = useModel(url)

  useEffect(() => {
    // Any one wall's copies: the others share their programs with these.
    const object = instantiateOpening(model, url, 'w1')
    const materials: Material[] = []
    const textures: Texture[] = []
    object.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.push(material)
        for (const value of Object.values(material as unknown as Record<string, unknown>)) {
          const texture = value as Texture | null
          if (texture?.isTexture) textures.push(texture)
        }
      }
    })
    compile(gl, camera, scene, materials, textures)
  }, [gl, camera, scene, model, url])

  return null
}

function WarmBuiltIns({
  buildingModelUrl,
  nodePaths,
}: {
  buildingModelUrl: string
  nodePaths: string[]
}) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const model = useModel(buildingModelUrl)

  useEffect(() => {
    const materials = new Set<Material>()
    for (const path of nodePaths) {
      copyBuildingNode(model, path)?.traverse((node) => {
        const mesh = node as Mesh
        if (!mesh.isMesh) return
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          materials.add(material)
        }
      })
    }
    if (materials.size > 0) compile(gl, camera, scene, [...materials])
  }, [gl, camera, scene, model, nodePaths])

  return null
}

/**
 * The floor tints — a zone's, a room's — are plain transparent colour, made by
 * R3F per mount and disposed with it. One kept here holds their program.
 */
function WarmTints() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    compile(gl, camera, scene, [
      new MeshBasicMaterial({ transparent: true, opacity: 0.2, depthWrite: false }),
    ])
  }, [gl, camera, scene])

  return null
}
