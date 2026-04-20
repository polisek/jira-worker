import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraStatus } from '../../types/jira'

export async function getAllStatusesRequest(): Promise<JiraStatus[]> {
    return request('GET', '/status')
}

export function useAllStatusesQuery(
    options?: Pick<UseQueryOptions<JiraStatus[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraStatus[]>({
        ...options,
        queryKey: queryKeys.statuses.all(),
        queryFn: getAllStatusesRequest,
    })
}
