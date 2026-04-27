import type { FC } from 'react'
import { wrap } from '../../utils/globals'
import TreeViewView from './views/TreeViewView'
import useTreeView, { type useTreeViewProps } from './hooks/useTreeView'

const TreeView: FC<useTreeViewProps> = wrap(TreeViewView, useTreeView)
export { TreeView }
export default TreeView
