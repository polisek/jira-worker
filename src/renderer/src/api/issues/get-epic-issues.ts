import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraIssue } from '../../types/jira'

const EPIC_ISSUE_FIELDS = [
    'summary',
    'status',
    'priority',
    'assignee',
    'issuetype',
    'issuelinks',
    'customfield_10014',
    'customfield_10016',
    'customfield_10020',
    'timeoriginalestimate',
    'parent',
    'subtasks',
]

export async function getEpicIssuesRequest(epicKey: string, projectKey?: string): Promise<JiraIssue[]> {
    const jql = projectKey
        ? `("Epic Link" = ${epicKey} OR parentEpic = ${epicKey} OR parent = ${epicKey}) AND project = "${projectKey}" ORDER BY created ASC`
        : `("Epic Link" = ${epicKey} OR parentEpic = ${epicKey} OR parent = ${epicKey}) ORDER BY created ASC`

    const [{ issues }, epic] = await Promise.all([
        request<{ issues: JiraIssue[] }>('POST', '/search/jql', { jql, maxResults: 100, fields: EPIC_ISSUE_FIELDS }),
        request<JiraIssue>(
            'GET',
            `/issue/${epicKey}?fields=summary,status,priority,assignee,issuetype,issuelinks,subtasks,customfield_10020,timeoriginalestimate`
        ),
    ])

    const allIssues = [epic, ...issues]
    const fetchedKeys = new Set(allIssues.map((i) => i.key))
    const missingSubtaskKeys = allIssues
        .flatMap((i) => i.fields.subtasks?.map((s) => s.key) ?? [])
        .filter((k) => !fetchedKeys.has(k))

    if (missingSubtaskKeys.length === 0) return allIssues

    const { issues: subtasks } = await request<{ issues: JiraIssue[] }>('POST', '/search/jql', {
        jql: `key in (${missingSubtaskKeys.join(', ')})`,
        maxResults: 200,
        fields: EPIC_ISSUE_FIELDS,
    })

    return [...allIssues, ...subtasks]
}

export function useEpicIssuesQuery(
    epicKey: string,
    projectKey?: string,
    options?: Pick<UseQueryOptions<JiraIssue[]>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraIssue[]>({
        ...options,
        queryKey: queryKeys.issues.epicIssues(epicKey, projectKey),
        queryFn: () => getEpicIssuesRequest(epicKey, projectKey),
        enabled: !!epicKey && (options?.enabled ?? true),
    })
}
