import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

export async function createIssueRequest(fields: Record<string, unknown>): Promise<{ id: string; key: string }> {
    return request('POST', '/issue', { fields })
}

export function useCreateIssueMutation() {
    const queryClient = useQueryClient()

    return useMutation<{ id: string; key: string }, Error, Record<string, unknown>>({
        mutationFn: (fields) => createIssueRequest(fields),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
        },
    })
}
