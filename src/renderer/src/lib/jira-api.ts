import type { JiraIssue, JiraProject, JiraTransition, JiraUser, JiraComment, JiraIssueType, JiraSprint } from '../types/jira'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return window.api.jiraRequest({ method, path, body }) as Promise<T>
}

// Agile API (jiný base path)
async function agileRequest<T>(path: string): Promise<T> {
  return window.api.jiraRequest({ method: 'GET', path: `__agile__${path}` }) as Promise<T>
}

export const jiraApi = {
  // Current user
  getMyself(): Promise<JiraUser> {
    return request('GET', '/myself')
  },

  // Issues
  searchIssues(jql: string, maxResults = 100, nextPageToken?: string): Promise<{ issues: JiraIssue[]; total: number; nextPageToken?: string }> {
    const body: Record<string, unknown> = {
      jql,
      maxResults,
      fields: ['summary', 'status', 'priority', 'issuetype', 'project', 'assignee', 'reporter', 'created', 'updated', 'duedate', 'labels', 'comment', 'subtasks', 'parent', 'timeestimate', 'timespent', 'customfield_10016', 'customfield_10014', 'customfield_10020', 'description']
    }
    if (nextPageToken) body.nextPageToken = nextPageToken
    return request('POST', `/search/jql`, body)
  },

  getIssue(key: string): Promise<JiraIssue> {
    return request('GET', `/issue/${key}?fields=summary,status,priority,issuetype,project,assignee,reporter,created,updated,duedate,labels,comment,subtasks,parent,timeestimate,timespent,customfield_10016,customfield_10020,description`)
  },

  updateIssue(key: string, fields: Record<string, unknown>): Promise<void> {
    return request('PUT', `/issue/${key}`, { fields })
  },

  createIssue(fields: Record<string, unknown>): Promise<{ id: string; key: string }> {
    return request('POST', '/issue', { fields })
  },

  // Transitions
  getTransitions(key: string): Promise<{ transitions: JiraTransition[] }> {
    return request('GET', `/issue/${key}/transitions`)
  },

  doTransition(key: string, transitionId: string): Promise<void> {
    return request('POST', `/issue/${key}/transitions`, { transition: { id: transitionId } })
  },

  // Comments
  addComment(key: string, text: string): Promise<JiraComment> {
    return request('POST', `/issue/${key}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
      }
    })
  },

  // Projects
  getProjects(): Promise<JiraProject[]> {
    return request('GET', '/project?expand=description&orderBy=name')
  },

  // Issue types pro projekt
  getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    return request<{ issueTypes: JiraIssueType[] }>(
      'GET', `/project/${projectKey}?expand=issueTypes`
    ).then((r) => r.issueTypes ?? [])
  },

  // Assignable users
  getAssignableUsers(projectKey: string): Promise<JiraUser[]> {
    return request('GET', `/user/assignable/search?project=${projectKey}&maxResults=50`)
  },

  assignIssue(key: string, accountId: string | null): Promise<void> {
    return request('PUT', `/issue/${key}/assignee`, { accountId })
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
    return request('POST', '/search/jql', {
      jql: `project = "${projectKey}" AND issuetype = Epic ORDER BY created DESC`,
      maxResults: 50,
      fields: ['summary', 'status', 'issuetype']
    })
  },

  // Labels
  getLabels(): Promise<{ values: string[] }> {
    return request('GET', '/label?maxResults=100')
  },

  // Worklog — zalogovat čas do Jiry
  logWork(issueKey: string, timeSpentSeconds: number, comment?: string): Promise<void> {
    return request('POST', `/issue/${issueKey}/worklog`, {
      timeSpentSeconds,
      comment: comment ? {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }]
      } : undefined
    })
  }
}
