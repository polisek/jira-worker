import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

interface DeleteIssueLinkParams {
    linkId: string
    issueKey?: string
}

export async function deleteIssueLinkRequest(linkId: string): Promise<void> {
    return request('DELETE', `/issueLink/${linkId}`)
}

export function useDeleteIssueLinkMutation() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, DeleteIssueLinkParams>({
        mutationFn: ({ linkId }) => deleteIssueLinkRequest(linkId),
        onSuccess: async (_, { issueKey }) => {
            if (issueKey) {
                await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issueKey) })
            }
        },
    })
}
