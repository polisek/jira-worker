import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

interface LogWorkParams {
    timeSpentSeconds: number
    comment?: string
    started?: string
}

export async function logWorkRequest(issueKey: string, params: LogWorkParams): Promise<void> {
    return request('POST', `/issue/${issueKey}/worklog`, {
        timeSpentSeconds: params.timeSpentSeconds,
        ...(params.started ? { started: params.started } : {}),
        comment: params.comment
            ? {
                  type: 'doc',
                  version: 1,
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: params.comment }] }],
              }
            : undefined,
    })
}

export function useLogWorkMutation(issueKey: string) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, LogWorkParams>({
        mutationFn: (params) => logWorkRequest(issueKey, params),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.worklogs(issueKey) })
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.time(issueKey) })
        },
    })
}
