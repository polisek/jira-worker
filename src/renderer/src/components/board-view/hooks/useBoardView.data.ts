import { useState, useEffect, useMemo } from "react"
import { useAllStatusesQuery } from "../../../api/statuses/get-all-statuses"
import { useProjectStatusesQuery } from "../../../api/projects/get-project-statuses"
import { useSearchIssuesQuery } from "../../../api/issues/search-issues"
import type { JiraProject, JiraIssue, AppPrefs, JiraStatus } from "../../../types/jira"

export type BoardViewDataProps = {
    rawStatuses: JiraStatus[]
    issues: JiraIssue[]
    setIssues: React.Dispatch<React.SetStateAction<JiraIssue[]>>
    isLoading: boolean
    error: string | null
    total: number
    refetch: () => void
}

type useBoardViewDataInput = {
    selectedProject: JiraProject | null
    filter: "all" | "mine" | "unassigned"
    searchQuery: string
    prefs: AppPrefs
    sprint: string
}

function buildJql(
    selectedProject: JiraProject | null,
    filter: "all" | "mine" | "unassigned",
    searchQuery: string,
    prefs: AppPrefs,
    sprint: string
): string {
    const parts: string[] = []

    if (selectedProject) parts.push(`project = "${selectedProject.key}"`)

    if (filter === "mine") parts.push("assignee = currentUser()")
    else if (filter === "unassigned") parts.push("assignee is EMPTY")

    if (searchQuery.trim()) {
        const q = searchQuery.trim()
        const isIssueKey = /^[A-Za-z]+-\d+$/.test(q)
        if (isIssueKey) parts.push(`(key = "${q}" OR summary ~ "${q}")`)
        else parts.push(`(summary ~ "${q}" OR description ~ "${q}")`)
    }

    if (sprint === "active") parts.push("sprint in openSprints()")
    else if (sprint === "none") parts.push("sprint is EMPTY")
    else if (sprint && sprint !== "all") parts.push(`sprint = ${sprint}`)

    if (prefs.doneMaxAgeDays === 0) parts.push("statusCategory != Done")
    else if (prefs.doneMaxAgeDays > 0) parts.push(`(statusCategory != Done OR updated >= "-${prefs.doneMaxAgeDays}d")`)

    const where = parts.length > 0 ? parts.join(" AND ") + " " : ""
    return `${where}ORDER BY updated DESC`
}

const useBoardViewData = ({
    selectedProject,
    filter,
    searchQuery,
    prefs,
    sprint,
}: useBoardViewDataInput): BoardViewDataProps => {
    // Debounce search query to avoid excessive refetches during typing
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), searchQuery ? 400 : 0)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const jql = useMemo(
        () => buildJql(selectedProject, filter, debouncedSearch, prefs, sprint),
        [selectedProject, filter, debouncedSearch, prefs, sprint]
    )

    // Statuses
    const projectStatusesQuery = useProjectStatusesQuery(selectedProject?.key ?? "", {
        enabled: !!selectedProject,
    })
    const allStatusesQuery = useAllStatusesQuery({ enabled: !selectedProject })

    const rawStatuses = useMemo<JiraStatus[]>(() => {
        if (selectedProject) {
            const groups = projectStatusesQuery.data ?? []
            const map = new Map<string, JiraStatus>()
            for (const g of groups) {
                for (const s of g.statuses) {
                    if (!map.has(s.id)) map.set(s.id, s)
                }
            }
            return [...map.values()]
        }
        return allStatusesQuery.data ?? []
    }, [selectedProject, projectStatusesQuery.data, allStatusesQuery.data])

    // Issues
    const issuesQuery = useSearchIssuesQuery(jql, prefs.maxResults)

    // Local state for optimistic updates during drag & drop
    const [issues, setIssues] = useState<JiraIssue[]>([])
    useEffect(() => {
        if (issuesQuery.data?.issues) {
            setIssues(issuesQuery.data.issues)
        }
    }, [issuesQuery.data?.issues])

    const statusLoading = selectedProject ? projectStatusesQuery.isLoading : allStatusesQuery.isLoading
    const statusError = selectedProject
        ? (projectStatusesQuery.error as Error | null)
        : (allStatusesQuery.error as Error | null)

    return {
        rawStatuses,
        issues,
        setIssues,
        isLoading: issuesQuery.isFetching || statusLoading,
        error: issuesQuery.isError
            ? ((issuesQuery.error as Error)?.message ?? "Chyba načítání")
            : statusError
              ? (statusError.message ?? "Chyba načítání statusů")
              : null,
        total: issuesQuery.data?.total ?? 0,
        refetch: issuesQuery.refetch,
    }
}

export default useBoardViewData
