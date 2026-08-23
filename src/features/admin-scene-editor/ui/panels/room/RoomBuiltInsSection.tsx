'use client'

import type { SceneEditorVm } from '../../../model/use-scene-editor-model'
import { s } from '../../editor-styles'
import { PartList } from './PartList'

/**
 * The room as it is delivered: a counter, a sink, whatever came with the box.
 *
 * Drawn for every visitor, priced at nothing, on no line of any quote. The
 * reason the list has to exist at all is that entering a room hides the
 * building model wholesale — so anything of the building that should still be
 * seen from inside has to be named here to be copied in.
 */
export function RoomBuiltInsSection({ vm }: { vm: SceneEditorVm }) {
  return (
    <div style={s.tabBody}>
      <p style={s.hint}>
        What this room comes with. Going into a room hides the building model, so anything of the
        building that should still be seen from inside belongs here. Nothing here is sold — it is
        part of the room.
      </p>

      <div style={{ marginTop: 10 }}>
        <PartList vm={vm} />
      </div>
    </div>
  )
}
