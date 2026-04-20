import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

export async function assignIssueRequest(key: string, accountId: string | null): Promise<void> {
    return request('PUT', `/issue/${key}/assignee`, { accountId })
}

export function useAssignIssueMutation(key: string) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, string | null>({
        mutationFn: (accountId) => assignIssueRequest(key, accountId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(key) })
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
        },
    })
}
