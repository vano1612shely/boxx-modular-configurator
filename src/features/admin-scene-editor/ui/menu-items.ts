import { sameBlockRef, type BlockRef, type SceneEditorVm } from '../model/use-scene-editor-model'

import type { EditorMenuItem } from './EditorMenu'

/**
 * Context-menu item builders shared by the 3D viewport and the sidebar lists,
 * so the same element offers the same actions no matter where it is clicked.
 */

export function nodeMenuItems(
  vm: SceneEditorVm,
  path: string,
  opts: { includeSelect?: boolean } = {},
): EditorMenuItem[] {
  const items: EditorMenuItem[] = []
  const node = vm.modelNodes.find((n) => n.path === path)
  const name = node?.name ?? 'object'
  // Acting on a node that is part of the multi-selection applies to the whole
  // selection — matching every other editor.
  const inSelection = vm.selectedNodePaths.includes(path)
  const paths =
    inSelection && vm.selectedNodePaths.length > 1 ? [...vm.selectedNodePaths] : [path]
  const many = paths.length > 1
  const suffix = many ? ` (${paths.length} objects)` : ''

  if (opts.includeSelect) {
    items.push({ label: 'Select', onClick: () => vm.onSelectNodeByPath(path) })
  }

  const hidden = vm.hiddenNodePaths.includes(path)
  items.push({
    label: many ? `Hide ${paths.length} objects` : hidden ? `Show “${name}”` : `Hide “${name}”`,
    onClick: () => {
      if (many) for (const p of paths) vm.onHideNode(p)
      else if (hidden) vm.onShowNode(path)
      else vm.onHideNode(path)
    },
  })

  items.push({
    label: `▩ Roof volume from selection${suffix}`,
    onClick: () => vm.onAddBlockFromNodes(paths),
  })

  if (!many) {
    items.push({ label: '⬒ New room from object', onClick: () => vm.onAddRoomFromNode(path) })
  }

  return items
}

export function blockMenuItems(vm: SceneEditorVm, ref: BlockRef): EditorMenuItem[] {
  const items: EditorMenuItem[] = [{ label: 'Select', onClick: () => vm.onSelectBlock(ref) }]

  const inMulti =
    vm.selectedBlocks.length >= 2 && vm.selectedBlocks.some((r) => sameBlockRef(r, ref))

  items.push({
    label: inMulti ? `Delete ${vm.selectedBlocks.length} volumes` : 'Delete volume',
    danger: true,
    onClick: () => {
      if (inMulti) {
        // Descending index order keeps the remaining refs valid while deleting.
        for (const r of [...vm.selectedBlocks].sort((a, b) => b.index - a.index)) {
          vm.onRemoveBlock(r)
        }
      } else {
        vm.onRemoveBlock(ref)
      }
    },
  })

  return items
}
