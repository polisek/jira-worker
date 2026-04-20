import { useState, useEffect, useCallback } from "react"
import { jiraApi } from "../utils/jira-api"
import type { JiraIssue, JiraProject, AppPrefs, AdvancedFilter } from "../types/jira"

interface Options {
    selectedProject: JiraProject | null
    filter: "all" | "mine" | "unassigned"
    searchQuery: string
    prefs: AppPrefs
    sprint?: string // 'active' | 'all' | 'none' | sprint id
    advancedFilter?: AdvancedFilter | null
    assigneeAccountId?: string // přepíše currentUser() pro filter="mine"
    updatedSince?: string      // "YYYY-MM-DD" — přidá updated >= podmínku
}

export function useIssues({ selectedProject, filter, searchQuery, prefs, sprint, advancedFilter, assigneeAccountId, updatedSince }: Options) {
    const [issues, setIssues] = useState<JiraIssue[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [total, setTotal] = useState(0)

    const buildJql = useCallback(() => {
        const parts: string[] = []

        if (selectedProject) {
            parts.push(`project = "${selectedProject.key}"`)
        }

        if (filter === "mine") {
            parts.push(assigneeAccountId ? `assignee = "${assigneeAccountId}"` : "assignee = currentUser()")
        } else if (filter === "unassigned") {
            parts.push("assignee is EMPTY")
        }

        if (updatedSince) {
            parts.push(`updated >= "${updatedSince}"`)
        }

        if (searchQuery.trim()) {
            parts.push(`(summary ~ "${searchQuery.trim()}" OR description ~ "${searchQuery.trim()}")`)
        }

        // Sprint filtr
        if (sprint === "active") {
            parts.push("sprint in openSprints()")
        } else if (sprint === "none") {
            parts.push("sprint is EMPTY")
        } else if (sprint && sprint !== "all") {
            parts.push(`sprint = ${sprint}`)
        }

        if (advancedFilter?.summary?.trim()) {
            parts.push(`summary ~ "${advancedFilter.summary.trim()}"`)
        }
        if (advancedFilter?.assignee) {
            parts.push(`assignee = "${advancedFilter.assignee.accountId}"`)
        }
        if (advancedFilter?.reporter) {
            parts.push(`reporter = "${advancedFilter.reporter.accountId}"`)
        }
        if (advancedFilter?.status) {
            parts.push(`status = "${advancedFilter.status.name}"`)
        }

        // Filtr dokončených tasků podle stáří
        if (prefs.doneMaxAgeDays === 0) {
            parts.push("statusCategory != Done")
        } else if (prefs.doneMaxAgeDays > 0) {
            parts.push(`(statusCategory != Done OR updated >= "-${prefs.doneMaxAgeDays}d")`)
        }

        const where = parts.length > 0 ? parts.join(" AND ") + " " : ""
        console.log(where)
        return `${where}ORDER BY updated DESC`
    }, [selectedProject, filter, searchQuery, prefs.doneMaxAgeDays, sprint, advancedFilter, assigneeAccountId, updatedSince])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const jql = buildJql()
            const result = await jiraApi.searchIssues(jql, prefs.maxResults)
            setIssues(result.issues)
            setTotal(result.total)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [buildJql, prefs.maxResults])

    useEffect(() => {
        const timer = setTimeout(load, searchQuery ? 400 : 0)
        return () => clearTimeout(timer)
    }, [load, searchQuery])

    return { issues, setIssues, loading, error, total, reload: load }
}
