import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraStatus } from '../../types/jira'

interface ProjectStatusGroup {
    id: string
    name: string
    statuses: JiraStatus[]
}

export async function getProjectStatusesRequest(projectKey: string): Promise<ProjectStatusGroup[]> {
    return request('GET', `/project/${projectKey}/statuses`)
}

export function useProjectStatusesQuery(
    projectKey: string,
    options?: Pick<UseQueryOptions<ProjectStatusGroup[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<ProjectStatusGroup[]>({
        ...options,
        queryKey: queryKeys.statuses.byProject(projectKey),
        queryFn: () => getProjectStatusesRequest(projectKey),
        enabled: !!projectKey && (options?.enabled ?? true),
    })
}
