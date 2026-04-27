import { useState, useEffect, useCallback, useRef } from "react"
import { searchIssuesRequest } from "../../../api/issues/search-issues"
import type { JiraIssue, JiraProject, AppPrefs } from "../../../types/jira"

export type NodeState = {
    children: JiraIssue[] | null
    loading: boolean
    error: string | null
}

export type TreeViewDataProps = {
    epics: JiraIssue[]
    setEpics: React.Dispatch<React.SetStateAction<JiraIssue[]>>
    epicsLoading: boolean
    epicsError: string | null
    nodeStates: Map<string, NodeState>
    setNodeStates: React.Dispatch<React.SetStateAction<Map<string, NodeState>>>
    loadEpics: (resetTree?: boolean) => void
    loadChildren: (issue: JiraIssue) => void
    loadEpicsRef: React.MutableRefObject<((resetTree?: boolean) => void) | null>
}

type useTVDataInput = {
    selectedProject: JiraProject | null
    searchQuery: string
    prefs: AppPrefs
}

const useTreeViewData = ({ selectedProject, searchQuery, prefs }: useTVDataInput): TreeViewDataProps => {
    const [epics, setEpics] = useState<JiraIssue[]>([])
    const [epicsLoading, setEpicsLoading] = useState(false)
    const [epicsError, setEpicsError] = useState<string | null>(null)
    const [nodeStates, setNodeStates] = useState<Map<string, NodeState>>(new Map())

    const loadEpicsRef = useRef<((resetTree?: boolean) => void) | null>(null)

    const loadEpics = useCallback(
        async (resetTree = true) => {
            setEpicsLoading(true)
            setEpicsError(null)
            if (resetTree) {
                setNodeStates(new Map())
            }
            try {
                const parts: string[] = ["issuetype = Epic"]
                if (selectedProject) parts.push(`project = "${selectedProject.key}"`)
                if (searchQuery.trim()) parts.push(`summary ~ "${searchQuery.trim()}"`)
                const jql = parts.join(" AND ") + " ORDER BY rank ASC"
                const result = await searchIssuesRequest(jql, prefs.maxResults)
                setEpics(result.issues)
            } catch (e: unknown) {
                setEpicsError((e as Error).message)
            } finally {
                setEpicsLoading(false)
            }
        },
        [selectedProject, searchQuery, prefs.maxResults]
    )

    useEffect(() => {
        loadEpicsRef.current = loadEpics
    }, [loadEpics])

    // Debounce for search, immediate for project/prefs changes
    useEffect(() => {
        const timer = setTimeout(loadEpics, searchQuery ? 400 : 0)
        return () => clearTimeout(timer)
    }, [loadEpics, searchQuery])

    const loadChildren = useCallback(async (issue: JiraIssue) => {
        const key = issue.key
        const typeName = issue.fields.issuetype.name.toLowerCase()

        setNodeStates((prev) => {
            const next = new Map(prev)
            next.set(key, { children: prev.get(key)?.children ?? null, loading: true, error: null })
            return next
        })

        try {
            const jql =
                typeName === "epic"
                    ? `(parent = "${key}" OR "Epic Link" = "${key}") ORDER BY rank ASC`
                    : `parent = "${key}" ORDER BY rank ASC`

            const result = await searchIssuesRequest(jql, 100)

            setNodeStates((prev) => {
                const next = new Map(prev)
                next.set(key, { children: result.issues, loading: false, error: null })
                return next
            })
        } catch (e: unknown) {
            setNodeStates((prev) => {
                const next = new Map(prev)
                next.set(key, { children: [], loading: false, error: (e as Error).message })
                return next
            })
        }
    }, [])

    return {
        epics,
        setEpics,
        epicsLoading,
        epicsError,
        nodeStates,
        setNodeStates,
        loadEpics,
        loadChildren,
        loadEpicsRef,
    }
}

export default useTreeViewData
