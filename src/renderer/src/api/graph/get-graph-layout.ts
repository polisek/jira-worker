import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

interface GraphLayout {
    positions: Record<string, { x: number; y: number }>
    updatedAt: number
}

export async function getGraphLayoutRequest(epicKey: string): Promise<GraphLayout | null> {
    return request<{ key: string; value: GraphLayout }>(
        'GET',
        `/issue/${epicKey}/properties/graph-layout`
    )
        .then((r) => r.value ?? null)
        .catch(() => null)
}

export function useGraphLayoutQuery(
    epicKey: string,
    options?: Pick<UseQueryOptions<GraphLayout | null>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<GraphLayout | null>({
        ...options,
        queryKey: queryKeys.graph.layout(epicKey),
        queryFn: () => getGraphLayoutRequest(epicKey),
        enabled: !!epicKey && (options?.enabled ?? true),
    })
}
