import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraIssue } from '../../types/jira'

export async function getIssueRequest(key: string): Promise<JiraIssue> {
    return request(
        'GET',
        `/issue/${key}?fields=summary,status,priority,issuetype,project,assignee,reporter,created,updated,duedate,labels,comment,subtasks,parent,timeestimate,timespent,timeoriginalestimate,customfield_10016,customfield_10014,customfield_10020,description,attachment`
    )
}

export function useIssueQuery(
    key: string,
    options?: Pick<UseQueryOptions<JiraIssue>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraIssue>({
        ...options,
        queryKey: queryKeys.issues.detail(key),
        queryFn: () => getIssueRequest(key),
        enabled: !!key && (options?.enabled ?? true),
    })
}
