import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraUser } from '../../types/jira'

export async function searchUsersRequest(query: string): Promise<JiraUser[]> {
    return request('GET', `/user/search?query=${encodeURIComponent(query)}&maxResults=30`)
}

export function useSearchUsersQuery(
    query: string,
    options?: Pick<UseQueryOptions<JiraUser[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraUser[]>({
        ...options,
        queryKey: queryKeys.users.search(query),
        queryFn: () => searchUsersRequest(query),
        enabled: query.length > 0 && (options?.enabled ?? true),
    })
}
