import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { getTransitionsRequest } from "../../../api/transitions/get-transitions"
import { doTransitionRequest } from "../../../api/transitions/do-transition"
import type { JiraProject, JiraIssue, JiraStatus, JiraSprint } from "../../../types/jira"
import type { BoardViewDataProps } from "./useBoardView.data"

export type ColumnDef = {
    id: string
    name: string
    categoryKey: string
    categoryName: string
}

export type BoardViewControllerProps = {
    columns: ColumnDef[]
    sprints: JiraSprint[]
    draggingId: string | null
    dragOverCol: string | null
    draggingColId: string | null
    dragOverColId: string | null
    transitioning: Set<string>
    handleDragStart: (e: React.DragEvent, issueId: string) => void
    handleDragEnd: () => void
    handleDragOver: (e: React.DragEvent, colId: string) => void
    handleDragLeave: (e: React.DragEvent) => void
    handleDrop: (e: React.DragEvent, targetStatusId: string, targetCategoryKey: string) => Promise<void>
    handleColDragStart: (e: React.DragEvent, colId: string) => void
    handleColDragEnd: () => void
    getColumnIssues: (statusId: string) => JiraIssue[]
}

// Pořadí kategorií pro řazení sloupců
const CATEGORY_ORDER: Record<string, number> = {
    new: 0,
    indeterminate: 1,
    done: 2,
}

type useBoardViewControllerInput = {
    rawStatuses: BoardViewDataProps["rawStatuses"]
    issues: BoardViewDataProps["issues"]
    setIssues: BoardViewDataProps["setIssues"]
    refetch: BoardViewDataProps["refetch"]
    selectedProject: JiraProject | null
}

const useBoardViewController = ({
    rawStatuses,
    issues,
    setIssues,
    refetch,
    selectedProject,
}: useBoardViewControllerInput): BoardViewControllerProps => {
    // ── Uložené pořadí sloupců per projekt ────────────────────────
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

    // ── Sloupce boardu ────────────────────────────────────────────
    const columns = useMemo<ColumnDef[]>(() => {
        const defaultSorted = [...rawStatuses]
            .sort((a, b) => {
                const catDiff =
                    (CATEGORY_ORDER[a.statusCategory.key] ?? 1) - (CATEGORY_ORDER[b.statusCategory.key] ?? 1)
                return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name, "cs")
            })
            .map((s: JiraStatus) => ({
                id: s.id,
                name: s.name,
                categoryKey: s.statusCategory.key,
                categoryName: s.statusCategory.name,
            }))

        if (columnOrder.length === 0) return defaultSorted

        const savedMap = new Map(columnOrder.map((id, i) => [id, i]))
        return [...defaultSorted].sort((a, b) => {
            const ia = savedMap.has(a.id)
                ? savedMap.get(a.id)!
                : columnOrder.length + defaultSorted.findIndex((c) => c.id === a.id)
            const ib = savedMap.has(b.id)
                ? savedMap.get(b.id)!
                : columnOrder.length + defaultSorted.findIndex((c) => c.id === b.id)
            return ia - ib
        })
    }, [rawStatuses, columnOrder])

    // ── Sprinty z načtených issues ────────────────────────────────
    const sprints = useMemo<JiraSprint[]>(() => {
        const map = new Map<number, JiraSprint>()
        for (const issue of issues) {
            for (const s of issue.fields.customfield_10020 ?? []) {
                if (!map.has(s.id)) map.set(s.id, s)
            }
        }
        return [...map.values()].sort((a, b) => {
            const order: Record<string, number> = { active: 0, future: 1, closed: 2 }
            return (order[a.state] ?? 3) - (order[b.state] ?? 3)
        })
    }, [issues])

    // ── Drag state — karty ────────────────────────────────────────
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dragOverCol, setDragOverCol] = useState<string | null>(null)
    const [transitioning, setTransitioning] = useState<Set<string>>(new Set())

    // ── Drag state — sloupce ──────────────────────────────────────
    const draggingColRef = useRef<string | null>(null)
    const [draggingColId, setDraggingColId] = useState<string | null>(null)
    const [dragOverColId, setDragOverColId] = useState<string | null>(null)

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
                const { transitions } = await getTransitionsRequest(issue.key)

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

                await doTransitionRequest(issue.key, transition.id)
            } catch (err) {
                console.error("Transition failed:", err)
                refetch()
            } finally {
                setTransitioning((prev) => {
                    const next = new Set(prev)
                    next.delete(issueId)
                    return next
                })
            }
        },
        [issues, columns, refetch, setIssues, selectedProject]
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

    const getColumnIssues = useCallback(
        (statusId: string) => issues.filter((i) => i.fields.status.id === statusId),
        [issues]
    )

    return {
        columns,
        sprints,
        draggingId,
        dragOverCol,
        draggingColId,
        dragOverColId,
        transitioning,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleColDragStart,
        handleColDragEnd,
        getColumnIssues,
    }
}

export default useBoardViewController
