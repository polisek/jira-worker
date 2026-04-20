import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraTransition } from '../../types/jira'

export async function getTransitionsRequest(key: string): Promise<{ transitions: JiraTransition[] }> {
    return request('GET', `/issue/${key}/transitions`)
}

export function useTransitionsQuery(
    key: string,
    options?: Pick<UseQueryOptions<{ transitions: JiraTransition[] }>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<{ transitions: JiraTransition[] }>({
        ...options,
        queryKey: queryKeys.issues.transitions(key),
        queryFn: () => getTransitionsRequest(key),
        enabled: !!key && (options?.enabled ?? true),
    })
}
