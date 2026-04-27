import { ChevronRight, ChevronDown, Plus, Loader2, AlertCircle, GripVertical } from 'lucide-react'
import { StatusBadge } from '../../IssueBadges'
import type { JiraIssue } from '../../../types/jira'
import type { NodeState } from '../hooks/useTreeView.data'
import type { TreeViewControllerProps } from '../hooks/useTreeView.controller'

const INDENT = 20 // px per level

export function issueTypeStyle(typeName: string, level = 0) {
    if (level >= 2) return { dot: 'bg-emerald-500', text: 'text-emerald-300', line: '#10b98133' }
    const n = typeName.toLowerCase()
    if (n === 'epic') return { dot: 'bg-purple-500', text: 'text-purple-300', line: '#7c3aed33' }
    if (n === 'bug') return { dot: 'bg-red-500', text: 'text-red-300', line: '#ef444433' }
    if (n === 'story') return { dot: 'bg-blue-500', text: 'text-blue-300', line: '#3b82f633' }
    if (n === 'subtask' || n === 'sub-task') return { dot: 'bg-emerald-500', text: 'text-emerald-300', line: '#10b98133' }
    return { dot: 'bg-sky-500', text: 'text-sky-300', line: '#0ea5e933' }
}

export function isSubtaskType(typeName: string, level = 0) {
    if (level >= 2) return true
    const n = typeName.toLowerCase()
    return n === 'subtask' || n === 'sub-task'
}

interface TreeNodeProps {
    issue: JiraIssue
    level: number
    parentKey: string | null
    rowIndex: number // index within parent's children, used for zebra striping
    nodeStates: Map<string, NodeState>
    expanded: Set<string>
    dragOverKey: string | null
    controllerProps: Pick<
        TreeViewControllerProps,
        | 'handleToggle'
        | 'handleDragStart'
        | 'handleDragOver'
        | 'handleDrop'
        | 'handleDragEnd'
        | 'setCreateCtx'
    >
    onSelectIssue: (issue: JiraIssue) => void
}

export function TreeNode({
    issue,
    level,
    parentKey,
    rowIndex,
    nodeStates,
    expanded,
    dragOverKey,
    controllerProps,
    onSelectIssue,
}: TreeNodeProps) {
    const { handleToggle, handleDragStart, handleDragOver, handleDrop, handleDragEnd, setCreateCtx } = controllerProps
    const typeName = issue.fields.issuetype.name
    const isLeaf = isSubtaskType(typeName, level)
    const style = issueTypeStyle(typeName, level)
    const isExpanded = expanded.has(issue.key)
    const nodeState = nodeStates.get(issue.key)
    const isDragTarget = dragOverKey === issue.key
    const isEven = rowIndex % 2 === 0
    const ROW_LEFT = 4 + level * INDENT

    return (
        <div>
            {/* Drop indicator above */}
            {isDragTarget && (
                <div
                    className="h-0.5 rounded-full mx-1 mb-0.5"
                    style={{ marginLeft: ROW_LEFT, background: '#60a5fa' }}
                />
            )}

            {/* Row */}
            <div
                draggable
                onDragStart={(e) => {
                    e.stopPropagation()
                    handleDragStart(issue.key, parentKey)
                }}
                onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDragOver(issue.key)
                }}
                onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDrop(issue.key, issue, parentKey)
                }}
                onDragEnd={handleDragEnd}
                className="group flex items-center gap-1.5 py-[5px] pr-1 rounded-md transition-colors hover:bg-[var(--c-item-h)]"
                style={{
                    paddingLeft: ROW_LEFT,
                    cursor: 'default',
                    background: isEven ? 'transparent' : 'var(--c-row-alt)',
                }}
            >
                <GripVertical
                    className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab"
                    style={{ color: 'var(--c-text-4)' }}
                />

                {!isLeaf ? (
                    <button
                        onClick={() => handleToggle(issue)}
                        className="w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                        title={isExpanded ? 'Sbalit' : 'Rozbalit'}
                    >
                        {nodeState?.loading ? (
                            <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--c-text-4)' }} />
                        ) : isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--c-text-4)' }} />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--c-text-4)' }} />
                        )}
                    </button>
                ) : (
                    <span className="w-5 h-5 shrink-0" />
                )}

                <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />

                <div
                    className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
                    onClick={() => onSelectIssue(issue)}
                >
                    <span className={`text-xs font-mono font-semibold shrink-0 ${style.text}`}>{issue.key}</span>
                    <span className="text-sm truncate flex-1" style={{ color: 'var(--c-text-2)' }}>
                        {issue.fields.summary}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <StatusBadge status={issue.fields.status} />

                        {issue.fields.reporter && (
                            <img
                                src={issue.fields.reporter.avatarUrls['48x48']}
                                alt={issue.fields.reporter.displayName}
                                title={`Reporter: ${issue.fields.reporter.displayName}`}
                                className="w-4 h-4 rounded-full shrink-0 opacity-50"
                            />
                        )}

                        {issue.fields.assignee ? (
                            <img
                                src={issue.fields.assignee.avatarUrls['48x48']}
                                alt={issue.fields.assignee.displayName}
                                title={`Assignee: ${issue.fields.assignee.displayName}`}
                                className="w-4 h-4 rounded-full shrink-0"
                            />
                        ) : (
                            <span className="w-4 h-4 shrink-0 rounded-full border border-dashed border-gray-600" />
                        )}
                    </div>
                </div>
            </div>

            {/* Children */}
            {isExpanded && nodeState && (
                <div
                    className="border-l"
                    style={{ marginLeft: ROW_LEFT + 13, borderColor: style.line }}
                >
                    {nodeState.error && (
                        <div
                            className="flex items-center gap-1.5 py-1.5 text-xs text-red-400"
                            style={{ paddingLeft: 8 }}
                        >
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {nodeState.error}
                        </div>
                    )}
                    {!nodeState.error && nodeState.children !== null && nodeState.children.length === 0 && (
                        <p className="py-1.5 text-xs" style={{ paddingLeft: 8, color: 'var(--c-text-4)' }}>
                            Žádné podúkoly
                        </p>
                    )}
                    {nodeState.children !== null &&
                        nodeState.children.map((child, idx) => (
                            <TreeNode
                                key={child.key}
                                issue={child}
                                level={level + 1}
                                parentKey={issue.key}
                                rowIndex={idx}
                                nodeStates={nodeStates}
                                expanded={expanded}
                                dragOverKey={dragOverKey}
                                controllerProps={controllerProps}
                                onSelectIssue={onSelectIssue}
                            />
                        ))}

                    {!nodeState.loading && (() => {
                        const childTypeName = typeName.toLowerCase() === 'epic' ? 'Task' : 'Subtask'
                        return (
                            <button
                                onClick={() => setCreateCtx({ parentIssue: issue, createTypeName: childTypeName })}
                                className="flex items-center justify-center gap-1.5 py-1.5 my-0.5 text-xs rounded-md w-full transition-colors hover:opacity-80"
                                style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.08)' }}
                            >
                                <Plus className="w-3 h-3" />
                                {`Nový ${childTypeName} do „${issue.fields.summary}"`}
                            </button>
                        )
                    })()}
                </div>
            )}
        </div>
    )
}
