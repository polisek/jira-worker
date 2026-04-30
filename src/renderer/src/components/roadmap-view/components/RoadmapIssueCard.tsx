import { useState } from "react"
import { Grip, ChevronDown, ChevronRight } from "lucide-react"
import type { JiraIssue, RoadmapDragPayload } from "../../../types/jira"

export const ROADMAP_USER_COLORS: Array<{ bg: string; text: string; dot: string }> = [
    { bg: "#E6F1FB", text: "#185FA5", dot: "#378ADD" },
    { bg: "#FAEEDA", text: "#854F0B", dot: "#EF9F27" },
    { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
    { bg: "#FAECE7", text: "#993C1D", dot: "#D85A30" },
    { bg: "#E1F5EE", text: "#0F6E56", dot: "#1D9E75" },
    { bg: "#FBEAF0", text: "#993556", dot: "#D4537E" },
    { bg: "#EAF3DE", text: "#3B6D11", dot: "#639922" },
    { bg: "#F1EFE8", text: "#444441", dot: "#888780" },
]

function formatSeconds(seconds: number | null | undefined): string {
    if (!seconds) return "—"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
    return m > 0 ? `${m}m` : "< 1m"
}

interface Props {
    issue: JiraIssue
    userId: string
    sprintId: number | null
    userColorIndex: number
    onDragStart: (payload: RoadmapDragPayload) => void
    onClick: (issue: JiraIssue) => void
}

function statusStyle(catKey: string, fallbackText: string): { bg: string; color: string } {
    if (catKey === "done") return { bg: "rgba(34,197,94,0.18)", color: "#16a34a" }
    if (catKey === "indeterminate") return { bg: "rgba(59,130,246,0.15)", color: "#2563eb" }
    return { bg: "rgba(0,0,0,0.08)", color: fallbackText }
}

export function RoadmapIssueCard({ issue, userId, sprintId, userColorIndex, onDragStart, onClick }: Props) {
    const color = ROADMAP_USER_COLORS[userColorIndex % ROADMAP_USER_COLORS.length]
    const [expanded, setExpanded] = useState(false)

    const ownEstimate = issue.fields.timeoriginalestimate
    const subtaskCount = issue.fields.subtasks?.length ?? 0
    const subtaskSeconds = issue.fields.subtasks?.reduce((sum, s) => sum + (s.fields.timeoriginalestimate ?? 0), 0) ?? 0

    const statusCatKey = issue.fields.status?.statusCategory?.key ?? ""
    const { bg: statusBg, color: statusTextColor } = statusStyle(statusCatKey, color.text)

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move"
        onDragStart({ issueKey: issue.key, fromUserId: userId, fromSprintId: sprintId })
    }

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onClick={() => onClick(issue)}
            className="roadmap-issue-card group"
            style={{ background: color.bg, color: color.text }}
        >
            {/* Row 1: Grip + issuetype icon + key: summary … status */}
            <div className="flex items-start gap-1 mb-0.5">
                <Grip
                    className="w-2.5 h-2.5 mt-0.5 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"
                    style={{ color: color.text }}
                />
                {issue.fields.issuetype?.iconUrl && (
                    <img src={issue.fields.issuetype.iconUrl} alt="" className="w-3 h-3 mt-0.5 shrink-0" />
                )}
                <span className="shrink-0 opacity-55 text-[11px] whitespace-nowrap">{issue.key}:</span>
                <span className="flex-1 min-w-0 text-[12px] font-medium leading-tight line-clamp-2">
                    {issue.fields.summary}
                </span>
                <span
                    className="shrink-0 text-[12px] px-1 py-px rounded whitespace-nowrap ml-0.5 leading-tight"
                    style={{ background: statusBg, color: statusTextColor }}
                >
                    {issue.fields.status?.name}
                </span>
            </div>

            {/* Row 2: Time estimates + subtask toggle */}
            <div className="flex items-center justify-end gap-1.5 text-[11px] opacity-65 mt-0.5 flex-wrap">
                <span title="Vlastní odhad">{formatSeconds(ownEstimate)}</span>
                {subtaskCount > 0 && (
                    <>
                        <span className="opacity-40">|</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
                            className="flex items-center gap-0.5 hover:opacity-100 transition-opacity"
                            title={expanded ? "Skrýt podúkoly" : "Zobrazit podúkoly"}
                        >
                            {expanded
                                ? <ChevronDown className="w-3 h-3 shrink-0" />
                                : <ChevronRight className="w-3 h-3 shrink-0" />}
                            <span>
                                {subtaskSeconds > 0
                                    ? `${subtaskCount}× (${formatSeconds(subtaskSeconds)})`
                                    : `${subtaskCount} podúkolů`}
                            </span>
                        </button>
                    </>
                )}
            </div>

            {/* Expanded subtask list */}
            {expanded && subtaskCount > 0 && (
                <div className="mt-1.5 pt-1.5 flex flex-col gap-0.5" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    {issue.fields.subtasks?.map((st) => {
                        const stCatKey = st.fields.status?.statusCategory?.key ?? ""
                        const stStyle = statusStyle(stCatKey, color.text)
                        return (
                            <div key={st.key} className="flex items-center gap-1 text-[10px]">
                                {st.fields.issuetype?.iconUrl && (
                                    <img src={st.fields.issuetype.iconUrl} alt="" className="w-3 h-3 shrink-0" />
                                )}
                                <span className="shrink-0 opacity-55 whitespace-nowrap">{st.key}</span>
                                <span className="flex-1 min-w-0 truncate">{st.fields.summary}</span>
                                <span className="shrink-0 opacity-65 whitespace-nowrap">
                                    {formatSeconds(st.fields.timeoriginalestimate)}
                                </span>
                                <span
                                    className="shrink-0 px-1 py-px rounded whitespace-nowrap leading-tight"
                                    style={{ background: stStyle.bg, color: stStyle.color }}
                                >
                                    {st.fields.status?.name}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
