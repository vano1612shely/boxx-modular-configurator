import { sameBlockRef, type BlockRef, type SceneEditorVm } from '../model/use-scene-editor-model'

import type { EditorMenuItem } from './EditorMenu'

export function nodeMenuItems(
  vm: SceneEditorVm,
  path: string,
  opts: { includeSelect?: boolean } = {},
): EditorMenuItem[] {
  const items: EditorMenuItem[] = []
  const node = vm.modelNodes.find((n) => n.path === path)
  const name = node?.name ?? 'object'
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

  return items
}

/**
 * What can be done to the fittings under the pointer.
 *
 * Built from the keys the click settled on rather than from the selection,
 * because selecting is a state change and this list is built in the same tick:
 * reading `vm.selectedPartKeys` here would describe the selection as it was
 * before the right-click landed on something outside it.
 *
 * `openProps` is the viewport's way in to the numbers — the panel already has
 * them below the list, so it passes null and the item is left out.
 */
export function partMenuItems(
  vm: SceneEditorVm,
  keys: ReadonlyArray<string>,
  openProps: (() => void) | null,
): EditorMenuItem[] {
  const items: EditorMenuItem[] = []
  if (keys.length === 0) return items

  const grouped = vm.scopedParts.some(
    (part) => keys.includes(part.key) && part.groupKey !== null,
  )
  const arrangeable = vm.scopedParts.some(
    (part) => keys.includes(part.key) && part.source === 'model',
  )

  if (openProps && arrangeable) {
    items.push({ label: '⤢ Position and size…', onClick: openProps })
  }

  if (keys.length > 1) {
    items.push({
      label: `⛓ Merge ${keys.length} into one object`,
      onClick: () => vm.onGroupSelection(),
    })
  }

  if (grouped) {
    items.push({ label: '⛓ Split back into pieces', onClick: () => vm.onUngroupSelection() })
  }

  items.push({
    label: keys.length > 1 ? `Remove ${keys.length} fittings` : 'Remove fitting',
    danger: true,
    onClick: () => vm.onRemoveParts(keys),
  })

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
