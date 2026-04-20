import type { FC } from 'react'
import { wrap } from '../../utils/globals'
import TaskDetailView from './views/TaskDetailView'
import useTaskDetail, { type useTaskDetailProps } from './hooks/useTaskDetail'

const TaskDetail: FC<useTaskDetailProps> = wrap(TaskDetailView, useTaskDetail)
export { TaskDetail }
export default TaskDetail
