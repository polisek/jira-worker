import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraStatus } from '../../types/jira'

interface CreateStatusInput {
    name: string
    statusCategory: 'TODO' | 'IN_PROGRESS' | 'DONE'
    description?: string
}

interface CreateStatusesParams {
    statuses: CreateStatusInput[]
    projectId: string
}

export async function createStatusesRequest(
    statuses: CreateStatusInput[],
    projectId: string
): Promise<JiraStatus[]> {
    return request('POST', '/statuses', {
        scope: { type: 'PROJECT', project: { id: projectId } },
        statuses,
    })
}

export function useCreateStatusesMutation() {
    const queryClient = useQueryClient()

    return useMutation<JiraStatus[], Error, CreateStatusesParams>({
        mutationFn: ({ statuses, projectId }) => createStatusesRequest(statuses, projectId),
        onSuccess: async (_, { projectId }) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.statuses.all() })
            await queryClient.invalidateQueries({ queryKey: queryKeys.statuses.forProject(projectId) })
        },
    })
}
