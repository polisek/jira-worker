import type { JiraIssue, JiraProject, JiraTransition, JiraUser, JiraComment } from '../types/jira'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return window.api.jiraRequest({ method, path, body }) as Promise<T>
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
    return request('GET', `/issue/${key}?fields=summary,status,priority,issuetype,project,assignee,reporter,created,updated,duedate,labels,comment,subtasks,parent,timeestimate,timespent,customfield_10016,description`)
  },

  updateIssue(key: string, fields: Record<string, unknown>): Promise<void> {
    return request('PUT', `/issue/${key}`, { fields })
  },

  // Transitions (change status)
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

  // Assignable users
  getAssignableUsers(projectKey: string): Promise<JiraUser[]> {
    return request('GET', `/user/assignable/search?project=${projectKey}&maxResults=50`)
  },

  // Assign issue
  assignIssue(key: string, accountId: string | null): Promise<void> {
    return request('PUT', `/issue/${key}/assignee`, { accountId })
  }
}
