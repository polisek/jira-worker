import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraChangelog } from '../../types/jira'

export async function getIssueChangelogRequest(issueKey: string): Promise<{ values: JiraChangelog[]; total: number }> {
    return request('GET', `/issue/${issueKey}/changelog?maxResults=100`)
}

export function useIssueChangelogQuery(
    issueKey: string,
    options?: Pick<UseQueryOptions<{ values: JiraChangelog[]; total: number }>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<{ values: JiraChangelog[]; total: number }>({
        ...options,
        queryKey: queryKeys.issues.changelog(issueKey),
        queryFn: () => getIssueChangelogRequest(issueKey),
        enabled: !!issueKey && (options?.enabled ?? true),
    })
}
