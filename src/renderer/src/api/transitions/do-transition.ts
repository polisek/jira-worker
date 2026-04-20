import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

export async function doTransitionRequest(key: string, transitionId: string): Promise<void> {
    return request('POST', `/issue/${key}/transitions`, { transition: { id: transitionId } })
}

export function useDoTransitionMutation(key: string) {
    const queryClient = useQueryClient()

    return useMutation<void, Error, string>({
        mutationFn: (transitionId) => doTransitionRequest(key, transitionId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(key) })
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.transitions(key) })
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
        },
    })
}
