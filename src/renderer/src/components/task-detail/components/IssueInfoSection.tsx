import { useState, useEffect, useRef } from 'react'
import { useAssignIssueMutation } from '../../../api/users/assign-issue'
import { useUpdateIssueMutation } from '../../../api/issues/update-issue'
import { usePrioritiesQuery } from '../../../api/issues/get-priorities'
import { UserPicker } from '../../UserPicker'
import { StatusBadge } from '../../IssueBadges'
import { formatDate } from '../../../lib/adf-to-text'
import { DetailCard } from './DetailCard'
import type { JiraIssue, JiraUser } from '../../../types/jira'

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

function MetaField({ label, editable, editing, onDoubleClick, children, className = '' }: MetaFieldProps) {
    return (
        <div className={className}>
            <p className="text-xs text-gray-600 mb-1">{label}</p>
            <div
                onDoubleClick={onDoubleClick}
                className={`py-0.5 rounded transition-colors ${editable ? 'meta-field-editable' : ''} ${editing ? 'editing' : ''}`}
                title={editable && !editing ? 'Dvojklik pro úpravu' : undefined}
            >
                {children}
            </div>
        </div>
    )
}

export function IssueInfoSection({ issue, assignableUsers, onNavigateTo }: Props) {
    const [editingAssignee, setEditingAssignee] = useState(false)
    const [editingPriority, setEditingPriority] = useState(false)
    const priorityRef = useRef<HTMLDivElement>(null)

    const assignMutation = useAssignIssueMutation(issue.key)
    const updateMutation = useUpdateIssueMutation(issue.key)
    const { data: priorities = [] } = usePrioritiesQuery()

    // Close priority dropdown on outside click
    useEffect(() => {
        if (!editingPriority) return
        const handler = (e: MouseEvent) => {
            if (!priorityRef.current?.contains(e.target as Node)) setEditingPriority(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [editingPriority])

    // Reset edit states when issue changes
    useEffect(() => {
        setEditingAssignee(false)
        setEditingPriority(false)
    }, [issue.key])

    const handleAssigneeChange = async (user: JiraUser | null) => {
        await assignMutation.mutateAsync(user?.accountId ?? null)
        setEditingAssignee(false)
    }

    const handlePrioritySelect = async (name: string) => {
        await updateMutation.mutateAsync({ priority: { name } })
        setEditingPriority(false)
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
                                src={issue.fields.assignee.avatarUrls['48x48']}
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
                        <img
                            src={issue.fields.reporter.avatarUrls['48x48']}
                            className="w-5 h-5 rounded-full"
                            alt=""
                        />
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
                            style={{ background: 'var(--c-bg-detail)' }}
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
                                <span key={l} className="badge badge-gray">{l}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Subtasks */}
                {issue.fields.subtasks?.length > 0 && (
                    <div className="col-span-2">
                        <p className="text-xs text-gray-600 mb-1.5">
                            Podúkoly ({issue.fields.subtasks.length})
                        </p>
                        <div className="flex flex-col gap-1">
                            {issue.fields.subtasks.map((s) => (
                                <div
                                    key={s.id}
                                    className="flex items-center gap-2 py-1.5 px-2 rounded"
                                    style={{ background: 'var(--c-bg-card-alt)' }}
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
                                            src={s.fields.assignee.avatarUrls['48x48']}
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
