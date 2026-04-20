import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { agileRequest } from '../client'
import { queryKeys } from '../queryKeys'

interface BoardItem {
    id: number
    name: string
}

export async function getBoardsRequest(projectKey: string): Promise<{ values: BoardItem[] }> {
    return agileRequest(`/board?projectKeyOrId=${projectKey}&maxResults=10`)
}

export function useBoardsQuery(
    projectKey: string,
    options?: Pick<UseQueryOptions<{ values: BoardItem[] }>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<{ values: BoardItem[] }>({
        ...options,
        queryKey: queryKeys.boards.list(projectKey),
        queryFn: () => getBoardsRequest(projectKey),
        enabled: !!projectKey && (options?.enabled ?? true),
    })
}
