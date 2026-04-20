import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraProject } from '../../types/jira'

export async function getProjectsRequest(): Promise<JiraProject[]> {
    return request('GET', '/project?expand=description&orderBy=name')
}

export function useProjectsQuery(
    options?: Pick<UseQueryOptions<JiraProject[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraProject[]>({
        ...options,
        queryKey: queryKeys.projects.list(),
        queryFn: getProjectsRequest,
    })
}
