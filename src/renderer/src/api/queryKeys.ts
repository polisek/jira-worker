/**
 * Centralized React Query cache key registry.
 * Use the base-level keys (without params) for invalidateQueries to hit all variants.
 */
export const queryKeys = {
    myself: {
        detail: () => ['myself'] as const,
    },

    issues: {
        all: () => ['issues'] as const,
        lists: () => ['issues', 'list'] as const,
        list: (jql: string, maxResults: number, nextPageToken?: string) =>
            ['issues', 'list', jql, maxResults, nextPageToken].filter((v) => v !== undefined) as readonly unknown[],
        detail: (key: string) => ['issues', 'detail', key] as const,
        time: (key: string) => ['issues', 'time', key] as const,
        transitions: (key: string) => ['issues', 'transitions', key] as const,
        changelog: (key: string) => ['issues', 'changelog', key] as const,
        worklogs: (key: string, startedAfter?: number) =>
            ['issues', 'worklogs', key, startedAfter].filter((v) => v !== undefined) as readonly unknown[],
        epicIssues: (epicKey: string, projectKey?: string) =>
            ['issues', 'epic', epicKey, projectKey].filter((v) => v !== undefined) as readonly unknown[],
    },

    projects: {
        all: () => ['projects'] as const,
        list: () => ['projects', 'list'] as const,
        issueTypes: (projectKey: string) => ['projects', 'issueTypes', projectKey] as const,
        statuses: (projectKey: string) => ['projects', 'statuses', projectKey] as const,
    },

    users: {
        myself: () => ['users', 'myself'] as const,
        assignable: (projectKey: string) => ['users', 'assignable', projectKey] as const,
        search: (query: string) => ['users', 'search', query] as const,
    },

    boards: {
        list: (projectKey: string) => ['boards', 'list', projectKey] as const,
        allSprints: () => ['boards', 'sprints'] as const,
        sprints: (boardId: number) => ['boards', 'sprints', boardId] as const,
    },

    epics: {
        list: (projectKey: string) => ['epics', 'list', projectKey] as const,
    },

    labels: {
        list: () => ['labels', 'list'] as const,
    },

    statuses: {
        all: () => ['statuses', 'all'] as const,
        forProject: (projectId: string) => ['statuses', 'project', projectId] as const,
        byProject: (projectKey: string) => ['statuses', 'byProject', projectKey] as const,
    },

    graph: {
        layout: (epicKey: string) => ['graph', 'layout', epicKey] as const,
    },

    priorities: {
        list: () => ['priorities'] as const,
    },
}
