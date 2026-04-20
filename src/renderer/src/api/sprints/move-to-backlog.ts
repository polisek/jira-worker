import { useMutation, useQueryClient } from '@tanstack/react-query'
import { agileRequest } from '../client'
import { queryKeys } from '../queryKeys'

export async function moveToBacklogRequest(issueKey: string): Promise<void> {
    return agileRequest<void>('/backlog/issue', 'POST', { issues: [issueKey] })
}

export function useMoveToBacklogMutation() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, string>({
        mutationFn: (issueKey) => moveToBacklogRequest(issueKey),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
        },
    })
}
