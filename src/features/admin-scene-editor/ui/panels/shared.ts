import type { MouseEvent as ReactMouseEvent } from 'react'

import type { SceneEditorVm } from '../../model/use-scene-editor-model'
import type { EditorMenuItem } from '../EditorMenu'

export type OpenMenu = (event: ReactMouseEvent, items: EditorMenuItem[]) => void

export type PanelProps = { vm: SceneEditorVm; onOpenMenu: OpenMenu }

export const round3 = (value: number) => Math.round(value * 1000) / 1000
