import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { agileRequest } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraSprint } from '../../types/jira'

export async function getBoardSprintsRequest(boardId: number): Promise<{ values: JiraSprint[] }> {
    return agileRequest(`/board/${boardId}/sprint?state=active,future&maxResults=20`)
}

export function useBoardSprintsQuery(
    boardId: number,
    options?: Pick<UseQueryOptions<{ values: JiraSprint[] }>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<{ values: JiraSprint[] }>({
        ...options,
        queryKey: queryKeys.boards.sprints(boardId),
        queryFn: () => getBoardSprintsRequest(boardId),
        enabled: !!boardId && (options?.enabled ?? true),
    })
}
