import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraIssue } from '../../types/jira'

interface SearchIssuesResult {
    issues: JiraIssue[]
    total: number
    nextPageToken?: string
}

export async function searchIssuesRequest(
    jql: string,
    maxResults = 100,
    nextPageToken?: string
): Promise<SearchIssuesResult> {
    const body: Record<string, unknown> = {
        jql,
        maxResults,
        fields: [
            'summary',
            'status',
            'priority',
            'issuetype',
            'project',
            'assignee',
            'reporter',
            'created',
            'updated',
            'duedate',
            'labels',
            'comment',
            'subtasks',
            'parent',
            'timeestimate',
            'timespent',
            'customfield_10016',
            'customfield_10014',
            'customfield_10020',
            'description',
        ],
    }
    if (nextPageToken) body.nextPageToken = nextPageToken
    return request('POST', '/search/jql', body)
}

export function useSearchIssuesQuery(
    jql: string,
    maxResults = 100,
    nextPageToken?: string,
    options?: Pick<UseQueryOptions<SearchIssuesResult>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<SearchIssuesResult>({
        ...options,
        queryKey: queryKeys.issues.list(jql, maxResults, nextPageToken),
        queryFn: () => searchIssuesRequest(jql, maxResults, nextPageToken),
        enabled: jql.length > 0 && (options?.enabled ?? true),
    })
}
