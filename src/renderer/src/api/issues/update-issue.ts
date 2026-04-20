import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

export async function updateIssueRequest(key: string, fields: Record<string, unknown>): Promise<void> {
    return request('PUT', `/issue/${key}`, { fields })
}

export function useUpdateIssueMutation(key: string) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, Record<string, unknown>>({
        mutationFn: (fields) => updateIssueRequest(key, fields),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(key) })
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
        },
    })
}
