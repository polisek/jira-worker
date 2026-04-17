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
    avatarUrls: { "48x48": string }
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
    avatarUrls: { "48x48": string }
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

export interface JiraAttachment {
    id: string
    filename: string
    mimeType: string
    size: number
    content: string // download URL — funguje s Basic auth
}

export interface JiraSprint {
    id: number
    name: string
    state: "active" | "closed" | "future"
    startDate?: string
    endDate?: string
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
        timeoriginalestimate: number | null
        story_points?: number
        customfield_10016?: number // story points
        customfield_10014?: string // epic link
        customfield_10020?: JiraSprint[] // sprints
        attachment?: JiraAttachment[]
    }
}

export interface JiraTransition {
    id: string
    name: string
    to: JiraStatus
}

export type ViewMode = "board" | "list" | "settings" | "time" | "worklog" | "activity"

export interface JiraChangelogItem {
    field: string
    fromString: string | null
    toString: string | null
}

export interface JiraChangelog {
    id: string
    author: JiraUser
    created: string
    items: JiraChangelogItem[]
}

export interface JiraWorklog {
    id: string
    author: JiraUser
    timeSpentSeconds: number
    started: string // ISO datetime
    comment?: { content: ContentNode[] }
}

export interface TimeEntry {
    id: string
    startTime: string // ISO
    endTime: string // ISO
    duration: number // sekundy
    issueKey?: string
    issueSummary?: string
    notes?: string
    loggedToJira?: boolean
}
export type StatusCategory = "todo" | "inprogress" | "done"

export interface AppPrefs {
    doneMaxAgeDays: number // 0 = nezobrazovat, -1 = vše
    defaultFilter: "all" | "mine" | "unassigned"
    defaultView: "board" | "list"
    maxResults: number
    pollIntervalMinutes: number
    notifWindowHours: number
    selectedProjectKey: string | null
    dailyWorkHours: number
    theme: "dark" | "light" | "auto"
    hiddenProjectKeys: string[]
}

export interface AdvancedFilter {
    summary: string
    assignee: JiraUser | null
    reporter: JiraUser | null
    status: JiraStatus | null
}

export interface SavedFilter extends AdvancedFilter {
    id: string
    name: string
}

export const DEFAULT_ADVANCED_FILTER: AdvancedFilter = {
    summary: "",
    assignee: null,
    reporter: null,
    status: null,
}

export const DEFAULT_PREFS: AppPrefs = {
    doneMaxAgeDays: 14,
    defaultFilter: "mine",
    defaultView: "board",
    maxResults: 100,
    pollIntervalMinutes: 2,
    notifWindowHours: 24,
    selectedProjectKey: null,
    dailyWorkHours: 8,
    theme: "dark",
    hiddenProjectKeys: [],
}
