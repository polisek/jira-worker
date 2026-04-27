import { useMemo } from 'react'
import { useIssueTypesQuery } from '../../../api/projects/get-issue-types'
import { useAssignableUsersQuery } from '../../../api/users/get-assignable-users'
import { useBoardsQuery } from '../../../api/boards/get-boards'
import { useBoardSprintsQuery } from '../../../api/boards/get-board-sprints'
import { useEpicsQuery } from '../../../api/epics/get-epics'
import type { JiraIssue, JiraIssueType, JiraUser, JiraSprint } from '../../../types/jira'

export type CreateIssueModalDataProps = {
    filteredIssueTypes: JiraIssueType[]
    users: JiraUser[]
    sprints: JiraSprint[]
    epics: JiraIssue[]
    isLoading: boolean
}

type useCIMDataInput = {
    projectKey: string
    defaultEpic?: JiraIssue | null
    defaultParentKey?: string
}

const useCreateIssueModalData = ({
    projectKey,
    defaultEpic,
    defaultParentKey,
}: useCIMDataInput): CreateIssueModalDataProps => {
    const issueTypesQuery = useIssueTypesQuery(projectKey)
    const usersQuery = useAssignableUsersQuery(projectKey)
    const boardsQuery = useBoardsQuery(projectKey)

    const boardId = boardsQuery.data?.values?.[0]?.id ?? 0
    const sprintsQuery = useBoardSprintsQuery(boardId, { enabled: !!boardId })

    const epicsQuery = useEpicsQuery(projectKey)

    const filteredIssueTypes = useMemo<JiraIssueType[]>(() => {
        const types = issueTypesQuery.data ?? []
        if (defaultEpic) {
            const taskOnly = types.filter((t) => !t.subtask && t.name.toLowerCase() === 'task')
            if (taskOnly.length > 0) return taskOnly
            return types.filter((t) => !t.subtask && t.name.toLowerCase() !== 'epic')
        }
        if (defaultParentKey) {
            const subtaskTypes = types.filter((t) => t.subtask === true)
            if (subtaskTypes.length > 0) return subtaskTypes
        }
        return types
    }, [issueTypesQuery.data, defaultEpic, defaultParentKey])

    return {
        filteredIssueTypes,
        users: usersQuery.data ?? [],
        sprints: sprintsQuery.data?.values ?? [],
        epics: epicsQuery.data?.issues ?? [],
        isLoading: issueTypesQuery.isLoading || usersQuery.isLoading || boardsQuery.isLoading,
    }
}

export default useCreateIssueModalData
