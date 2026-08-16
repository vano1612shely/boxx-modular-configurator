import type { Object3D } from 'three'

/**
 * Takes the lights and cameras out of a model.
 *
 * An FBX carries the whole authoring scene: the lamps the artist lit their
 * turntable with, and the camera they framed it from. Nothing drops them on the
 * way in — FBXLoader builds them, the glTF exporter writes them out as
 * KHR_lights_punctual, and the loader in the configurator hands them back — so
 * every piece of furniture dragged into a room arrived with its own studio
 * lighting.
 *
 * Two symptoms, one cause. The obvious one is that the room gets brighter with
 * each piece added, and stays wrong. The expensive one is that three.js compiles
 * its shaders against the number of lights in the scene: adding one invalidates
 * every material in it, so the frame the furniture lands on is spent rebuilding
 * shader programs for the whole building — the stall the client reported as
 * lag on adding furniture.
 *
 * Returns how many objects were removed, which is worth logging once per model
 * rather than guessing about.
 */
export function stripNonVisual(root: Object3D): number {
  const doomed: Object3D[] = []

  root.traverse((object) => {
    const flags = object as Object3D & { isLight?: boolean; isCamera?: boolean }
    if (flags.isLight || flags.isCamera) doomed.push(object)
  })

  for (const object of doomed) {
    // Lights hold a shadow camera and a render target apiece; a model swapped a
    // few times over a session leaks both unless they are let go of here.
    const disposable = object as Object3D & { dispose?: () => void }
    disposable.dispose?.()
    object.removeFromParent()
  }

  return doomed.length
}
