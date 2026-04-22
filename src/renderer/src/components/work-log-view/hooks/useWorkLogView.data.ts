import { useState, useEffect, useCallback } from "react"
import { searchIssuesRequest } from "../../../api/issues/search-issues"
import { getIssueWorklogsRequest } from "../../../api/worklogs/get-issue-worklogs"
import type { JiraUser, JiraProject } from "../../../types/jira"
import type { WorklogCell, WorklogMap } from "../utils"
import { toDateStr } from "../utils"

export type WorkLogViewDataProps = {
    worklogMap: WorklogMap
    loading: boolean
    error: string | null
    handleLogged: (day: Date, cell: WorklogCell) => void
}

export type useWorkLogViewDataProps = {
    selectedUser: JiraUser | null
    currentMonth: Date
    selectedProject: JiraProject | null
}

const useWorkLogViewData = ({
    selectedUser,
    currentMonth,
    selectedProject,
}: useWorkLogViewDataProps): WorkLogViewDataProps => {
    const [worklogMap, setWorklogMap] = useState<WorklogMap>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadWorklogs = useCallback(async (user: JiraUser, monthStart: Date, project: JiraProject | null) => {
        setLoading(true)
        setError(null)
        const year = monthStart.getFullYear()
        const month = monthStart.getMonth()
        const start = toDateStr(new Date(year, month, 1))
        const end = toDateStr(new Date(year, month + 1, 0))
        const startMs = new Date(year, month, 1).getTime()

        try {
            const projectClause = project ? ` AND project = "${project.key}"` : ""
            const jql = `worklogAuthor = "${user.accountId}" AND worklogDate >= "${start}" AND worklogDate <= "${end}"${projectClause}`
            const { issues } = await searchIssuesRequest(jql, 200)

            const map: WorklogMap = {}
            await Promise.all(
                issues.map(async (issue) => {
                    try {
                        const { worklogs } = await getIssueWorklogsRequest(issue.key, startMs)
                        for (const wl of worklogs) {
                            if (wl.author.accountId !== user.accountId) continue
                            const dateStr = wl.started.slice(0, 10)
                            if (dateStr < start || dateStr > end) continue
                            if (!map[dateStr]) map[dateStr] = []
                            const existing = map[dateStr].find((c) => c.issueKey === issue.key)
                            if (existing) {
                                existing.timeSpentSeconds += wl.timeSpentSeconds
                            } else {
                                map[dateStr].push({
                                    issueKey: issue.key,
                                    issueSummary: issue.fields.summary,
                                    timeSpentSeconds: wl.timeSpentSeconds,
                                })
                            }
                        }
                    } catch {
                        // skip issue if worklog fetch fails
                    }
                })
            )
            setWorklogMap(map)
        } catch (e) {
            setError((e as Error).message ?? "Chyba při načítání worklogů")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!selectedUser) return
        loadWorklogs(selectedUser, currentMonth, selectedProject)
    }, [selectedUser, currentMonth, selectedProject, loadWorklogs])

    const handleLogged = useCallback((day: Date, cell: WorklogCell) => {
        const key = toDateStr(day)
        setWorklogMap((prev) => {
            const existing = prev[key] ?? []
            const idx = existing.findIndex((c) => c.issueKey === cell.issueKey)
            if (idx >= 0) {
                const updated = [...existing]
                updated[idx] = {
                    ...updated[idx],
                    timeSpentSeconds: updated[idx].timeSpentSeconds + cell.timeSpentSeconds,
                }
                return { ...prev, [key]: updated }
            }
            return { ...prev, [key]: [...existing, cell] }
        })
    }, [])

    return { worklogMap, loading, error, handleLogged }
}

export default useWorkLogViewData
