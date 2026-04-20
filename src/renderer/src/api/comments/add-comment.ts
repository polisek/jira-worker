import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraComment } from '../../types/jira'

export async function addCommentRequest(key: string, text: string): Promise<JiraComment> {
    return request('POST', `/issue/${key}/comment`, {
        body: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        },
    })
}

export function useAddCommentMutation(key: string) {
    const queryClient = useQueryClient()

    return useMutation<JiraComment, Error, string>({
        mutationFn: (text) => addCommentRequest(key, text),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(key) })
        },
    })
}
