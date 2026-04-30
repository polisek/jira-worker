import { useMutation, useQueryClient } from '@tanstack/react-query'
import { agileRequest } from '../client'

interface CreateSprintParams {
    boardId: number
    name: string
    startDate?: string
    endDate?: string
}

export async function createSprintRequest(params: CreateSprintParams): Promise<void> {
    return agileRequest<void>('/sprint', 'POST', {
        name: params.name,
        originBoardId: params.boardId,
        ...(params.startDate && { startDate: `${params.startDate}T00:00:00.000Z` }),
        ...(params.endDate && { endDate: `${params.endDate}T00:00:00.000Z` }),
    })
}

export function useCreateSprintMutation() {
    const queryClient = useQueryClient()
    return useMutation<void, Error, CreateSprintParams>({
        mutationFn: createSprintRequest,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['boards', 'sprints'] })
        },
    })
}
