import type { FC } from 'react'
import { wrap } from '../../utils/globals'
import RoadmapViewView from './views/RoadmapViewView'
import useRoadmapView, { type useRoadmapViewProps } from './hooks/useRoadmapView'

const RoadmapView: FC<useRoadmapViewProps> = wrap(RoadmapViewView, useRoadmapView)
export { RoadmapView }
export default RoadmapView
