import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

export async function getLabelsRequest(): Promise<{ values: string[] }> {
    return request('GET', '/label?maxResults=100')
}

export function useLabelsQuery(
    options?: Pick<UseQueryOptions<{ values: string[] }>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<{ values: string[] }>({
        ...options,
        queryKey: queryKeys.labels.list(),
        queryFn: getLabelsRequest,
    })
}
