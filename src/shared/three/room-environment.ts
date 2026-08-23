import { PMREMGenerator, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * The soft indoor light every scene here is lit with — one map per renderer,
 * built on demand and never disposed.
 *
 * Both scenes used to build their own and give it back in an effect cleanup,
 * and that is what turned the building black after a visit to a room. React
 * runs a cleanup whenever it wants to re-run the effect — an unmount, a
 * remount, a strict-mode double invoke — and it does not re-run the memo that
 * built the thing, so the scene was left holding a render target whose GPU
 * texture had already been deleted.
 *
 * Nothing about the scene reads wrong afterwards, which is what made it so hard
 * to find: every light, material and texture is byte for byte what it was, and
 * `scene.environment` still points at a texture. The only symptom is that
 * anything metal stops reflecting and goes black, while painted surfaces, which
 * barely use the map, look untouched.
 *
 * A cache on the renderer cannot reach that state, because nothing disposes it.
 * It costs one 768×1024 half-float map per canvas, freed with the context.
 */
const cache = new WeakMap<WebGLRenderer, WebGLRenderTarget>()

export function roomEnvironment(gl: WebGLRenderer): Texture {
  const cached = cache.get(gl)
  if (cached) return cached.texture

  const generator = new PMREMGenerator(gl)
  const room = new RoomEnvironment()
  const target = generator.fromScene(room, 0.04)
  room.dispose()
  generator.dispose()

  cache.set(gl, target)
  return target.texture
}
