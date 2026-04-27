import { useState, useCallback, useRef } from "react"
import { useRankIssueMutation } from "../../../api/sprints/rank-issue"
import { useUpdateIssueMutation } from "../../../api/issues/update-issue"
import type { JiraIssue } from "../../../types/jira"
import type { TreeViewDataProps } from "./useTreeView.data"

export type CreateCtx = {
    parentIssue: JiraIssue | null
    createTypeName: string
} | null

/** Pending cross-epic move — shown in confirmation dialog */
export type MoveCtx = {
    issue: JiraIssue
    fromEpicKey: string
    toEpicKey: string
} | null

export type TreeViewControllerProps = {
    expanded: Set<string>
    dragOverKey: string | null
    createCtx: CreateCtx
    setCreateCtx: (ctx: CreateCtx) => void
    moveCtx: MoveCtx
    setMoveCtx: (ctx: MoveCtx) => void
    handleMoveConfirm: () => Promise<void>
    handleToggle: (issue: JiraIssue) => void
    handleDragStart: (key: string, parentKey: string | null) => void
    handleDragOver: (key: string) => void
    handleDrop: (toKey: string, toIssue: JiraIssue, toParentKey: string | null) => void
    handleDragEnd: () => void
    handleCreated: (created: JiraIssue) => void
}

const useTreeViewController = (dataProps: TreeViewDataProps): TreeViewControllerProps => {
    const { setEpics, nodeStates, setNodeStates, loadEpics, loadChildren, loadEpicsRef } = dataProps

    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [createCtx, setCreateCtx] = useState<CreateCtx>(null)
    const [moveCtx, setMoveCtx] = useState<MoveCtx>(null)

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

    const { mutateAsync: rankIssue } = useRankIssueMutation()
    const handleDrop = useCallback(
        (toKey: string, toIssue: JiraIssue, toParentKey: string | null) => {
            const drag = draggingRef.current
            if (!drag || drag.key === toKey) {
                setDragOverKey(null)
                return
            }

            // ── Cross-epic move: task dropped into a different epic's branch ──
            if (drag.parentKey !== null && toParentKey !== null && drag.parentKey !== toParentKey) {
                // Find the dragged issue object from nodeStates
                let dragIssue: JiraIssue | undefined
                for (const ns of dataProps.nodeStates.values()) {
                    dragIssue = ns.children?.find((c) => c.key === drag.key)
                    if (dragIssue) break
                }
                if (dragIssue) {
                    console.log(toIssue, toParentKey)
                    setMoveCtx({
                        issue: dragIssue,
                        fromEpicKey: drag.parentKey ?? toIssue.key,
                        toEpicKey: toParentKey,
                    })
                    draggingRef.current = null
                    setDragOverKey(null)
                    return
                }
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
                    rankIssue({ issueKey: drag.key, beforeKey, afterKey }).catch(() => {
                        loadEpicsRef.current?.(false)
                    })
                    return next
                })
            } else {
                setNodeStates((prev) => {
                    const existing = prev.get(drag.parentKey!)
                    if (!existing?.children) return prev
                    const { next: nextChildren, beforeKey, afterKey } = reorder(existing.children)
                    rankIssue({ issueKey: drag.key, beforeKey, afterKey })
                    const nextMap = new Map(prev)
                    nextMap.set(drag.parentKey!, { ...existing, children: nextChildren })
                    return nextMap
                })
            }
            draggingRef.current = null
            setDragOverKey(null)
        },
        [dataProps.nodeStates, setEpics, rankIssue, loadEpicsRef, setNodeStates]
    )

    const handleDragEnd = useCallback(() => {
        draggingRef.current = null
        setDragOverKey(null)
    }, [])

    // ── Confirm cross-epic move ────────────────────────────────────────────────

    const { mutateAsync: updateIssue } = useUpdateIssueMutation()
    const handleMoveConfirm = useCallback(async () => {
        if (!moveCtx) return
        const { issue, fromEpicKey, toEpicKey } = moveCtx
        setMoveCtx(null)

        // Optimistic: remove from source epic branch, add to target
        setNodeStates((prev) => {
            const nextMap = new Map(prev)
            const from = prev.get(fromEpicKey)
            if (from?.children) {
                nextMap.set(fromEpicKey, { ...from, children: from.children.filter((c) => c.key !== issue.key) })
            }
            const to = prev.get(toEpicKey)
            if (to?.children) {
                nextMap.set(toEpicKey, { ...to, children: [...to.children, issue] })
            }
            return nextMap
        })

        // Ensure target epic is expanded
        setExpanded((prev) => {
            const next = new Set(prev)
            next.add(toEpicKey)
            return next
        })

        try {
            // Try next-gen parent field first, fall back to classic epic link
            await updateIssue({ key: issue.key, parent: { key: toEpicKey } })
        } catch (e) {
            console.error("Cross-epic move failed:", e)
            // Revert by reloading both branches
            const fromIssue = dataProps.epics.find((ep) => ep.key === fromEpicKey)
            if (fromIssue) loadChildren(fromIssue)
        }
    }, [dataProps.epics, loadChildren, moveCtx, setNodeStates, updateIssue])

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
        moveCtx,
        setMoveCtx,
        handleMoveConfirm,
        handleToggle,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        handleCreated,
    }
}

export default useTreeViewController
