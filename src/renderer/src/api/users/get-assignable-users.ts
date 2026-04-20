import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraUser } from '../../types/jira'

export async function getAssignableUsersRequest(projectKey: string): Promise<JiraUser[]> {
    return request('GET', `/user/assignable/search?project=${projectKey}&maxResults=50`)
}

export function useAssignableUsersQuery(
    projectKey: string,
    options?: Pick<UseQueryOptions<JiraUser[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraUser[]>({
        ...options,
        queryKey: queryKeys.users.assignable(projectKey),
        queryFn: () => getAssignableUsersRequest(projectKey),
        enabled: !!projectKey && (options?.enabled ?? true),
    })
}
