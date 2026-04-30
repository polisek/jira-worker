import type { JiraIssue, RoadmapDragPayload } from "../../../types/jira"
import { RoadmapIssueCard } from "./RoadmapIssueCard"

interface Props {
    issues: JiraIssue[]
    userId: string
    sprintId: number | null
    sprintCapacity: number // in hours
    userColorIndex: number
    dragOverPayload: RoadmapDragPayload | null
    dragOverTarget: { userId: string; sprintId: number | null } | null
    onDrop: (targetUserId: string, targetSprintId: number | null) => void
    onDragOver: (userId: string, sprintId: number | null) => void
    onDragLeave: () => void
    onIssueClick: (issue: JiraIssue) => void
    onIssueCardDragStart: (payload: RoadmapDragPayload) => void
}

function getCapacityColor(pct: number, isOver: boolean): string {
    if (isOver) return "#E24B4A"
    if (pct > 80) return "#EF9F27"
    return "#1D9E75"
}

function issueHours(issue: JiraIssue): number {
    const own = issue.fields.timeoriginalestimate ?? 0
    const sub = issue.fields.subtasks?.reduce((s, st) => s + (st.fields.timeoriginalestimate ?? 0), 0) ?? 0
    return (own + sub) / 3600
}

export function RoadmapSprintCell({
    issues,
    userId,
    sprintId,
    sprintCapacity,
    userColorIndex,
    dragOverTarget,
    onDrop,
    onDragOver,
    onDragLeave,
    onIssueClick,
    onIssueCardDragStart,
}: Props) {
    const usedHours = issues.reduce((sum, i) => sum + issueHours(i), 0)
    const pct = sprintCapacity > 0 ? Math.min(Math.round((usedHours / sprintCapacity) * 100), 100) : 0
    const isOver = usedHours > sprintCapacity
    const overHours = usedHours - sprintCapacity

    const isTarget = dragOverTarget?.userId === userId && dragOverTarget?.sprintId === sprintId

    const dropClass = isTarget ? (isOver ? "drop-warn" : "drop-ok") : ""

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        onDragOver(userId, sprintId)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        onDrop(userId, sprintId)
    }

    return (
        <td
            className={`roadmap-cell ${dropClass}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={onDragLeave}
        >
            {/* Capacity bar */}
            <div className="roadmap-capacity-bar">
                <div
                    style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: getCapacityColor(pct, isOver),
                        borderRadius: 2,
                        transition: "width 0.2s",
                    }}
                />
            </div>
            <div className="flex items-center gap-1 text-[10px] mb-1.5" style={{ color: "var(--c-text-4)" }}>
                <span>
                    {usedHours.toFixed(1)} / {sprintCapacity}h ({pct}%)
                </span>
                {isOver && (
                    <span className="px-1 rounded text-white text-[10px]" style={{ background: "#E24B4A" }}>
                        +{overHours.toFixed(1)}h
                    </span>
                )}
            </div>

            {issues.map((issue) => (
                <RoadmapIssueCard
                    key={issue.key}
                    issue={issue}
                    userId={userId}
                    sprintId={sprintId}
                    userColorIndex={userColorIndex}
                    onDragStart={onIssueCardDragStart}
                    onClick={onIssueClick}
                />
            ))}

            {isTarget && (
                <div
                    className="mt-1 text-[9px] text-center py-1 rounded"
                    style={{ color: isOver ? "#EF9F27" : "var(--c-text-4)", border: "1px dashed currentColor" }}
                >
                    {isOver ? "Překročena kapacita" : "Přetáhnout sem"}
                </div>
            )}
        </td>
    )
}
