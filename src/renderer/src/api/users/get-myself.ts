import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraUser } from '../../types/jira'

export async function getMyselfRequest(): Promise<JiraUser> {
    return request('GET', '/myself')
}

export function useMyselfQuery(
    options?: Pick<UseQueryOptions<JiraUser>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraUser>({
        ...options,
        queryKey: queryKeys.users.myself(),
        queryFn: getMyselfRequest,
    })
}
