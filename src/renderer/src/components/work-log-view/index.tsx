import type { FC } from "react"
import { wrap } from "../../utils/globals"
import WorkLogViewView from "./views/WorkLogViewView"
import useWorkLogView, { type useWorkLogViewProps } from "./hooks/useWorkLogView"

const WorkLogView: FC<useWorkLogViewProps> = wrap(WorkLogViewView, useWorkLogView)

export { WorkLogView }
export default WorkLogView
