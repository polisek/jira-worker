import { useMutation, useQueryClient } from '@tanstack/react-query'
import { agileRequest } from '../client'

interface SprintUpdateParams {
    sprintId: number
    name: string
    startDate: string
    endDate: string
}

export async function closeSprintRequest({ sprintId, name, startDate, endDate }: SprintUpdateParams): Promise<void> {
    return agileRequest<void>(`/sprint/${sprintId}`, 'PUT', { id: sprintId, name, state: 'closed', startDate, endDate })
}

export async function startSprintRequest({ sprintId, name, startDate, endDate }: SprintUpdateParams): Promise<void> {
    return agileRequest<void>(`/sprint/${sprintId}`, 'PUT', { id: sprintId, name, state: 'active', startDate, endDate })
}

function invalidateSprintQueries(queryClient: ReturnType<typeof useQueryClient>) {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['boards', 'sprints'] }),
        queryClient.invalidateQueries({ queryKey: ['issues', 'list'] }),
    ])
}

export function useCloseSprintMutation() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, SprintUpdateParams>({
        mutationFn: closeSprintRequest,
        onSuccess: () => invalidateSprintQueries(queryClient),
    })
}

export function useStartSprintMutation() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, SprintUpdateParams>({
        mutationFn: startSprintRequest,
        onSuccess: () => invalidateSprintQueries(queryClient),
    })
}
