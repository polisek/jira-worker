import { useMemo, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useBoardsQuery } from "../../../api/boards/get-boards"
import { useBoardSprintsQuery } from "../../../api/boards/get-board-sprints"
import { useSearchIssuesQuery } from "../../../api/issues/search-issues"
import { useAssignableUsersQuery } from "../../../api/users/get-assignable-users"
import { queryKeys } from "../../../api/queryKeys"
import type { JiraIssue, JiraProject, JiraSprint, JiraUser } from "../../../types/jira"

export type RoadmapViewDataProps = {
    boardId: number
    sprints: JiraSprint[]
    allProjectUsers: JiraUser[]
    sprintIssues: JiraIssue[]
    backlogIssues: JiraIssue[]
    loading: boolean
    error: string | null
    refetch: () => void
}

export type useRoadmapViewDataProps = {
    selectedProject: JiraProject | null
}

const useRoadmapViewData = ({ selectedProject }: useRoadmapViewDataProps): RoadmapViewDataProps => {
    const projectKey = selectedProject?.key ?? ""
    const queryClient = useQueryClient()

    const boardsQuery = useBoardsQuery(projectKey, { enabled: !!projectKey })
    const boardId = boardsQuery.data?.values[0]?.id ?? 0

    const sprintsQuery = useBoardSprintsQuery(boardId, { enabled: !!boardId })
    const usersQuery = useAssignableUsersQuery(projectKey, { enabled: !!projectKey })

    const sprints = useMemo(() => {
        const raw = sprintsQuery.data?.values ?? []
        const filtered = raw.filter((s) => s.state === "active" || s.state === "future")
        return filtered.slice().sort((a, b) => {
            if (a.state === "active" && b.state !== "active") return -1
            if (b.state === "active" && a.state !== "active") return 1
            const aDate = a.startDate ?? ""
            const bDate = b.startDate ?? ""
            return aDate.localeCompare(bDate)
        })
    }, [sprintsQuery.data])

    const sprintIds = useMemo(() => sprints.map((s) => s.id), [sprints])

    const sprintJql =
        sprintIds.length > 0 ? `project = "${projectKey}" AND sprint in (${sprintIds.join(",")}) ORDER BY assignee` : ""

    const backlogJql = projectKey
        ? `project = "${projectKey}" AND sprint is EMPTY AND statusCategory != Done AND issuetype not in subTaskIssueTypes() ORDER BY assignee`
        : ""

    const sprintIssuesQuery = useSearchIssuesQuery(sprintJql, 200, undefined, {
        enabled: sprintIds.length > 0,
    })

    const backlogIssuesQuery = useSearchIssuesQuery(backlogJql, 100, undefined, {
        enabled: !!projectKey,
    })

    const loading =
        boardsQuery.isFetching ||
        sprintsQuery.isFetching ||
        usersQuery.isFetching ||
        sprintIssuesQuery.isFetching ||
        backlogIssuesQuery.isFetching

    const error =
        (boardsQuery.error as Error | null)?.message ??
        (sprintsQuery.error as Error | null)?.message ??
        (usersQuery.error as Error | null)?.message ??
        (sprintIssuesQuery.error as Error | null)?.message ??
        (backlogIssuesQuery.error as Error | null)?.message ??
        null

    const refetch = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.boards.list(projectKey) })
        queryClient.invalidateQueries({ queryKey: queryKeys.boards.sprints(boardId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.users.assignable(projectKey) })
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
    }, [queryClient, projectKey, boardId])

    return {
        boardId,
        sprints,
        allProjectUsers: usersQuery.data ?? [],
        sprintIssues: sprintIssuesQuery.data?.issues ?? [],
        backlogIssues: backlogIssuesQuery.data?.issues ?? [],
        loading,
        error,
        refetch,
    }
}

export default useRoadmapViewData
