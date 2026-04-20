import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraIssueType } from '../../types/jira'

export async function getIssueTypesRequest(projectKey: string): Promise<JiraIssueType[]> {
    return request<{ issueTypes: JiraIssueType[] }>('GET', `/project/${projectKey}?expand=issueTypes`).then(
        (r) => r.issueTypes ?? []
    )
}

export function useIssueTypesQuery(
    projectKey: string,
    options?: Pick<UseQueryOptions<JiraIssueType[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraIssueType[]>({
        ...options,
        queryKey: queryKeys.projects.issueTypes(projectKey),
        queryFn: () => getIssueTypesRequest(projectKey),
        enabled: !!projectKey && (options?.enabled ?? true),
    })
}
