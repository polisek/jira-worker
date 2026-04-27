import { useState, useCallback, useRef } from "react"
import { rankIssueRequest } from "../../../api/sprints/rank-issue"
import type { JiraIssue } from "../../../types/jira"
import type { TreeViewDataProps } from "./useTreeView.data"

export type CreateCtx = {
    parentIssue: JiraIssue | null
    createTypeName: string
} | null

export type TreeViewControllerProps = {
    expanded: Set<string>
    dragOverKey: string | null
    createCtx: CreateCtx
    setCreateCtx: (ctx: CreateCtx) => void
    handleToggle: (issue: JiraIssue) => void
    handleDragStart: (key: string, parentKey: string | null) => void
    handleDragOver: (key: string) => void
    handleDrop: (toKey: string) => void
    handleDragEnd: () => void
    handleCreated: (created: JiraIssue) => void
}

const useTreeViewController = (dataProps: TreeViewDataProps): TreeViewControllerProps => {
    const { setEpics, nodeStates, setNodeStates, loadEpics, loadChildren, loadEpicsRef } = dataProps

    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [createCtx, setCreateCtx] = useState<CreateCtx>(null)

    // ── Drag & drop ────────────────────────────────────────────────────────────
    const draggingRef = useRef<{ key: string; parentKey: string | null } | null>(null)
    const [dragOverKey, setDragOverKey] = useState<string | null>(null)

    const handleDragStart = useCallback((key: string, parentKey: string | null) => {
        draggingRef.current = { key, parentKey }
    }, [])

    const handleDragOver = useCallback((key: string) => {
        if (draggingRef.current && draggingRef.current.key !== key) {
            setDragOverKey(key)
        }
    }, [])

    const handleDrop = useCallback(
        (toKey: string) => {
            const drag = draggingRef.current
            if (!drag || drag.key === toKey) {
                setDragOverKey(null)
                return
            }

            const reorder = (
                list: JiraIssue[]
            ): { next: JiraIssue[]; beforeKey: string | null; afterKey: string | null } => {
                const fromIdx = list.findIndex((i) => i.key === drag.key)
                const toIdx = list.findIndex((i) => i.key === toKey)
                if (fromIdx === -1 || toIdx === -1) return { next: list, beforeKey: null, afterKey: null }
                const next = [...list]
                const [item] = next.splice(fromIdx, 1)
                next.splice(toIdx, 0, item)
                const newIdx = next.findIndex((i) => i.key === drag.key)
                const beforeKey = next[newIdx + 1]?.key ?? null
                const afterKey = beforeKey ? null : (next[newIdx - 1]?.key ?? null)
                return { next, beforeKey, afterKey }
            }

            if (drag.parentKey === null) {
                setEpics((prev) => {
                    const { next, beforeKey, afterKey } = reorder(prev)
                    rankIssueRequest(drag.key, beforeKey, afterKey).catch(() => {
                        loadEpicsRef.current?.(false)
                    })
                    return next
                })
            } else {
                setNodeStates((prev) => {
                    const existing = prev.get(drag.parentKey!)
                    if (!existing?.children) return prev
                    const { next: nextChildren, beforeKey, afterKey } = reorder(existing.children)
                    rankIssueRequest(drag.key, beforeKey, afterKey).catch(() => {})
                    const nextMap = new Map(prev)
                    nextMap.set(drag.parentKey!, { ...existing, children: nextChildren })
                    return nextMap
                })
            }
            draggingRef.current = null
            setDragOverKey(null)
        },
        [setEpics, setNodeStates, loadEpicsRef]
    )

    const handleDragEnd = useCallback(() => {
        draggingRef.current = null
        setDragOverKey(null)
    }, [])

    // ── Expand / collapse ──────────────────────────────────────────────────────

    const handleToggle = useCallback(
        (issue: JiraIssue) => {
            const key = issue.key
            setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(key)) {
                    next.delete(key)
                } else {
                    next.add(key)
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

    // ── After creating a new issue ─────────────────────────────────────────────

    const handleCreated = useCallback(
        (_created: JiraIssue) => {
            if (!createCtx) return
            if (createCtx.parentIssue) {
                const parent = createCtx.parentIssue
                setExpanded((prev) => {
                    const next = new Set(prev)
                    next.add(parent.key)
                    return next
                })
                loadChildren(parent)
            } else {
                loadEpics(false)
            }
            setCreateCtx(null)
        },
        [createCtx, loadChildren, loadEpics]
    )

    return {
        expanded,
        dragOverKey,
        createCtx,
        setCreateCtx,
        handleToggle,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        handleCreated,
    }
}

export default useTreeViewController
