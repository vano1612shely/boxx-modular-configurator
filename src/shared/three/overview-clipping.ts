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
  setHideBoxes: (boxes: ZoneBox[]) => void
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

// Must stay idempotent per root: a second pass would rebind materials to fresh
// uniforms while the caller still holds the first controller.
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
    patchMaterial,
    get materialCount() {
      return patched.size
    },
  }

  root.userData[CONTROLLER_KEY] = controller
  return controller
}
