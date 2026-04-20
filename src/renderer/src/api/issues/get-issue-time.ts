import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

interface IssueTime {
    timespent: number | null
    timeestimate: number | null
    timeoriginalestimate: number | null
}

export async function getIssueTimeRequest(key: string): Promise<IssueTime> {
    return request<{ fields: IssueTime }>('GET', `/issue/${key}?fields=timespent,timeestimate,timeoriginalestimate`).then(
        (r) => r.fields
    )
}

export function useIssueTimeQuery(
    key: string,
    options?: Pick<UseQueryOptions<IssueTime>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<IssueTime>({
        ...options,
        queryKey: queryKeys.issues.time(key),
        queryFn: () => getIssueTimeRequest(key),
        enabled: !!key && (options?.enabled ?? true),
    })
}
