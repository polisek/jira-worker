import { useMutation, useQueryClient } from '@tanstack/react-query'
import { agileRequest } from '../client'
import { queryKeys } from '../queryKeys'

interface MoveToSprintParams {
    sprintId: number
    issueKey: string
}

export async function moveToSprintRequest(sprintId: number, issueKey: string): Promise<void> {
    return agileRequest<void>(`/sprint/${sprintId}/issue`, 'POST', { issues: [issueKey] })
}

export function useMoveToSprintMutation() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, MoveToSprintParams>({
        mutationFn: ({ sprintId, issueKey }) => moveToSprintRequest(sprintId, issueKey),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
        },
    })
}
