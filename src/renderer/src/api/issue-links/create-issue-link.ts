import { useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'

interface CreateIssueLinkParams {
    outwardKey: string
    inwardKey: string
    typeName: 'Blocks' | 'Relates'
}

export async function createIssueLinkRequest(
    outwardKey: string,
    inwardKey: string,
    typeName: 'Blocks' | 'Relates'
): Promise<string> {
    await request('POST', '/issueLink', {
        type: { name: typeName },
        outwardIssue: { key: outwardKey },
        inwardIssue: { key: inwardKey },
    })
    const issue = await request<{ fields: { issuelinks?: { id: string; outwardIssue?: { key: string } }[] } }>(
        'GET',
        `/issue/${outwardKey}?fields=issuelinks`
    )
    return issue.fields.issuelinks?.find((l) => l.outwardIssue?.key === inwardKey)?.id ?? ''
}

export function useCreateIssueLinkMutation() {
    const queryClient = useQueryClient()

    return useMutation<string, Error, CreateIssueLinkParams>({
        mutationFn: ({ outwardKey, inwardKey, typeName }) =>
            createIssueLinkRequest(outwardKey, inwardKey, typeName),
        onSuccess: async (_, { outwardKey, inwardKey }) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(outwardKey) })
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(inwardKey) })
        },
    })
}
