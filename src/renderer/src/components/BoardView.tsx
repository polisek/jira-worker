import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { RefreshCw, ChevronDown, Plus, GripVertical, Settings2 } from "lucide-react"
import { ErrorMessage } from "./ErrorMessage"
import { statusDotClass } from "./IssueBadges"
import { useIssues } from "../hooks/useIssues"
import { IssueCard } from "./IssueCard"
import { CreateIssueModal } from "./CreateIssueModal"
import { StatusManagerDialog } from "./StatusManagerDialog"
import { jiraApi } from "../lib/jira-api"
import type { JiraIssue, JiraProject, JiraSprint, JiraStatus, AppPrefs } from "../types/jira"

interface Props {
    selectedProject: JiraProject | null
    projects: JiraProject[]
    filter: "all" | "mine" | "unassigned"
    searchQuery: string
    onSelectIssue: (issue: JiraIssue) => void
    prefs: AppPrefs
}

// Pořadí kategorií pro řazení sloupců
const CATEGORY_ORDER: Record<string, number> = {
    new: 0,
    indeterminate: 1,
    done: 2,
}


const CATEGORY_RING: Record<string, string> = {
    new: "ring-gray-500/40",
    indeterminate: "ring-blue-500/40",
    done: "ring-green-500/40",
}

export function BoardView({ selectedProject, projects, filter, searchQuery, onSelectIssue, prefs }: Props) {
    const [selectedSprint, setSelectedSprint] = useState<string>("active")
    const [sprintOpen, setSprintOpen] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [showStatusManager, setShowStatusManager] = useState(false)

    const { issues, loading, error, total, reload, setIssues } = useIssues({
        selectedProject,
        filter,
        searchQuery,
        prefs,
        sprint: selectedSprint,
    })

    // Drag state — karty
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dragOverCol, setDragOverCol] = useState<string | null>(null)
    const [transitioning, setTransitioning] = useState<Set<string>>(new Set())

    // Drag state — sloupce
    const draggingColRef = useRef<string | null>(null)
    const [draggingColId, setDraggingColId] = useState<string | null>(null)
    const [dragOverColId, setDragOverColId] = useState<string | null>(null)

    // Uložené pořadí sloupců per projekt
    const [columnOrder, setColumnOrder] = useState<string[]>([])

    useEffect(() => {
        const key = `boardColumnOrder_${selectedProject?.key ?? "__all__"}`
        try {
            const saved = localStorage.getItem(key)
            setColumnOrder(saved ? JSON.parse(saved) : [])
        } catch {
            setColumnOrder([])
        }
    }, [selectedProject])

    // ── Všechny dostupné statusy z Jiry ───────────────────────────
    const [allStatuses, setAllStatuses] = useState<JiraStatus[]>([])

    useEffect(() => {
        async function fetchStatuses() {
            try {
                if (selectedProject) {
                    const types = await jiraApi.getProjectStatuses(selectedProject.key)
                    const map = new Map<string, JiraStatus>()
                    for (const t of types) {
                        for (const s of t.statuses) {
                            if (!map.has(s.id)) map.set(s.id, s)
                        }
                    }
                    setAllStatuses([...map.values()])
                } else {
                    const statuses = await jiraApi.getAllStatuses()
                    setAllStatuses(statuses)
                }
            } catch (err) {
                console.error("Failed to fetch statuses:", err)
            }
        }
        fetchStatuses()
    }, [selectedProject])

    // ── Sloupce boardu ze všech dostupných statusů Jiry ───────────
    const columns = useMemo(() => {
        const defaultSorted = [...allStatuses]
            .sort((a, b) => {
                const catDiff =
                    (CATEGORY_ORDER[a.statusCategory.key] ?? 1) -
                    (CATEGORY_ORDER[b.statusCategory.key] ?? 1)
                return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name, "cs")
            })
            .map((s) => ({
                id: s.id,
                name: s.name,
                categoryKey: s.statusCategory.key,
                categoryName: s.statusCategory.name,
            }))

        if (columnOrder.length === 0) return defaultSorted

        // Aplikuj uložené pořadí; nové statusy (neznámé) se připojí na konec ve výchozím pořadí
        const savedMap = new Map(columnOrder.map((id, i) => [id, i]))
        return [...defaultSorted].sort((a, b) => {
            const ia = savedMap.has(a.id) ? savedMap.get(a.id)! : columnOrder.length + defaultSorted.findIndex((c) => c.id === a.id)
            const ib = savedMap.has(b.id) ? savedMap.get(b.id)! : columnOrder.length + defaultSorted.findIndex((c) => c.id === b.id)
            return ia - ib
        })
    }, [allStatuses, columnOrder])

    // ── Dostupné sprinty z načtených issues ───────────────────────
    const sprints = useMemo(() => {
        const map = new Map<number, JiraSprint>()
        for (const issue of issues) {
            for (const s of issue.fields.customfield_10020 ?? []) {
                if (!map.has(s.id)) map.set(s.id, s)
            }
        }
        return [...map.values()].sort((a, b) => {
            const order = { active: 0, future: 1, closed: 2 }
            return (order[a.state] ?? 3) - (order[b.state] ?? 3)
        })
    }, [issues])

    const sprintLabel = useMemo(() => {
        if (selectedSprint === "active") return "Aktivní sprint"
        if (selectedSprint === "all") return "Všechny sprinty"
        if (selectedSprint === "none") return "Bez sprintu"
        const s = sprints.find((sp) => String(sp.id) === selectedSprint)
        return s?.name ?? "Sprint"
    }, [selectedSprint, sprints])

    // ── Drag handlers — karty ─────────────────────────────────────
    const handleDragStart = useCallback((e: React.DragEvent, issueId: string) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("issueId", issueId)
        setDraggingId(issueId)
    }, [])

    const handleDragEnd = useCallback(() => {
        setDraggingId(null)
        setDragOverCol(null)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (draggingColRef.current) {
            setDragOverColId(colId)
        } else {
            setDragOverCol(colId)
        }
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            setDragOverCol(null)
            setDragOverColId(null)
        }
    }, [])

    const handleDrop = useCallback(
        async (e: React.DragEvent, targetStatusId: string, targetCategoryKey: string) => {
            e.preventDefault()
            setDragOverCol(null)
            setDragOverColId(null)

            // ── Přesunutí sloupce ──────────────────────────────────
            const colId = e.dataTransfer.getData("colId")
            if (colId) {
                if (colId === targetStatusId) return
                const currentIds = columns.map((c) => c.id)
                const fromIdx = currentIds.indexOf(colId)
                const toIdx = currentIds.indexOf(targetStatusId)
                if (fromIdx === -1 || toIdx === -1) return
                const next = [...currentIds]
                next.splice(fromIdx, 1)
                next.splice(toIdx, 0, colId)
                const storageKey = `boardColumnOrder_${selectedProject?.key ?? "__all__"}`
                localStorage.setItem(storageKey, JSON.stringify(next))
                setColumnOrder(next)
                draggingColRef.current = null
                setDraggingColId(null)
                return
            }

            // ── Přesun karty ───────────────────────────────────────
            const issueId = e.dataTransfer.getData("issueId")
            if (!issueId) return

            const issue = issues.find((i) => i.id === issueId)
            if (!issue || issue.fields.status.id === targetStatusId) return

            setTransitioning((prev) => new Set(prev).add(issueId))

            try {
                const { transitions } = await jiraApi.getTransitions(issue.key)

                // Zkusíme nejdřív přesnou shodu statusu, pak shodu kategorie
                const transition =
                    transitions.find((t) => t.to.id === targetStatusId) ??
                    transitions.find((t) => t.to.statusCategory.key === targetCategoryKey)

                if (!transition) {
                    console.warn(`Žádná transition do statusu "${targetStatusId}" pro ${issue.key}`)
                    return
                }

                // Optimistický update
                setIssues((prev) =>
                    prev.map((i) =>
                        i.id === issueId
                            ? {
                                  ...i,
                                  fields: {
                                      ...i.fields,
                                      status: {
                                          ...i.fields.status,
                                          id: transition.to.id,
                                          name: transition.to.name,
                                          statusCategory: transition.to.statusCategory,
                                      },
                                  },
                              }
                            : i
                    )
                )

                await jiraApi.doTransition(issue.key, transition.id)
            } catch (err) {
                console.error("Transition failed:", err)
                reload()
            } finally {
                setTransitioning((prev) => {
                    const next = new Set(prev)
                    next.delete(issueId)
                    return next
                })
            }
        },
        [issues, columns, reload, setIssues, selectedProject]
    )

    // ── Drag handlers — sloupce ───────────────────────────────────
    const handleColDragStart = useCallback((e: React.DragEvent, colId: string) => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("colId", colId)
        draggingColRef.current = colId
        setDraggingColId(colId)
        e.stopPropagation()
    }, [])

    const handleColDragEnd = useCallback(() => {
        draggingColRef.current = null
        setDraggingColId(null)
        setDragOverColId(null)
    }, [])

    const getColumnIssues = (statusId: string) => issues.filter((i) => i.fields.status.id === statusId)

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <h1 className="font-semibold text-gray-100 truncate">
                        {selectedProject ? selectedProject.name : "Všechny projekty"}
                    </h1>
                    {!loading && <span className="text-xs text-gray-500 shrink-0">{total} tasků</span>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Sprint selector */}
                    <div className="relative">
                        <button
                            onClick={() => setSprintOpen((v) => !v)}
                            className="flex items-center gap-1.5 text-sm text-gray-300 bg-gray-800/60 border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <span className="max-w-40 truncate">{sprintLabel}</span>
                            <ChevronDown
                                className={`w-3.5 h-3.5 text-gray-500 transition-transform ${sprintOpen ? "rotate-180" : ""}`}
                            />
                        </button>

                        {sprintOpen && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                                {[
                                    { value: "active", label: "Aktivní sprint", sub: "JQL: sprint in openSprints()" },
                                    { value: "all", label: "Všechny sprinty", sub: "Bez filtru sprintu" },
                                    { value: "none", label: "Bez sprintu", sub: "Tasky mimo sprint" },
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            setSelectedSprint(opt.value)
                                            setSprintOpen(false)
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${selectedSprint === opt.value ? "text-blue-300 bg-blue-500/10" : "text-gray-300"}`}
                                    >
                                        <div>{opt.label}</div>
                                        <div className="text-xs text-gray-600">{opt.sub}</div>
                                    </button>
                                ))}

                                {sprints.length > 0 && (
                                    <>
                                        <div className="border-t border-gray-800 my-1" />
                                        <p className="px-3 py-1 text-xs text-gray-600 uppercase tracking-wider">
                                            Konkrétní sprint
                                        </p>
                                        {sprints.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    setSelectedSprint(String(s.id))
                                                    setSprintOpen(false)
                                                }}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${selectedSprint === String(s.id) ? "text-blue-300 bg-blue-500/10" : "text-gray-300"}`}
                                            >
                                                <div className="truncate">{s.name}</div>
                                                <div
                                                    className={`text-xs mt-0.5 ${s.state === "active" ? "text-green-500" : s.state === "future" ? "text-blue-400" : "text-gray-600"}`}
                                                >
                                                    {s.state === "active"
                                                        ? "Aktivní"
                                                        : s.state === "future"
                                                          ? "Nadcházející"
                                                          : "Uzavřený"}
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <button onClick={reload} className="btn-icon" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    {selectedProject && (
                        <button
                            onClick={() => setShowStatusManager(true)}
                            className="btn-icon"
                            title="Spravovat stavy"
                        >
                            <Settings2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => setShowCreate(true)}
                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                    >
                        <Plus className="w-4 h-4" /> Nový task
                    </button>
                </div>
            </div>

            {showStatusManager && selectedProject && (
                <StatusManagerDialog
                    project={selectedProject}
                    onClose={() => setShowStatusManager(false)}
                />
            )}

            {showCreate && (
                <CreateIssueModal
                    projects={projects}
                    defaultProject={selectedProject}
                    onClose={() => setShowCreate(false)}
                    onCreated={(issue) => {
                        setShowCreate(false)
                        onSelectIssue(issue)
                        reload()
                    }}
                />
            )}

            {error && <ErrorMessage message={error} />}

            {/* Board */}
            <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden">
                {/* Skeleton při prvním načtení */}
                {loading &&
                    columns.length === 0 &&
                    ["", "", ""].map((_, i) => (
                        <div key={i} className="board-column flex flex-col min-w-64 max-w-64">
                            <div className="h-5 bg-gray-800 rounded mb-3 w-28 animate-pulse" />
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="issue-card skeleton h-24 mb-2" />
                            ))}
                        </div>
                    ))}

                {columns.map((col) => {
                    const colIssues = getColumnIssues(col.id)
                    const isCardOver = dragOverCol === col.id
                    const isColOver = dragOverColId === col.id && draggingColId !== col.id

                    return (
                        <div
                            key={col.id}
                            className={`board-column flex flex-col min-w-64 max-w-64 transition-all ${
                                isColOver
                                    ? "ring-2 ring-amber-500/40 bg-amber-500/5"
                                    : isCardOver
                                      ? `ring-2 ${CATEGORY_RING[col.categoryKey] ?? "ring-blue-500/40"} bg-blue-500/5`
                                      : ""
                            } ${draggingColId === col.id ? "opacity-40" : ""}`}
                            onDragOver={(e) => handleDragOver(e, col.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.id, col.categoryKey)}
                        >
                            {/* Column header — draggable pro přeřazení sloupců */}
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div
                                    className="flex items-center gap-2 min-w-0 cursor-grab active:cursor-grabbing select-none"
                                    draggable
                                    onDragStart={(e) => handleColDragStart(e, col.id)}
                                    onDragEnd={handleColDragEnd}
                                >
                                    <GripVertical className="w-3.5 h-3.5 text-gray-700 shrink-0" />
                                    <div
                                        className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(col.categoryKey)}`}
                                    />
                                    <span className="text-sm font-semibold text-gray-300 truncate" title={col.name}>
                                        {col.name}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5 shrink-0 ml-1">
                                    {loading ? "..." : colIssues.length}
                                </span>
                            </div>

                            {isCardOver && (
                                <div
                                    className={`mx-1 mb-2 h-0.5 rounded-full animate-pulse ${
                                        col.categoryKey === "done"
                                            ? "bg-green-500/60"
                                            : col.categoryKey === "indeterminate"
                                              ? "bg-blue-500/60"
                                              : "bg-gray-500/60"
                                    }`}
                                />
                            )}

                            {/* Cards */}
                            <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                                {colIssues.map((issue) => (
                                    <IssueCard
                                        key={issue.id}
                                        issue={issue}
                                        onClick={() => onSelectIssue(issue)}
                                        dragging={draggingId === issue.id}
                                        transitioning={transitioning.has(issue.id)}
                                        onDragStart={(e) => handleDragStart(e, issue.id)}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))}

                                {!loading && colIssues.length === 0 && (
                                    <div
                                        className={`flex items-center justify-center h-16 text-sm rounded-lg border border-dashed transition-colors ${
                                            isCardOver
                                                ? "border-blue-500/50 text-blue-400/60"
                                                : "border-gray-800 text-gray-700"
                                        }`}
                                    >
                                        {isCardOver ? "Pustit sem" : "Prázdné"}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}

                {!loading && columns.length === 0 && !error && (
                    <div className="flex-1 flex items-center justify-center text-gray-600">Žádné tasky</div>
                )}
            </div>
        </div>
    )
}
