import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"

interface LinkEdgeData {
    linkType: string
    linkId: string
    isBlocking: boolean
    onDelete?: (edgeId: string, linkId: string) => void
    [key: string]: unknown
}

export function LinkEdge({
    id,
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data, style, markerEnd, label, animated,
}: EdgeProps) {
    const d = data as LinkEdgeData
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div
                    className="nodrag nopan flex items-center gap-1"
                    style={{
                        position: "absolute",
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: "all",
                    }}
                >
                    <span
                        className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                            background: "var(--c-bg-card)",
                            border: `1px solid ${d.isBlocking ? "#f85149" : "#58a6ff"}`,
                            color: d.isBlocking ? "#f85149" : "#58a6ff",
                        }}
                    >
                        {label && <span>{String(label)}</span>}
                        <button
                            className="w-3 h-3 rounded-full flex items-center justify-center text-[9px] font-bold leading-none hover:bg-red-500 hover:text-white transition-colors"
                            style={{ color: "inherit", lineHeight: 1 }}
                            title="Odstranit vazbu"
                            onClick={() => d.onDelete?.(id, d.linkId)}
                        >
                            ×
                        </button>
                    </span>
                </div>
            </EdgeLabelRenderer>
        </>
    )
}
