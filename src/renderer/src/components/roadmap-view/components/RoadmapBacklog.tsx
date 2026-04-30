import { ChevronDown, ChevronRight } from 'lucide-react'
import type { JiraIssue, RoadmapDragPayload, RoadmapUser } from '../../../types/jira'
import { RoadmapSprintCell } from './RoadmapSprintCell'

interface Props {
    open: boolean
    onToggle: () => void
    backlogIssues: JiraIssue[]
    selectedUsers: RoadmapUser[]
    getUserCapacity: (accountId: string) => number
    dragOverPayload: RoadmapDragPayload | null
    dragOverTarget: { userId: string; sprintId: number | null } | null
    onDrop: (targetUserId: string, targetSprintId: number | null) => void
    onDragOver: (userId: string, sprintId: number | null) => void
    onDragLeave: () => void
    onIssueClick: (issue: JiraIssue) => void
    onIssueCardDragStart: (payload: RoadmapDragPayload) => void
}

function issueHours(issue: JiraIssue): number {
    const own = issue.fields.timeoriginalestimate ?? 0
    const sub = issue.fields.subtasks?.reduce((s, st) => s + (st.fields.timeoriginalestimate ?? 0), 0) ?? 0
    return (own + sub) / 3600
}

function formatHours(h: number): string {
    return h === 0 ? '0h' : `${h.toFixed(1)}h`
}

export function RoadmapBacklog({
    open,
    onToggle,
    backlogIssues,
    selectedUsers,
    getUserCapacity,
    dragOverPayload,
    dragOverTarget,
    onDrop,
    onDragOver,
    onDragLeave,
    onIssueClick,
    onIssueCardDragStart,
}: Props) {
    const totalHours = backlogIssues.reduce((sum, i) => sum + issueHours(i), 0)

    return (
        <div className="h-full flex flex-col">
            {/* Header row — 36px */}
            <button
                onClick={onToggle}
                className="flex items-center gap-1.5 px-3 shrink-0 w-full text-xs font-medium transition-colors"
                style={{
                    height: 36,
                    color: 'var(--c-text-2)',
                    background: 'transparent',
                    textAlign: 'left',
                }}
            >
                {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                Backlog bez sprintu
                <span className="ml-1 opacity-55">
                    ({backlogIssues.length} úkolů · {formatHours(totalHours)})
                </span>
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-auto">
                <table className="roadmap-table">
                    <tbody>
                        <tr>
                            <td
                                className="roadmap-sprint-col text-xs"
                                style={{ color: 'var(--c-text-4)', padding: '6px 8px', verticalAlign: 'top' }}
                            >
                                Backlog
                            </td>
                            {selectedUsers.map((ru) => {
                                const userIssues = backlogIssues.filter(
                                    (i) => i.fields.assignee?.accountId === ru.user.accountId,
                                )
                                return (
                                    <RoadmapSprintCell
                                        key={ru.user.accountId}
                                        issues={userIssues}
                                        userId={ru.user.accountId}
                                        sprintId={null}
                                        sprintCapacity={getUserCapacity(ru.user.accountId)}
                                        userColorIndex={ru.colorIndex}
                                        dragOverPayload={dragOverPayload}
                                        dragOverTarget={dragOverTarget}
                                        onDrop={onDrop}
                                        onDragOver={onDragOver}
                                        onDragLeave={onDragLeave}
                                        onIssueClick={onIssueClick}
                                        onIssueCardDragStart={onIssueCardDragStart}
                                    />
                                )
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}
