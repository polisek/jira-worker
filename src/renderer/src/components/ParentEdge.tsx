import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"
import { fmtTime } from "../utils/time"

interface ParentEdgeData {
    originalEstimate?: number
    [key: string]: unknown
}

export function ParentEdge({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data, style, markerEnd,
}: EdgeProps) {
    const d = data as ParentEdgeData
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    const label = d?.originalEstimate ? fmtTime(d.originalEstimate) : null

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        className="nodrag nopan"
                        style={{
                            position: "absolute",
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: "none",
                        }}
                    >
                        <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                                background: "var(--c-bg-card)",
                                border: "1px solid #7c3aed",
                                color: "#a78bfa",
                            }}
                        >
                            {label}
                        </span>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    )
}
