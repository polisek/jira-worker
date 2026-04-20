import type {
    JiraIssue,
    JiraProject,
    JiraTransition,
    JiraUser,
    JiraComment,
    JiraIssueType,
    JiraSprint,
    JiraStatus,
    JiraWorklog,
    JiraChangelog,
} from "../types/jira"

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    console.log("[API]", method, path, body)
    const result = (await window.api.jiraRequest({ method, path, body })) as T
    console.log("[API response]", path, result)
    return result
}
// Agile API (jiný base path)
async function agileRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    console.log("[AGILE API]", method, path, body)
    const result = (await window.api.jiraRequest({ method, path: `__agile__${path}`, body })) as T
    console.log("[AGILE API response]", path, result)
    return result
}

export const jiraApi = {
    // Current user
    getMyself(): Promise<JiraUser> {
        return request("GET", "/myself")
    },

    // Issues
    searchIssues(
        jql: string,
        maxResults = 100,
        nextPageToken?: string
    ): Promise<{ issues: JiraIssue[]; total: number; nextPageToken?: string }> {
        const body: Record<string, unknown> = {
            jql,
            maxResults,
            fields: [
                "summary",
                "status",
                "priority",
                "issuetype",
                "project",
                "assignee",
                "reporter",
                "created",
                "updated",
                "duedate",
                "labels",
                "comment",
                "subtasks",
                "parent",
                "timeestimate",
                "timespent",
                "customfield_10016",
                "customfield_10014",
                "customfield_10020",
                "description",
            ],
        }
        if (nextPageToken) body.nextPageToken = nextPageToken
        return request("POST", `/search/jql`, body)
    },

    getIssue(key: string): Promise<JiraIssue> {
        return request(
            "GET",
            `/issue/${key}?fields=summary,status,priority,issuetype,project,assignee,reporter,created,updated,duedate,labels,comment,subtasks,parent,timeestimate,timespent,timeoriginalestimate,customfield_10016,customfield_10014,customfield_10020,description,attachment`
        )
    },

    getIssueTime(key: string): Promise<{ timespent: number | null; timeestimate: number | null; timeoriginalestimate: number | null }> {
        return request<{ fields: any }>("GET", `/issue/${key}?fields=timespent,timeestimate,timeoriginalestimate`)
            .then((r) => r.fields)
    },

    updateIssue(key: string, fields: Record<string, unknown>): Promise<void> {
        return request("PUT", `/issue/${key}`, { fields })
    },

    createIssue(fields: Record<string, unknown>): Promise<{ id: string; key: string }> {
        return request("POST", "/issue", { fields })
    },

    // Transitions
    getTransitions(key: string): Promise<{ transitions: JiraTransition[] }> {
        return request("GET", `/issue/${key}/transitions`)
    },

    doTransition(key: string, transitionId: string): Promise<void> {
        return request("POST", `/issue/${key}/transitions`, { transition: { id: transitionId } })
    },

    // Comments
    addComment(key: string, text: string): Promise<JiraComment> {
        return request("POST", `/issue/${key}/comment`, {
            body: {
                type: "doc",
                version: 1,
                content: [{ type: "paragraph", content: [{ type: "text", text }] }],
            },
        })
    },

    // Projects
    getProjects(): Promise<JiraProject[]> {
        return request("GET", "/project?expand=description&orderBy=name")
    },

    // Issue types pro projekt
    getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
        return request<{ issueTypes: JiraIssueType[] }>("GET", `/project/${projectKey}?expand=issueTypes`).then(
            (r) => r.issueTypes ?? []
        )
    },

    // Assignable users
    getAssignableUsers(projectKey: string): Promise<JiraUser[]> {
        return request("GET", `/user/assignable/search?project=${projectKey}&maxResults=50`)
    },

    assignIssue(key: string, accountId: string | null): Promise<void> {
        return request("PUT", `/issue/${key}/assignee`, { accountId })
    },

    // Sprinty přes Agile API
    getBoards(projectKey: string): Promise<{ values: { id: number; name: string }[] }> {
        return agileRequest(`/board?projectKeyOrId=${projectKey}&maxResults=10`)
    },

    getBoardSprints(boardId: number): Promise<{ values: JiraSprint[] }> {
        return agileRequest(`/board/${boardId}/sprint?state=active,future&maxResults=20`)
    },

    // Epics projektu
    getEpics(projectKey: string): Promise<{ issues: JiraIssue[] }> {
        return request("POST", "/search/jql", {
            jql: `project = "${projectKey}" AND issuetype = Epic ORDER BY created DESC`,
            maxResults: 50,
            fields: ["summary", "status", "issuetype"],
        })
    },

    // Labels
    getLabels(): Promise<{ values: string[] }> {
        return request("GET", "/label?maxResults=100")
    },

    // Worklog — zalogovat čas do Jiry
    logWork(issueKey: string, timeSpentSeconds: number, comment?: string, started?: string): Promise<void> {
        return request("POST", `/issue/${issueKey}/worklog`, {
            timeSpentSeconds,
            ...(started ? { started } : {}),
            comment: comment
                ? {
                      type: "doc",
                      version: 1,
                      content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }],
                  }
                : undefined,
        })
    },

    getIssueWorklogs(issueKey: string, startedAfter?: number): Promise<{ worklogs: JiraWorklog[]; total: number }> {
        const qs = startedAfter ? `?startedAfter=${startedAfter}&maxResults=1000` : `?maxResults=1000`
        return request("GET", `/issue/${issueKey}/worklog${qs}`)
    },

    searchUsers(query: string): Promise<JiraUser[]> {
        return request("GET", `/user/search?query=${encodeURIComponent(query)}&maxResults=30`)
    },

    getIssueChangelog(issueKey: string): Promise<{ values: JiraChangelog[]; total: number }> {
        return request("GET", `/issue/${issueKey}/changelog?maxResults=100`)
    },

    // Statusy
    getAllStatuses(): Promise<JiraStatus[]> {
        return request("GET", "/status")
    },

    getProjectStatuses(projectKey: string): Promise<{ id: string; name: string; statuses: JiraStatus[] }[]> {
        return request("GET", `/project/${projectKey}/statuses`)
    },

    // Správa stavů (vyžaduje admin práva v Jira)
    getStatusesForProject(projectId: string): Promise<JiraStatus[]> {
        return request<{ values: JiraStatus[] }>(
            "GET", `/statuses/search?projectId=${projectId}&maxResults=200`
        ).then(r => r.values)
    },

    createStatuses(
        statuses: { name: string; statusCategory: "TODO" | "IN_PROGRESS" | "DONE"; description?: string }[],
        projectId: string
    ): Promise<JiraStatus[]> {
        return request("POST", "/statuses", {
            scope: { type: "PROJECT", project: { id: projectId } },
            statuses,
        })
    },

    updateStatuses(statuses: { id: string; name: string; statusCategory: "TODO" | "IN_PROGRESS" | "DONE"; description?: string }[]): Promise<void> {
        return request("PUT", "/statuses", { statuses })
    },

    deleteStatus(id: string): Promise<void> {
        return request("DELETE", `/statuses?id=${id}`)
    },

    deleteIssueLink(linkId: string): Promise<void> {
        return request("DELETE", `/issueLink/${linkId}`)
    },

    async createIssueLink(outwardKey: string, inwardKey: string, typeName: "Blocks" | "Relates"): Promise<string> {
        await request("POST", "/issueLink", {
            type: { name: typeName },
            outwardIssue: { key: outwardKey },
            inwardIssue: { key: inwardKey },
        })
        const issue = await request<JiraIssue>("GET", `/issue/${outwardKey}?fields=issuelinks`)
        return issue.fields.issuelinks?.find(l => l.outwardIssue?.key === inwardKey)?.id ?? ""
    },

    getEpicIssues: async (epicKey: string, projectKey?: string): Promise<JiraIssue[]> => {
        const jql = projectKey
            ? `("Epic Link" = ${epicKey} OR parentEpic = ${epicKey} OR parent = ${epicKey}) AND project = "${projectKey}" ORDER BY created ASC`
            : `("Epic Link" = ${epicKey} OR parentEpic = ${epicKey} OR parent = ${epicKey}) ORDER BY created ASC`

        const fields = ["summary", "status", "priority", "assignee", "issuetype", "issuelinks", "customfield_10014", "customfield_10016", "customfield_10020", "timeoriginalestimate", "parent", "subtasks"]

        const [{ issues }, epic] = await Promise.all([
            request<{ issues: JiraIssue[] }>("POST", "/search/jql", { jql, maxResults: 100, fields }),
            request<JiraIssue>("GET", `/issue/${epicKey}?fields=summary,status,priority,assignee,issuetype,issuelinks,subtasks,customfield_10020,timeoriginalestimate`),
        ])

        const allIssues = [epic, ...issues]
        const fetchedKeys = new Set(allIssues.map((i) => i.key))
        const missingSubtaskKeys = allIssues
            .flatMap((i) => i.fields.subtasks?.map((s) => s.key) ?? [])
            .filter((k) => !fetchedKeys.has(k))

        if (missingSubtaskKeys.length === 0) return allIssues

        const { issues: subtasks } = await request<{ issues: JiraIssue[] }>("POST", "/search/jql", {
            jql: `key in (${missingSubtaskKeys.join(", ")})`,
            maxResults: 200,
            fields,
        })

        return [...allIssues, ...subtasks]
    },

    /**
     * Rank one issue before another using Jira Agile API.
     * Works for Epics, Stories, Tasks — anything on an Agile board.
     * @param issueKey  the issue to move
     * @param beforeKey move it BEFORE this issue (pass null to rank AFTER afterKey)
     * @param afterKey  move it AFTER this issue (used when beforeKey is null)
     */
    rankIssue(issueKey: string, beforeKey: string | null, afterKey: string | null): Promise<void> {
        const body: Record<string, unknown> = { issues: [issueKey] }
        if (beforeKey) body.rankBeforeIssue = beforeKey
        else if (afterKey) body.rankAfterIssue = afterKey
        return agileRequest<void>(`/issue/rank`, "PUT", body)
    },

    moveToSprint(sprintId: number, issueKey: string): Promise<void> {
        return agileRequest<void>(`/sprint/${sprintId}/issue`, "POST", { issues: [issueKey] })
    },

    moveToBacklog(issueKey: string): Promise<void> {
        return agileRequest<void>(`/backlog/issue`, "POST", { issues: [issueKey] })
    },

    // Graph layout persistovaný přímo v Jira Issue Properties na epicu
    getGraphLayout(epicKey: string): Promise<{ positions: Record<string, { x: number; y: number }>; updatedAt: number } | null> {
        return request<{ key: string; value: { positions: Record<string, { x: number; y: number }>; updatedAt: number } }>(
            "GET", `/issue/${epicKey}/properties/graph-layout`
        ).then(r => r.value ?? null).catch(() => null)
    },

    saveGraphLayout(epicKey: string, positions: Record<string, { x: number; y: number }>): Promise<void> {
        return request("PUT", `/issue/${epicKey}/properties/graph-layout`, {
            positions,
            updatedAt: Date.now(),
        })
    },
}
