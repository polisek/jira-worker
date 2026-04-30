import { useState, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAssignIssueMutation } from "../../../api/users/assign-issue"
import { useUpdateIssueMutation } from "../../../api/issues/update-issue"
import { usePrioritiesQuery } from "../../../api/issues/get-priorities"
import { useBoardsQuery } from "../../../api/boards/get-boards"
import { useBoardSprintsQuery } from "../../../api/boards/get-board-sprints"
import { useMoveToSprintMutation } from "../../../api/sprints/move-to-sprint"
import { useMoveToBacklogMutation } from "../../../api/sprints/move-to-backlog"
import { queryKeys } from "../../../api/queryKeys"
import { UserPicker } from "../../UserPicker"
import { StatusBadge } from "../../IssueBadges"
import { formatDate } from "../../../utils/adf"
import { DetailCard } from "./DetailCard"
import type { JiraIssue, JiraUser } from "../../../types/jira"

interface Props {
    issue: JiraIssue
    assignableUsers: JiraUser[]
    onNavigateTo: (key: string) => void
}

interface MetaFieldProps {
    label: string
    editable?: boolean
    editing?: boolean
    onDoubleClick?: () => void
    children: React.ReactNode
    className?: string
}

function MetaField({ label, editable, editing, onDoubleClick, children, className = "" }: MetaFieldProps) {
    return (
        <div className={className}>
            <p className="text-xs text-gray-600 mb-1">{label}</p>
            <div
                onDoubleClick={onDoubleClick}
                className={`py-0.5 rounded transition-colors ${editable ? "meta-field-editable" : ""} ${editing ? "editing" : ""}`}
                title={editable && !editing ? "Dvojklik pro úpravu" : undefined}
            >
                {children}
            </div>
        </div>
    )
}

export function IssueInfoSection({ issue, assignableUsers, onNavigateTo }: Props) {
    const [editingAssignee, setEditingAssignee] = useState(false)
    const [editingPriority, setEditingPriority] = useState(false)
    const [editingSprint, setEditingSprint] = useState(false)
    const priorityRef = useRef<HTMLDivElement>(null)
    const sprintRef = useRef<HTMLDivElement>(null)

    const queryClient = useQueryClient()
    const assignMutation = useAssignIssueMutation(issue.key)
    const updateMutation = useUpdateIssueMutation(issue.key)
    const moveToSprint = useMoveToSprintMutation()
    const moveToBacklog = useMoveToBacklogMutation()
    const { data: priorities = [] } = usePrioritiesQuery()

    const projectKey = issue.fields.project.key
    const boardsQuery = useBoardsQuery(projectKey)
    const boardId = boardsQuery.data?.values[0]?.id ?? 0
    const sprintsQuery = useBoardSprintsQuery(boardId, { enabled: !!boardId })
    const availableSprints = sprintsQuery.data?.values ?? []

    // Close priority dropdown on outside click
    useEffect(() => {
        if (!editingPriority) return
        const handler = (e: MouseEvent) => {
            if (!priorityRef.current?.contains(e.target as Node)) setEditingPriority(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [editingPriority])

    // Close sprint dropdown on outside click
    useEffect(() => {
        if (!editingSprint) return
        const handler = (e: MouseEvent) => {
            if (!sprintRef.current?.contains(e.target as Node)) setEditingSprint(false)
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [editingSprint])

    // Reset edit states when issue changes
    useEffect(() => {
        setEditingAssignee(false)
        setEditingPriority(false)
        setEditingSprint(false)
    }, [issue.key])

    const handleAssigneeChange = async (user: JiraUser | null) => {
        await assignMutation.mutateAsync(user?.accountId ?? null)
        setEditingAssignee(false)
    }

    const handlePrioritySelect = async (name: string) => {
        await updateMutation.mutateAsync({ priority: { name } })
        setEditingPriority(false)
    }

    const handleSprintSelect = async (sprintId: number | null) => {
        setEditingSprint(false)
        if (sprintId === null) {
            await moveToBacklog.mutateAsync(issue.key)
        } else {
            await moveToSprint.mutateAsync({ sprintId, issueKey: issue.key })
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issue.key) })
    }

    const storyPoints = issue.fields.customfield_10016

    return (
        <DetailCard>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* Assignee — double-click editable */}
                <MetaField
                    label="Přiřazeno"
                    editable
                    editing={editingAssignee}
                    onDoubleClick={() => !editingAssignee && setEditingAssignee(true)}
                >
                    {editingAssignee ? (
                        <UserPicker
                            users={assignableUsers}
                            value={issue.fields.assignee}
                            onChange={handleAssigneeChange}
                            placeholder="Hledat osobu..."
                        />
                    ) : issue.fields.assignee ? (
                        <div className="flex items-center gap-1.5">
                            <img
                                src={issue.fields.assignee.avatarUrls["48x48"]}
                                className="w-5 h-5 rounded-full"
                                alt=""
                            />
                            <span className="text-xs text-gray-300">{issue.fields.assignee.displayName}</span>
                        </div>
                    ) : (
                        <span className="text-xs text-gray-500 italic">Nepřiřazeno</span>
                    )}
                </MetaField>

                {/* Reporter — readonly */}
                <MetaField label="Reporter">
                    <div className="flex items-center gap-1.5">
                        <img src={issue.fields.reporter.avatarUrls["48x48"]} className="w-5 h-5 rounded-full" alt="" />
                        <span className="text-xs text-gray-300">{issue.fields.reporter.displayName}</span>
                    </div>
                </MetaField>

                {/* Priority — double-click editable */}
                <div ref={priorityRef} className="relative">
                    <MetaField
                        label="Priorita"
                        editable
                        editing={editingPriority}
                        onDoubleClick={() => !editingPriority && setEditingPriority(true)}
                    >
                        <div className="flex items-center gap-1.5">
                            <img src={issue.fields.priority.iconUrl} className="w-4 h-4" alt="" />
                            <span className="text-xs text-gray-300">{issue.fields.priority.name}</span>
                        </div>
                    </MetaField>
                    {editingPriority && priorities.length > 0 && (
                        <div
                            className="absolute top-full left-0 z-50 mt-1 rounded-lg border border-gray-700 shadow-xl py-1 min-w-[150px]"
                            style={{ background: "var(--c-bg-detail)" }}
                        >
                            {priorities.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => handlePrioritySelect(p.name)}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700/50 transition-colors"
                                >
                                    <img src={p.iconUrl} className="w-4 h-4" alt="" />
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sprint — editable */}
                <div ref={sprintRef} className="col-span-2 relative">
                    <MetaField
                        label="Sprint"
                        editable
                        editing={editingSprint}
                        onDoubleClick={() => !editingSprint && setEditingSprint(true)}
                    >
                        {issue.fields.customfield_10020 && issue.fields.customfield_10020.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {issue.fields.customfield_10020.map((sprint) => {
                                    const stateColor =
                                        sprint.state === "active"
                                            ? "text-green-400"
                                            : sprint.state === "future"
                                              ? "text-blue-400"
                                              : "text-gray-500"
                                    const stateBg =
                                        sprint.state === "active"
                                            ? "rgba(34,197,94,0.12)"
                                            : sprint.state === "future"
                                              ? "rgba(59,130,246,0.12)"
                                              : "rgba(0,0,0,0.15)"
                                    return (
                                        <span
                                            key={sprint.id}
                                            className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded ${stateColor}`}
                                            style={{ background: stateBg }}
                                        >
                                            <span
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ background: "currentColor" }}
                                            />
                                            {sprint.name}
                                        </span>
                                    )
                                })}
                            </div>
                        ) : (
                            <span className="text-xs text-gray-500 italic">Backlog</span>
                        )}
                    </MetaField>

                    {editingSprint && (
                        <div
                            className="absolute top-full left-0 z-50 mt-1 rounded-lg border border-gray-700 shadow-xl py-1 min-w-[220px] max-h-60 overflow-y-auto"
                            style={{ background: "var(--c-bg-detail)" }}
                        >
                            <button
                                onClick={() => handleSprintSelect(null)}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700/50 transition-colors italic"
                            >
                                Backlog (bez sprintu)
                            </button>
                            {availableSprints.length > 0 && (
                                <div className="border-t border-gray-700/50 mt-1 pt-1">
                                    {availableSprints.map((sprint) => {
                                        const dotColor = sprint.state === "active" ? "#4ade80" : "#60a5fa"
                                        return (
                                            <button
                                                key={sprint.id}
                                                onClick={() => handleSprintSelect(sprint.id)}
                                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700/50 transition-colors"
                                            >
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ background: dotColor }}
                                                />
                                                {sprint.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Story Points — readonly */}
                {storyPoints != null && (
                    <MetaField label="Story Points">
                        <span className="text-xs text-gray-300 font-semibold">{storyPoints}</span>
                    </MetaField>
                )}

                {/* Dates */}
                <MetaField label="Vytvořeno">
                    <span className="text-xs text-gray-400">{formatDate(issue.fields.created)}</span>
                </MetaField>

                <MetaField label="Aktualizováno">
                    <span className="text-xs text-gray-400">{formatDate(issue.fields.updated)}</span>
                </MetaField>

                {issue.fields.duedate && (
                    <MetaField label="Termín">
                        <span className="text-xs text-gray-300">{issue.fields.duedate}</span>
                    </MetaField>
                )}

                {/* Labels */}
                {issue.fields.labels?.length > 0 && (
                    <div className="col-span-2">
                        <p className="text-xs text-gray-600 mb-1.5">Štítky</p>
                        <div className="flex flex-wrap gap-1.5">
                            {issue.fields.labels.map((l) => (
                                <span key={l} className="badge badge-gray">
                                    {l}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Subtasks */}
                {issue.fields.subtasks?.length > 0 && (
                    <div className="col-span-2">
                        <p className="text-xs text-gray-600 mb-1.5">Podúkoly ({issue.fields.subtasks.length})</p>
                        <div className="flex flex-col gap-1">
                            {issue.fields.subtasks.map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center gap-2 py-1.5 px-2 rounded"
                                    style={{ background: "var(--c-bg-card-alt)" }}
                                >
                                    <img src={s.fields.issuetype.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
                                    <button
                                        className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline shrink-0"
                                        onClick={() => onNavigateTo(s.key)}
                                    >
                                        {s.key}
                                    </button>
                                    <span className="text-xs text-gray-300 truncate flex-1">{s.fields.summary}</span>
                                    {s.fields.assignee && (
                                        <img
                                            src={s.fields.assignee.avatarUrls["48x48"]}
                                            alt={s.fields.assignee.displayName}
                                            title={s.fields.assignee.displayName}
                                            className="w-4 h-4 rounded-full shrink-0"
                                        />
                                    )}
                                    <StatusBadge status={s.fields.status} className="shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DetailCard>
    )
}
