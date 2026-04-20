import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import type { JiraPriority } from '../../types/jira'

export async function getPrioritiesRequest(): Promise<JiraPriority[]> {
    return request('GET', '/priority')
}

export function usePrioritiesQuery(
    options?: Pick<UseQueryOptions<JiraPriority[]>, 'enabled'>
) {
    return useQuery<JiraPriority[]>({
        ...options,
        queryKey: ['priorities'],
        queryFn: getPrioritiesRequest,
        staleTime: 1000 * 60 * 10,
    })
}
