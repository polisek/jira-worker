import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraIssue } from '../../types/jira'

export async function getEpicsRequest(projectKey: string): Promise<{ issues: JiraIssue[] }> {
    return request('POST', '/search/jql', {
        jql: `project = "${projectKey}" AND issuetype = Epic ORDER BY created DESC`,
        maxResults: 50,
        fields: ['summary', 'status', 'issuetype'],
    })
}

export function useEpicsQuery(
    projectKey: string,
    options?: Pick<UseQueryOptions<{ issues: JiraIssue[] }>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<{ issues: JiraIssue[] }>({
        ...options,
        queryKey: queryKeys.epics.list(projectKey),
        queryFn: () => getEpicsRequest(projectKey),
        enabled: !!projectKey && (options?.enabled ?? true),
    })
}
