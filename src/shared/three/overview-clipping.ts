import {
  Color,
  DoubleSide,
  Material,
  Mesh,
  Plane,
  Vector3,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three'

import type { ZoneBox } from '@/entities/building'

import { CUT_FACE } from './scene-tokens'

export const MAX_HIDE_BOXES = 24

/**
 * Metres the keep volume is grown by, so a face lying exactly on it survives.
 * A clip test is strict, and a floor slab's top sits precisely on the storey's
 * lower bound.
 */
const KEEP_EDGE = 1e-4

/** Wide enough to keep everything, without leaving float32. */
const UNBOUNDED: ZoneBox = { min: [-1e5, -1e5, -1e5], max: [1e5, 1e5, 1e5] }

type SharedUniforms = {
  uHideCount: { value: number }
  uHideMin: { value: Vector3[] }
  uHideMax: { value: Vector3[] }
  uCapColor: { value: Color }
}

/** Flat fill shown where a hide box exposes the inside of a hollow shell. */
export const CAP_COLOR = CUT_FACE

export type OverviewClippingController = {
  setHideBoxes: (boxes: ZoneBox[]) => void
  /**
   * Keeps only what is inside the box, and hides the rest from the shadow map
   * too. Pass null to keep everything.
   *
   * This is not the hide path inverted. Hiding is a discard in the patched
   * fragment shader, which the shadow pass never runs — it builds its own depth
   * material and copies only a handful of fields across, `clipShadows` and
   * `clippingPlanes` among them. A storey cut with a discard would go on
   * shading the storey below it.
   */
  setKeepBox: (box: ZoneBox | null) => void
  patchMaterial: (material: Material) => void
  readonly materialCount: number
}

const CONTROLLER_KEY = '__overviewClippingController'

export type OverviewClippingOptions = {
  /**
   * Whether a keep volume will ever be asked for.
   *
   * Mounting the planes recompiles every material on the model, and doing it
   * lazily meant paying for that on the frame the visitor picked a storey — a
   * stall in the middle of an interaction, for a scene that is about to be
   * redrawn anyway. Declaring it here spends the same compile inside the one
   * the patch below is already causing, while the loader is still up.
   *
   * Left false for a building with nothing to cut: six clipping planes are six
   * more tests per fragment, on every fragment, for a cut that never comes.
   */
  cuttable?: boolean
}

const FRAGMENT_SNIPPET = /* glsl */ `
  for (int i = 0; i < ${MAX_HIDE_BOXES}; i++) {
    if (i >= uHideCount) break;
    if (all(greaterThanEqual(vHideWorldPos, uHideMin[i])) && all(lessThanEqual(vHideWorldPos, uHideMax[i]))) discard;
  }
`

// Must stay idempotent per root: a second pass would rebind materials to fresh
// uniforms while the caller still holds the first controller.
export function applyOverviewClipping(
  root: Object3D,
  { cuttable = false }: OverviewClippingOptions = {},
): OverviewClippingController {
  const existing = root.userData[CONTROLLER_KEY] as OverviewClippingController | undefined
  if (existing) return existing

  const uniforms: SharedUniforms = {
    uHideCount: { value: 0 },
    uHideMin: { value: Array.from({ length: MAX_HIDE_BOXES }, () => new Vector3()) },
    uHideMax: { value: Array.from({ length: MAX_HIDE_BOXES }, () => new Vector3()) },
    uCapColor: { value: new Color(CAP_COLOR) },
  }

  const patched = new Set<Material>()

  // Inward faces, in min-x, max-x, min-y, max-y, min-z, max-z order. Mutated in
  // place: three reads the plane values every frame, so once the array is on a
  // material, moving the volume costs no recompile — only mounting them does.
  const keepPlanes = [
    new Plane(new Vector3(1, 0, 0), 0),
    new Plane(new Vector3(-1, 0, 0), 0),
    new Plane(new Vector3(0, 1, 0), 0),
    new Plane(new Vector3(0, -1, 0), 0),
    new Plane(new Vector3(0, 0, 1), 0),
    new Plane(new Vector3(0, 0, -1), 0),
  ]
  const writeKeepBox = ({ min, max }: ZoneBox) => {
    keepPlanes[0].constant = -(min[0] - KEEP_EDGE)
    keepPlanes[1].constant = max[0] + KEEP_EDGE
    keepPlanes[2].constant = -(min[1] - KEEP_EDGE)
    keepPlanes[3].constant = max[1] + KEEP_EDGE
    keepPlanes[4].constant = -(min[2] - KEEP_EDGE)
    keepPlanes[5].constant = max[2] + KEEP_EDGE
  }

  // Open before anything mounts them: they are constructed on the origin, which
  // as a keep volume is the eighth of the world with every coordinate positive.
  writeKeepBox(UNBOUNDED)

  let keepMounted = cuttable

  const mountKeepPlanes = (material: Material) => {
    material.clippingPlanes = keepPlanes
    material.clipShadows = true
  }

  const patchMaterial = (material: Material) => {
    if (!material || patched.has(material)) return
    patched.add(material)
    if (keepMounted) mountKeepPlanes(material)

    // Shells are hollow: cut openings show backfaces, painted flat so they read
    // as solid. Transparent materials (glass) stay single-sided.
    const capBackfaces = material.transparent !== true
    if (capBackfaces) material.side = DoubleSide

    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, uniforms)

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHideWorldPos;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvHideWorldPos = (modelMatrix * vec4( position, 1.0 )).xyz;',
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vHideWorldPos;
uniform int uHideCount;
uniform vec3 uHideMin[${MAX_HIDE_BOXES}];
uniform vec3 uHideMax[${MAX_HIDE_BOXES}];
uniform vec3 uCapColor;`,
        )
        .replace('void main() {', `void main() {\n${FRAGMENT_SNIPPET}`)

      if (capBackfaces) {
        // Depth bias keeps painted backfaces from z-fighting the coplanar front layer.
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
  if (!gl_FrontFacing) gl_FragColor = vec4(uCapColor, gl_FragColor.a);
  gl_FragDepth = gl_FragCoord.z + (gl_FrontFacing ? 0.0 : 3e-4);`,
        )
      }
    }

    material.customProgramCacheKey = () =>
      capBackfaces ? 'overview-clipping-v1-cap' : 'overview-clipping-v1'
    material.needsUpdate = true
  }

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) patchMaterial(material)
  })

  const controller: OverviewClippingController = {
    setHideBoxes: (boxes) => {
      const count = Math.min(boxes.length, MAX_HIDE_BOXES)
      for (let i = 0; i < count; i++) {
        uniforms.uHideMin.value[i].set(...boxes[i].min)
        uniforms.uHideMax.value[i].set(...boxes[i].max)
      }
      uniforms.uHideCount.value = count
    },
    setKeepBox: (box) => {
      // Mounting the planes recompiles every material, so a scene that never
      // asks for a keep volume must never pay for one. Once mounted they stay,
      // opened out to everything — switching storeys is then free. A caller
      // that declared itself `cuttable` has already mounted them up front, and
      // never reaches the recompile below at all.
      if (box === null && !keepMounted) return

      writeKeepBox(box ?? UNBOUNDED)

      if (keepMounted) return
      keepMounted = true
      for (const material of patched) {
        mountKeepPlanes(material)
        material.needsUpdate = true
      }
    },
    patchMaterial,
    get materialCount() {
      return patched.size
    },
  }

  root.userData[CONTROLLER_KEY] = controller
  return controller
}
