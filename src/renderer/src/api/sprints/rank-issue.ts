import { useMutation, useQueryClient } from '@tanstack/react-query'
import { agileRequest } from '../client'
import { queryKeys } from '../queryKeys'

interface RankIssueParams {
    issueKey: string
    beforeKey: string | null
    afterKey: string | null
}

export async function rankIssueRequest(
    issueKey: string,
    beforeKey: string | null,
    afterKey: string | null
): Promise<void> {
    const body: Record<string, unknown> = { issues: [issueKey] }
    if (beforeKey) body.rankBeforeIssue = beforeKey
    else if (afterKey) body.rankAfterIssue = afterKey
    return agileRequest<void>('/issue/rank', 'PUT', body)
}

export function useRankIssueMutation() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, RankIssueParams>({
        mutationFn: ({ issueKey, beforeKey, afterKey }) => rankIssueRequest(issueKey, beforeKey, afterKey),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
        },
    })
}
