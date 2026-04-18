import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronRight, ChevronDown, Plus, Loader2, AlertCircle, RefreshCw, GripVertical } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import { CreateIssueModal } from "./CreateIssueModal"
import type { JiraIssue, JiraProject, AppPrefs } from "../types/jira"

interface Props {
    selectedProject: JiraProject | null
    projects: JiraProject[]
    searchQuery: string
    onSelectIssue: (issue: JiraIssue) => void
    prefs: AppPrefs
}

type NodeState = {
    children: JiraIssue[] | null
    loading: boolean
    error: string | null
}

type CreateCtx = {
    parentIssue: JiraIssue | null // null = create Epic at root
    createTypeName: string        // "Epic" | "Task" | "Subtask"
} | null

// ── Helpers ───────────────────────────────────────────────────────────────────

function issueTypeStyle(typeName: string, level = 0) {
    // Level 2+ are always subtasks regardless of Jira type name (next-gen projects)
    if (level >= 2) return { dot: "bg-emerald-500", text: "text-emerald-300", line: "#10b98133" }
    const n = typeName.toLowerCase()
    if (n === "epic") return { dot: "bg-purple-500", text: "text-purple-300", line: "#7c3aed33" }
    if (n === "bug") return { dot: "bg-red-500", text: "text-red-300", line: "#ef444433" }
    if (n === "story") return { dot: "bg-blue-500", text: "text-blue-300", line: "#3b82f633" }
    if (n === "subtask" || n === "sub-task")
        return { dot: "bg-emerald-500", text: "text-emerald-300", line: "#10b98133" }
    // Task / other
    return { dot: "bg-sky-500", text: "text-sky-300", line: "#0ea5e933" }
}

function isSubtaskType(typeName: string, level = 0) {
    if (level >= 2) return true
    const n = typeName.toLowerCase()
    return n === "subtask" || n === "sub-task"
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JiraIssue["fields"]["status"] }) {
    const cat = status.statusCategory.key
    const cls =
        cat === "done"
            ? "bg-green-500/15 text-green-300 border-green-500/30"
            : cat === "indeterminate"
              ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
              : "bg-gray-500/15 text-gray-400 border-gray-500/30"
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border whitespace-nowrap ${cls}`}>
            {status.name}
        </span>
    )
}

// ── Single tree node ──────────────────────────────────────────────────────────

interface TreeNodeProps {
    issue: JiraIssue
    level: number
    parentKey: string | null  // null = root epic list
    nodeStates: Map<string, NodeState>
    expanded: Set<string>
    dragOverKey: string | null
    onToggle: (issue: JiraIssue) => void
    onSelectIssue: (issue: JiraIssue) => void
    onAdd: (parentIssue: JiraIssue, createTypeName: string) => void
    onDragStart: (key: string, parentKey: string | null) => void
    onDragOver: (key: string) => void
    onDrop: (toKey: string) => void
    onDragEnd: () => void
}

function TreeNode({ issue, level, parentKey, nodeStates, expanded, dragOverKey, onToggle, onSelectIssue, onAdd, onDragStart, onDragOver, onDrop, onDragEnd }: TreeNodeProps) {
    const typeName = issue.fields.issuetype.name
    const isLeaf = isSubtaskType(typeName, level)
    const style = issueTypeStyle(typeName, level)
    const isExpanded = expanded.has(issue.key)
    const nodeState = nodeStates.get(issue.key)
    const isDragTarget = dragOverKey === issue.key

    const INDENT = 20 // px per level
    const ROW_LEFT = 4 + level * INDENT

    return (
        <div>
            {/* Drop indicator above */}
            {isDragTarget && (
                <div
                    className="h-0.5 rounded-full mx-1 mb-0.5"
                    style={{ marginLeft: ROW_LEFT, background: "#60a5fa" }}
                />
            )}

            {/* ── Row ─────────────────────────────────────────────────────── */}
            <div
                draggable
                onDragStart={(e) => { e.stopPropagation(); onDragStart(issue.key, parentKey) }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(issue.key) }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(issue.key) }}
                onDragEnd={onDragEnd}
                className="group flex items-center gap-1.5 py-[5px] pr-1 rounded-md transition-colors hover:bg-[var(--c-item-h)]"
                style={{
                    paddingLeft: ROW_LEFT,
                    cursor: "default",
                }}
            >
                {/* Drag handle */}
                <GripVertical
                    className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab"
                    style={{ color: "var(--c-text-4)" }}
                />
                {/* Expand / collapse chevron */}
                {!isLeaf ? (
                    <button
                        onClick={() => onToggle(issue)}
                        className="w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
                        title={isExpanded ? "Sbalit" : "Rozbalit"}
                    >
                        {nodeState?.loading ? (
                            <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--c-text-4)" }} />
                        ) : isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--c-text-4)" }} />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--c-text-4)" }} />
                        )}
                    </button>
                ) : (
                    <span className="w-5 h-5 shrink-0" />
                )}

                {/* Issue-type colour dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />

                {/* Clickable content */}
                <div
                    className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
                    onClick={() => onSelectIssue(issue)}
                >
                    <span className={`text-xs font-mono font-semibold shrink-0 ${style.text}`}>{issue.key}</span>
                    <span className="text-sm truncate flex-1" style={{ color: "var(--c-text-2)" }}>
                        {issue.fields.summary}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <StatusBadge status={issue.fields.status} />

                        {/* Reporter (dimmed) */}
                        {issue.fields.reporter && (
                            <img
                                src={issue.fields.reporter.avatarUrls["48x48"]}
                                alt={issue.fields.reporter.displayName}
                                title={`Reporter: ${issue.fields.reporter.displayName}`}
                                className="w-4 h-4 rounded-full shrink-0 opacity-50"
                            />
                        )}

                        {/* Assignee */}
                        {issue.fields.assignee ? (
                            <img
                                src={issue.fields.assignee.avatarUrls["48x48"]}
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

            {/* ── Children ──────────────────────────────────────────────────── */}
            {isExpanded && nodeState && (
                <div
                    className="border-l"
                    style={{
                        marginLeft: ROW_LEFT + 13,
                        borderColor: style.line,
                    }}
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
                        <p className="py-1.5 text-xs" style={{ paddingLeft: 8, color: "var(--c-text-4)" }}>
                            Žádné podúkoly
                        </p>
                    )}
                    {nodeState.children !== null &&
                        nodeState.children.map((child) => (
                            <TreeNode
                                key={child.key}
                                issue={child}
                                level={level + 1}
                                parentKey={issue.key}
                                nodeStates={nodeStates}
                                expanded={expanded}
                                dragOverKey={dragOverKey}
                                onToggle={onToggle}
                                onSelectIssue={onSelectIssue}
                                onAdd={onAdd}
                                onDragStart={onDragStart}
                                onDragOver={onDragOver}
                                onDrop={onDrop}
                                onDragEnd={onDragEnd}
                            />
                        ))}

                    {/* Add-child button — last item in branch */}
                    {!nodeState.loading && (() => {
                        const childTypeName = typeName === "epic" ? "Task" : "Subtask"
                        return (
                            <button
                                onClick={() => onAdd(issue, childTypeName)}
                                className="flex items-center justify-center gap-1.5 py-1.5 my-0.5 text-xs rounded-md w-full transition-colors hover:opacity-80"
                                style={{ color: "#60a5fa", background: "rgba(96,165,250,0.08)" }}
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

// ── Main TreeView ─────────────────────────────────────────────────────────────

export function TreeView({ selectedProject, projects, searchQuery, onSelectIssue, prefs }: Props) {

    const [epics, setEpics] = useState<JiraIssue[]>([])
    const [epicsLoading, setEpicsLoading] = useState(false)
    const [epicsError, setEpicsError] = useState<string | null>(null)

    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [nodeStates, setNodeStates] = useState<Map<string, NodeState>>(new Map())

    const [createCtx, setCreateCtx] = useState<CreateCtx>(null)

    // ── Drag & drop state ─────────────────────────────────────────────────────
    const draggingRef = useRef<{ key: string; parentKey: string | null } | null>(null)
    const [dragOverKey, setDragOverKey] = useState<string | null>(null)
    const loadEpicsRef = useRef<((resetTree?: boolean) => void) | null>(null)

    const handleDragStart = useCallback((key: string, parentKey: string | null) => {
        draggingRef.current = { key, parentKey }
    }, [])

    const handleDragOver = useCallback((key: string) => {
        if (draggingRef.current && draggingRef.current.key !== key) {
            setDragOverKey(key)
        }
    }, [])

    const handleDrop = useCallback((toKey: string) => {
        const drag = draggingRef.current
        if (!drag || drag.key === toKey) { setDragOverKey(null); return }

        const reorder = (list: JiraIssue[]): { next: JiraIssue[]; beforeKey: string | null; afterKey: string | null } => {
            const fromIdx = list.findIndex((i) => i.key === drag.key)
            const toIdx = list.findIndex((i) => i.key === toKey)
            if (fromIdx === -1 || toIdx === -1) return { next: list, beforeKey: null, afterKey: null }
            const next = [...list]
            const [item] = next.splice(fromIdx, 1)
            next.splice(toIdx, 0, item)
            // Determine rank relative to neighbours in the new position
            const newIdx = next.findIndex((i) => i.key === drag.key)
            const beforeKey = next[newIdx + 1]?.key ?? null
            const afterKey = beforeKey ? null : (next[newIdx - 1]?.key ?? null)
            return { next, beforeKey, afterKey }
        }

        if (drag.parentKey === null) {
            // Root epic list — optimistic update then persist
            setEpics((prev) => {
                const { next, beforeKey, afterKey } = reorder(prev)
                jiraApi.rankIssue(drag.key, beforeKey, afterKey).catch(() => {
                    // On failure revert — reload from Jira
                    loadEpicsRef.current?.(false)
                })
                return next
            })
        } else {
            // Children of a branch — optimistic update then persist
            setNodeStates((prev) => {
                const existing = prev.get(drag.parentKey!)
                if (!existing?.children) return prev
                const { next: nextChildren, beforeKey, afterKey } = reorder(existing.children)
                jiraApi.rankIssue(drag.key, beforeKey, afterKey).catch(() => {
                    // On failure reload the branch
                    // (loadChildren is called in the effect below via a flag)
                })
                const nextMap = new Map(prev)
                nextMap.set(drag.parentKey!, { ...existing, children: nextChildren })
                return nextMap
            })
        }
        draggingRef.current = null
        setDragOverKey(null)
    }, [])

    const handleDragEnd = useCallback(() => {
        draggingRef.current = null
        setDragOverKey(null)
    }, [])

    // ── Load root EPICs ───────────────────────────────────────────────────────

    const loadEpics = useCallback(async (resetTree = true) => {
        setEpicsLoading(true)
        setEpicsError(null)
        // Reset expanded/children only when the query context changes (project, search)
        // not when just refreshing after creation
        if (resetTree) {
            setExpanded(new Set())
            setNodeStates(new Map())
        }

        try {
            const parts: string[] = ["issuetype = Epic"]
            if (selectedProject) parts.push(`project = "${selectedProject.key}"`)
            if (searchQuery.trim()) parts.push(`summary ~ "${searchQuery.trim()}"`)
            const jql = parts.join(" AND ") + " ORDER BY rank ASC"
            const result = await jiraApi.searchIssues(jql, prefs.maxResults)
            setEpics(result.issues)
        } catch (e: any) {
            setEpicsError(e.message)
        } finally {
            setEpicsLoading(false)
        }
    }, [selectedProject, searchQuery, prefs.maxResults])

    // Keep ref in sync so drag handlers can call loadEpics without stale closure
    useEffect(() => { loadEpicsRef.current = loadEpics }, [loadEpics])

    useEffect(() => {
        const timer = setTimeout(loadEpics, searchQuery ? 400 : 0)
        return () => clearTimeout(timer)
    }, [loadEpics, searchQuery])

    // ── Lazy-load children when a node is expanded ────────────────────────────

    const loadChildren = useCallback(
        async (issue: JiraIssue) => {
            const key = issue.key
            const typeName = issue.fields.issuetype.name.toLowerCase()

            setNodeStates((prev) => {
                const next = new Map(prev)
                next.set(key, { children: prev.get(key)?.children ?? null, loading: true, error: null })
                return next
            })

            try {
                const jql =
                    typeName === "epic"
                        ? // Epic children: support both classic (Epic Link) and next-gen (parent)
                          `(parent = "${key}" OR "Epic Link" = "${key}") ORDER BY rank ASC`
                        : // Subtasks (any non-epic non-leaf)
                          `parent = "${key}" ORDER BY rank ASC`

                const result = await jiraApi.searchIssues(jql, 100)

                setNodeStates((prev) => {
                    const next = new Map(prev)
                    next.set(key, { children: result.issues, loading: false, error: null })
                    return next
                })
            } catch (e: any) {
                setNodeStates((prev) => {
                    const next = new Map(prev)
                    next.set(key, { children: [], loading: false, error: e.message })
                    return next
                })
            }
        },
        []
    )

    // ── Toggle expand / collapse ──────────────────────────────────────────────

    const handleToggle = useCallback(
        (issue: JiraIssue) => {
            const key = issue.key
            setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(key)) {
                    next.delete(key)
                } else {
                    next.add(key)
                    // Lazy-load only if not already fetched
                    const existing = nodeStates.get(key)
                    if (!existing || existing.children === null) {
                        loadChildren(issue)
                    }
                }
                return next
            })
        },
        [nodeStates, loadChildren]
    )

    // ── After creating a new issue, refresh relevant branch ──────────────────

    const handleCreated = (_created: JiraIssue) => {
        if (!createCtx) return
        if (createCtx.parentIssue) {
            const parent = createCtx.parentIssue
            const parentKey = parent.key
            // Ensure the parent is expanded so the user sees the new child
            setExpanded((prev) => {
                const next = new Set(prev)
                next.add(parentKey)
                return next
            })
            // Always reload children (whether branch was open or not)
            loadChildren(parent)
        } else {
            // New Epic → reload root list without collapsing existing branches
            loadEpics(false)
        }
        setCreateCtx(null)
    }

    // ── Determine CreateIssueModal context ────────────────────────────────────

    const parentIssue = createCtx?.parentIssue ?? null
    const isParentEpic = parentIssue?.fields.issuetype.name.toLowerCase() === "epic"

    const createDefaultEpic = isParentEpic ? parentIssue : null
    const createDefaultParentKey = parentIssue && !isParentEpic ? parentIssue.key : undefined
    const createTypeName = createCtx?.createTypeName

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--c-bg-board)" }}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ borderColor: "var(--c-border)" }}
            >
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-sm" style={{ color: "var(--c-text)" }}>
                        Strom
                    </h2>
                    {selectedProject && (
                        <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                                background: "var(--c-bg-card)",
                                color: "var(--c-text-4)",
                            }}
                        >
                            {selectedProject.key}
                        </span>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-2 ml-2">
                        {[
                            { label: "Epic", dot: "bg-purple-500" },
                            { label: "Story", dot: "bg-blue-500" },
                            { label: "Task", dot: "bg-sky-500" },
                            { label: "Bug", dot: "bg-red-500" },
                            { label: "Subtask", dot: "bg-emerald-500" },
                        ].map(({ label, dot }) => (
                            <span
                                key={label}
                                className="flex items-center gap-1 text-xs"
                                style={{ color: "var(--c-text-4)" }}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setCreateCtx({ parentIssue: null, createTypeName: "Epic" })}
                        className="btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
                        title="Přidat Epic"
                    >
                        <Plus className="w-3 h-3" /> Nový Epic
                    </button>
                    <button onClick={() => loadEpics()} className="btn-icon" title="Obnovit" disabled={epicsLoading}>
                        <RefreshCw className={`w-3.5 h-3.5 ${epicsLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Tree body */}
            <div className="flex-1 overflow-y-auto p-2">
                {epicsLoading && (
                    <div className="flex items-center justify-center gap-2 py-16" style={{ color: "var(--c-text-4)" }}>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Načítám epicy…</span>
                    </div>
                )}

                {!epicsLoading && epicsError && (
                    <div className="flex items-center gap-2 m-2 p-3 rounded-lg text-sm text-red-400 bg-red-500/10 border border-red-500/30">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {epicsError}
                    </div>
                )}

                {!epicsLoading && !epicsError && epics.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center py-16 gap-2"
                        style={{ color: "var(--c-text-4)" }}
                    >
                        <p className="text-sm">Žádné epicy nenalezeny</p>
                        <p className="text-xs">Zkuste změnit projekt nebo filtr</p>
                    </div>
                )}

                {!epicsLoading &&
                    epics.map((epic) => (
                        <TreeNode
                            key={epic.key}
                            issue={epic}
                            level={0}
                            parentKey={null}
                            nodeStates={nodeStates}
                            expanded={expanded}
                            dragOverKey={dragOverKey}
                            onToggle={handleToggle}
                            onSelectIssue={onSelectIssue}
                            onAdd={(issue, childTypeName) => setCreateCtx({ parentIssue: issue, createTypeName: childTypeName })}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                        />
                    ))}
            </div>

            {/* Create modal */}
            {createCtx !== null && (
                <CreateIssueModal
                    projects={projects}
                    defaultProject={selectedProject ?? projects[0] ?? null}
                    defaultEpic={createDefaultEpic}
                    defaultParentKey={createDefaultParentKey}
                    defaultIssueTypeName={createTypeName}
                    onClose={() => setCreateCtx(null)}
                    onCreated={handleCreated}
                />
            )}
        </div>
    )
}
