import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraStatus } from '../../types/jira'

export async function getStatusesForProjectRequest(projectId: string): Promise<JiraStatus[]> {
    return request<{ values: JiraStatus[] }>(
        'GET',
        `/statuses/search?projectId=${projectId}&maxResults=200`
    ).then((r) => r.values)
}

export function useStatusesForProjectQuery(
    projectId: string,
    options?: Pick<UseQueryOptions<JiraStatus[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraStatus[]>({
        ...options,
        queryKey: queryKeys.statuses.forProject(projectId),
        queryFn: () => getStatusesForProjectRequest(projectId),
        enabled: !!projectId && (options?.enabled ?? true),
    })
}
