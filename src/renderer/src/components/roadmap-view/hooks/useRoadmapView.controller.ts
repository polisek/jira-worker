import { useState, useEffect, useCallback } from "react"
import { useMoveToSprintMutation } from "../../../api/sprints/move-to-sprint"
import { useMoveToBacklogMutation } from "../../../api/sprints/move-to-backlog"
import { useUpdateIssueMutation } from "../../../api/issues/update-issue"
import type { AppPrefs, JiraIssue, RoadmapDragPayload } from "../../../types/jira"
import type { RoadmapViewDataProps } from "./useRoadmapView.data"

const CAPACITIES_KEY = 'roadmap.userCapacities'
const DEFAULT_CAPACITY = 40

function loadCapacities(): Record<string, number> {
    try {
        return JSON.parse(localStorage.getItem(CAPACITIES_KEY) ?? '{}')
    } catch {
        return {}
    }
}

export type RoadmapViewControllerProps = {
    selectedUserIds: string[]
    userCapacities: Record<string, number>
    backlogOpen: boolean
    showUserPicker: boolean
    showCreateSprint: boolean
    dragPayload: RoadmapDragPayload | null
    dragOverTarget: { userId: string; sprintId: number | null } | null
    localSprintIssues: JiraIssue[]
    localBacklogIssues: JiraIssue[]
    getUserCapacity: (accountId: string) => number
    setUserCapacity: (accountId: string, hours: number) => void
    setBacklogOpen: (open: boolean) => void
    setShowUserPicker: (show: boolean) => void
    setShowCreateSprint: (show: boolean) => void
    handleUserToggle: (userId: string) => void
    handleDragStart: (payload: RoadmapDragPayload) => void
    handleDragOver: (userId: string, sprintId: number | null) => void
    handleDragLeave: () => void
    handleDrop: (targetUserId: string, targetSprintId: number | null) => void
    handleDragEnd: () => void
}

export type useRoadmapViewControllerProps = {
    dataProps: RoadmapViewDataProps
    prefs: AppPrefs
    onPrefsChange: (prefs: Partial<AppPrefs>) => void
}

const useRoadmapViewController = ({
    dataProps,
    prefs,
    onPrefsChange,
}: useRoadmapViewControllerProps): RoadmapViewControllerProps => {
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>(prefs.roadmapUserIds ?? [])
    const [userCapacities, setUserCapacitiesState] = useState<Record<string, number>>(loadCapacities)
    const [backlogOpen, setBacklogOpen] = useState(true)
    const [showUserPicker, setShowUserPicker] = useState(false)
    const [showCreateSprint, setShowCreateSprint] = useState(false)
    const [dragPayload, setDragPayload] = useState<RoadmapDragPayload | null>(null)
    const [dragOverTarget, setDragOverTarget] = useState<{ userId: string; sprintId: number | null } | null>(null)
    const [localSprintIssues, setLocalSprintIssues] = useState<JiraIssue[]>([])
    const [localBacklogIssues, setLocalBacklogIssues] = useState<JiraIssue[]>([])

    const moveToSprint = useMoveToSprintMutation()
    const moveToBacklog = useMoveToBacklogMutation()
    const updateIssue = useUpdateIssueMutation()

    useEffect(() => {
        setLocalSprintIssues(dataProps.sprintIssues)
    }, [dataProps.sprintIssues])

    useEffect(() => {
        setLocalBacklogIssues(dataProps.backlogIssues)
    }, [dataProps.backlogIssues])

    const handleUserToggle = useCallback(
        (userId: string) => {
            setSelectedUserIds((prev) => {
                const next = prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
                onPrefsChange({ ...prefs, roadmapUserIds: next })
                return next
            })
        },
        [prefs, onPrefsChange]
    )

    const getUserCapacity = useCallback(
        (accountId: string) => userCapacities[accountId] ?? DEFAULT_CAPACITY,
        [userCapacities],
    )

    const setUserCapacity = useCallback((accountId: string, hours: number) => {
        setUserCapacitiesState((prev) => {
            const next = { ...prev, [accountId]: hours }
            localStorage.setItem(CAPACITIES_KEY, JSON.stringify(next))
            return next
        })
    }, [])

    const handleDragStart = useCallback((payload: RoadmapDragPayload) => {
        setDragPayload(payload)
    }, [])

    const handleDragOver = useCallback((userId: string, sprintId: number | null) => {
        setDragOverTarget({ userId, sprintId })
    }, [])

    const handleDragLeave = useCallback(() => {
        setDragOverTarget(null)
    }, [])

    const handleDragEnd = useCallback(() => {
        setDragPayload(null)
        setDragOverTarget(null)
    }, [])

    const handleDrop = useCallback(
        async (targetUserId: string, targetSprintId: number | null) => {
            if (!dragPayload) return
            const { issueKey, fromUserId, fromSprintId } = dragPayload

            if (targetSprintId === fromSprintId && targetUserId === fromUserId) {
                handleDragEnd()
                return
            }

            const targetUser = dataProps.allProjectUsers.find((u) => u.accountId === targetUserId) ?? null

            // Optimistic update
            const applyOptimistic = (issue: JiraIssue): JiraIssue => {
                if (issue.key !== issueKey) return issue
                return {
                    ...issue,
                    fields: {
                        ...issue.fields,
                        assignee: targetUser,
                        customfield_10020:
                            targetSprintId !== null
                                ? [{ id: targetSprintId, name: "", state: "active" as const }]
                                : undefined,
                    },
                }
            }

            if (fromSprintId !== null) {
                setLocalSprintIssues((prev) => {
                    const updated = prev.map(applyOptimistic)
                    if (targetSprintId === null) {
                        const moved = updated.find((i) => i.key === issueKey)
                        if (moved) setLocalBacklogIssues((b) => [...b, moved])
                        return updated.filter((i) => i.key !== issueKey)
                    }
                    return updated
                })
            } else {
                setLocalBacklogIssues((prev) => {
                    const updated = prev.map(applyOptimistic)
                    if (targetSprintId !== null) {
                        const moved = updated.find((i) => i.key === issueKey)
                        if (moved) setLocalSprintIssues((s) => [...s, moved])
                        return updated.filter((i) => i.key !== issueKey)
                    }
                    return updated
                })
            }

            setDragPayload(null)
            setDragOverTarget(null)
            try {
                if (targetSprintId !== null) {
                    await moveToSprint.mutateAsync({ sprintId: targetSprintId, issueKey })
                } else {
                    await moveToBacklog.mutateAsync(issueKey)
                }
                if (targetUserId !== fromUserId) {
                    await updateIssue.mutateAsync({ key: issueKey, assignee: { accountId: targetUserId } })
                }
            } catch {
                // Rollback on error
                setLocalSprintIssues(dataProps.sprintIssues)
                setLocalBacklogIssues(dataProps.backlogIssues)
            }
        },
        [dragPayload, dataProps, moveToSprint, moveToBacklog, updateIssue, handleDragEnd]
    )

    return {
        selectedUserIds,
        userCapacities,
        getUserCapacity,
        setUserCapacity,
        backlogOpen,
        showUserPicker,
        showCreateSprint,
        dragPayload,
        dragOverTarget,
        localSprintIssues,
        localBacklogIssues,
        setBacklogOpen,
        setShowUserPicker,
        setShowCreateSprint,
        handleUserToggle,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDragEnd,
    }
}

export default useRoadmapViewController
