import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

interface UpdateStatusInput {
    id: string
    name: string
    statusCategory: 'TODO' | 'IN_PROGRESS' | 'DONE'
    description?: string
}

export async function updateStatusesRequest(statuses: UpdateStatusInput[]): Promise<void> {
    return request('PUT', '/statuses', { statuses })
}

export function useUpdateStatusesMutation() {
    const queryClient = useQueryClient()

    return useMutation<void, Error, UpdateStatusInput[]>({
        mutationFn: (statuses) => updateStatusesRequest(statuses),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.statuses.all() })
        },
    })
}
