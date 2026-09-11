import { FrontSide, MeshBasicMaterial, MeshStandardMaterial, type Material, type Texture } from 'three'

import type { ShellSurface } from '../model/types'
import { SHELL_SURFACES, WALL_SIDES } from '../model/types'
import type { ShellGroup } from './room-shell'

const SURFACE_COLORS: Record<ShellSurface, string> = {
  wallOuter: '#d9d5cd',
  wallInner: '#f2f0ec',
  wallEdge: '#ffffff',
  floor: '#c9b79c',
  ceiling: '#f6f5f3',
  // Shown only when a room has no door/window glb. Both used to be wrong about
  // the product: stained timber where BOXX fits white doors, and a blue-grey
  // pane that is the only cool value anywhere in the brand.
  door: '#efece7',
  window: '#dfe3e2',
}

/** Surfaces drawn flat white, with no lighting: the cut edge of a wall. */
const FRAME_SURFACES = new Set<ShellSurface>(['wallEdge', 'wallOuter'])

export const SHELL_GROUPS: readonly ShellGroup[] = [...WALL_SIDES, 'floor', 'ceiling']

/**
 * The materials a generated room is drawn with, kept for the life of the page.
 *
 * Made once per wall side, surface and texture, and never disposed. A room
 * used to make its own set on the way in and dispose it on the way out, and
 * three's shader cache is counted by reference: the last material to let go
 * of a program deletes it, so the next room compiled the same shaders again —
 * three or four hundred milliseconds of freeze, on every entry, on the frame
 * the camera had just started to move. A dozen materials for a product line
 * are nothing to hold on to, and holding them is what keeps the programs.
 *
 * Per wall side, not just per surface, because the side is what a fade
 * touches: opacity lives on the material, and one material shared across two
 * walls would fade both when the camera looked through one.
 *
 * Transparent from the start rather than switched during a fade. three bakes
 * `transparent` into the shader, so a wall that went transparent to fade and
 * opaque to settle was two programs, and the switch between them was another
 * compile in the middle of the camera flight. At opacity 1 a transparent
 * material draws exactly as an opaque one; it is only sorted after them.
 */
const held = new Map<string, Material>()

export function shellMaterial(
  group: ShellGroup,
  surface: ShellSurface,
  texture: Texture | null,
): Material {
  const key = `${group}|${surface}|${texture ? texture.uuid : ''}`
  const kept = held.get(key)
  if (kept) return kept

  const material = FRAME_SURFACES.has(surface)
    ? new MeshBasicMaterial({
        color: '#ffffff',
        toneMapped: false,
        side: FrontSide,
        transparent: true,
      })
    : new MeshStandardMaterial({
        map: texture,
        color: texture ? '#ffffff' : SURFACE_COLORS[surface],
        roughness: 0.85,
        metalness: 0,
        side: FrontSide,
        transparent: true,
      })
  material.name = `shell:${group}:${surface}`

  held.set(key, material)
  return material
}

/**
 * Every material a room with these textures could ask for.
 *
 * For the warm-up: compiled once against the scene's lights, these hold their
 * programs for as long as the page lives, so the room itself compiles nothing.
 */
export function shellMaterialsFor(
  textures: Partial<Record<ShellSurface, Texture>>,
): Material[] {
  const materials: Material[] = []
  for (const group of SHELL_GROUPS) {
    for (const surface of SHELL_SURFACES) {
      materials.push(shellMaterial(group, surface, textures[surface] ?? null))
    }
  }
  return materials
}
