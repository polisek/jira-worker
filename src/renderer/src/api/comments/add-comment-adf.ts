import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraComment } from '../../types/jira'

export async function addCommentAdfRequest(key: string, body: Record<string, unknown>): Promise<JiraComment> {
    return request('POST', `/issue/${key}/comment`, { body })
}

export function useAddCommentAdfMutation(key: string) {
    const queryClient = useQueryClient()

    return useMutation<JiraComment, Error, Record<string, unknown>>({
        mutationFn: (body) => addCommentAdfRequest(key, body),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(key) })
        },
    })
}
