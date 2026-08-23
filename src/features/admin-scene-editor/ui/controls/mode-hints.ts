import type { EditorMode } from '../../model/use-scene-editor-model'

/**
 * What the tool in hand expects you to do next.
 *
 * Shown on the viewport, beside the thing being done, rather than in the
 * sidebar where it was three panels away from the pointer it was talking to.
 */
export const MODE_HINTS: Partial<Record<EditorMode, string>> = {
  'draw-room':
    'The 2D plan turns on automatically. Click the floor corners as you see them from above. To close the outline, click the orange first point itself — or press Finish.',
  'block-roof':
    'Drag a rectangle over the roof area. The volume is created at roof height — drag its arrows to adjust.',
  'place-opening': 'Click a wall of the generated room to drop the opening there.',
  'cut-zone':
    'The 2D plan turns on automatically. The wall under the pointer lights up: click it to start, click across the floor, then click any wall to finish — that click saves the cut. Nothing is built along the line; it only says where one zone ends.',
  'floor-level':
    'Drag the blue plane to the level people walk on, or click a surface of the model to take its height. Press Done when it sits right.',
  'pick-fitting':
    'The building model is solid while you pick. Click the counter, the sink — whatever this room should keep showing once somebody is standing in it.',
}
