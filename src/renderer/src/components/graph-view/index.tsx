import type { FC } from "react"
import { wrap } from "../../utils/globals"
import { GraphViewView } from "./views/GraphViewView"
import useGraphView, { type useGraphViewProps } from "./hooks/useGraphView"

const GraphView: FC<useGraphViewProps> = wrap(GraphViewView, useGraphView)
export { GraphView }
export default GraphView
