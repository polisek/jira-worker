import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

export async function deleteStatusRequest(id: string): Promise<void> {
    return request('DELETE', `/statuses?id=${id}`)
}

export function useDeleteStatusMutation() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, string>({
        mutationFn: (id) => deleteStatusRequest(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.statuses.all() })
        },
    })
}
