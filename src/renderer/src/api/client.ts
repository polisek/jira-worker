/**
 * Low-level transport helpers — mirror of jira-api.ts request functions.
 * All Jira API calls go through window.api.jiraRequest() → IPC → main process.
 * Credentials never reach the renderer.
 */

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const result = (await window.api.jiraRequest({ method, path, body })) as T
    return result
}

/** Agile API has a different base path (/rest/agile/1.0). Prefix path with __agile__ as signal to main process. */
export async function agileRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const result = (await window.api.jiraRequest({ method, path: `__agile__${path}`, body })) as T
    return result
}
