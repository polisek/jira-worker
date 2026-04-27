import type { FC } from 'react'
import { wrap } from '../../utils/globals'
import BoardViewView from './views/BoardViewView'
import useBoardView, { type useBoardViewProps } from './hooks/useBoardView'

const BoardView: FC<useBoardViewProps> = wrap(BoardViewView, useBoardView)
export { BoardView }
export default BoardView
