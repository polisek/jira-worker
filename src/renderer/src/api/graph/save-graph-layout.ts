import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

export async function saveGraphLayoutRequest(
    epicKey: string,
    positions: Record<string, { x: number; y: number }>
): Promise<void> {
    return request('PUT', `/issue/${epicKey}/properties/graph-layout`, {
        positions,
        updatedAt: Date.now(),
    })
}

export function useSaveGraphLayoutMutation(epicKey: string) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, Record<string, { x: number; y: number }>>({
        mutationFn: (positions) => saveGraphLayoutRequest(epicKey, positions),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.graph.layout(epicKey) })
        },
    })
}
