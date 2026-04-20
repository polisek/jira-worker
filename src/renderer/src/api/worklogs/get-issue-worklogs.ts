import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraWorklog } from '../../types/jira'

interface IssueWorklogsResult {
    worklogs: JiraWorklog[]
    total: number
}

export async function getIssueWorklogsRequest(issueKey: string, startedAfter?: number): Promise<IssueWorklogsResult> {
    const qs = startedAfter ? `?startedAfter=${startedAfter}&maxResults=1000` : `?maxResults=1000`
    return request('GET', `/issue/${issueKey}/worklog${qs}`)
}

export function useIssueWorklogsQuery(
    issueKey: string,
    startedAfter?: number,
    options?: Pick<UseQueryOptions<IssueWorklogsResult>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<IssueWorklogsResult>({
        ...options,
        queryKey: queryKeys.issues.worklogs(issueKey, startedAfter),
        queryFn: () => getIssueWorklogsRequest(issueKey, startedAfter),
        enabled: !!issueKey && (options?.enabled ?? true),
    })
}
