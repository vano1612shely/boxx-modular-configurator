import {
  Color,
  DoubleSide,
  Material,
  Mesh,
  Vector3,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three'

import type { ZoneBox } from '@/entities/building'

/**
 * Volume-based hiding for the building overview.
 *
 * The roof/ceiling toggle cannot be done by flipping `object.visible`: in real
 * assets the roof volume is a horizontal slab that slices THROUGH mesh nodes
 * — the same node carries the parapet coping above the cut and 3m of facade
 * trim below it — and node visibility is all-or-nothing. So the overview keeps
 * a fragment-level test, reduced to the one thing it still has to do: discard
 * fragments inside a list of boxes.
 *
 * Everything the old dollhouse needed on top of this (keep-boxes, the room
 * prism, mode switching, backface repainting, object-level hiding) is gone:
 * a focused room is now generated geometry, not a slice of the building.
 */

export const MAX_HIDE_BOXES = 24

type SharedUniforms = {
  uHideCount: { value: number }
  uHideMin: { value: Vector3[] }
  uHideMax: { value: Vector3[] }
  uCapColor: { value: Color }
}

/** Flat fill shown where a hide box exposes the inside of a hollow shell. */
export const CAP_COLOR = '#e8e5df'

export type OverviewClippingController = {
  /** Hide the given volumes; pass an empty list to show everything. */
  setHideBoxes: (boxes: ZoneBox[]) => void
  /** Patches one extra material with the same chunk. Idempotent per material. */
  patchMaterial: (material: Material) => void
  readonly materialCount: number
}

const CONTROLLER_KEY = '__overviewClippingController'

const FRAGMENT_SNIPPET = /* glsl */ `
  for (int i = 0; i < ${MAX_HIDE_BOXES}; i++) {
    if (i >= uHideCount) break;
    if (all(greaterThanEqual(vHideWorldPos, uHideMin[i])) && all(lessThanEqual(vHideWorldPos, uHideMax[i]))) discard;
  }
`

/**
 * Patches every material under `root`. All patched materials share one
 * uniforms object, so an update is a single write regardless of material count.
 *
 * Idempotent per root: repeated calls return the SAME controller. This is
 * load-bearing — React StrictMode double-invokes useMemo factories, and a
 * second patch pass would rebind materials to fresh uniforms while the caller
 * still holds the first controller, silently disconnecting every update.
 */
export function applyOverviewClipping(root: Object3D): OverviewClippingController {
  const existing = root.userData[CONTROLLER_KEY] as OverviewClippingController | undefined
  if (existing) return existing

  const uniforms: SharedUniforms = {
    uHideCount: { value: 0 },
    uHideMin: { value: Array.from({ length: MAX_HIDE_BOXES }, () => new Vector3()) },
    uHideMax: { value: Array.from({ length: MAX_HIDE_BOXES }, () => new Vector3()) },
    uCapColor: { value: new Color(CAP_COLOR) },
  }

  const patched = new Set<Material>()

  const patchMaterial = (material: Material) => {
    if (!material || patched.has(material)) return
    patched.add(material)

    // Building shells are hollow; where a box cuts one open the visible inside
    // is painted flat so the opening reads as solid material, not a void.
    // Transparent materials (glass) keep their look and stay single-sided.
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
        // Push painted backfaces a hair deeper so they can never z-fight their
        // own nearly coplanar textured front layer.
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
    patchMaterial,
    get materialCount() {
      return patched.size
    },
  }

  root.userData[CONTROLLER_KEY] = controller
  return controller
}
