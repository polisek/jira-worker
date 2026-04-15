export interface JiraSettings {
  baseUrl: string
  email: string
  apiToken: string
  defaultProject?: string
}

export interface JiraUser {
  accountId: string
  displayName: string
  emailAddress: string
  avatarUrls: { '48x48': string }
}

export interface JiraPriority {
  id: string
  name: string
  iconUrl: string
}

export interface JiraStatus {
  id: string
  name: string
  statusCategory: {
    id: number
    key: string
    colorName: string
    name: string
  }
}

export interface JiraIssueType {
  id: string
  name: string
  iconUrl: string
}

export interface JiraProject {
  id: string
  key: string
  name: string
  avatarUrls: { '48x48': string }
}

export interface JiraComment {
  id: string
  author: JiraUser
  body: { content: ContentNode[] }
  created: string
  updated: string
}

export interface ContentNode {
  type: string
  text?: string
  content?: ContentNode[]
  attrs?: Record<string, unknown>
}

export interface JiraIssue {
  id: string
  key: string
  self: string
  fields: {
    summary: string
    description: { content: ContentNode[] } | null
    status: JiraStatus
    priority: JiraPriority
    issuetype: JiraIssueType
    project: JiraProject
    assignee: JiraUser | null
    reporter: JiraUser
    created: string
    updated: string
    duedate: string | null
    labels: string[]
    comment: {
      comments: JiraComment[]
      total: number
    }
    subtasks: JiraIssue[]
    parent?: { key: string; fields: { summary: string; status: JiraStatus } }
    timeestimate: number | null
    timespent: number | null
    story_points?: number
    customfield_10016?: number // story points
    customfield_10014?: string // epic link
  }
}

export interface JiraTransition {
  id: string
  name: string
  to: JiraStatus
}

export type ViewMode = 'board' | 'list' | 'settings'
export type StatusCategory = 'todo' | 'inprogress' | 'done'

export interface AppPrefs {
  doneMaxAgeDays: number   // 0 = nezobrazovat, -1 = vše
  defaultFilter: 'all' | 'mine' | 'unassigned'
  defaultView: 'board' | 'list'
  maxResults: number
  pollIntervalMinutes: number
  notifWindowHours: number
}

export const DEFAULT_PREFS: AppPrefs = {
  doneMaxAgeDays: 14,
  defaultFilter: 'mine',
  defaultView: 'board',
  maxResults: 100,
  pollIntervalMinutes: 2,
  notifWindowHours: 24
}
