import { useState, useEffect } from "react"
import { useIssueQuery } from "../../../api/issues/get-issue"
import { useTransitionsQuery } from "../../../api/transitions/get-transitions"
import { useAssignableUsersQuery } from "../../../api/users/get-assignable-users"
import { getIssueRequest } from "../../../api/issues/get-issue"
import type { JiraIssue, JiraTransition, JiraUser } from "../../../types/jira"

export type TaskDetailDataProps = {
    issue: JiraIssue | undefined
    transitions: JiraTransition[]
    assignableUsers: JiraUser[]
    parentChain: string[]
    isLoading: boolean
    errorMessage: string | null
    refetch: () => void
}

const useTaskDetailData = (issueKey: string, currentKey: string): TaskDetailDataProps => {
    const projectKey = issueKey.split("-")[0]
    const [parentChain, setParentChain] = useState<string[]>([])

    const issueQuery = useIssueQuery(currentKey)
    const transitionsQuery = useTransitionsQuery(currentKey)
    const assignableQuery = useAssignableUsersQuery(projectKey)

    // Reset parent chain when root issue changes
    useEffect(() => {
        setParentChain([])
    }, [issueKey])

    // Build parent chain only for root issue
    useEffect(() => {
        if (!issueQuery.data || currentKey !== issueKey) return
        buildParentChain(issueQuery.data).then(setParentChain)
    }, [issueQuery.data?.key, issueKey, currentKey])

    return {
        issue: issueQuery.data,
        transitions: transitionsQuery.data?.transitions ?? [],
        assignableUsers: assignableQuery.data ?? [],
        parentChain,
        isLoading: issueQuery.isLoading,
        errorMessage: issueQuery.isError ? ((issueQuery.error as Error)?.message ?? "Chyba načítání") : null,
        refetch: issueQuery.refetch,
    }
}

async function buildParentChain(issue: JiraIssue): Promise<string[]> {
    if (issue.fields.issuetype.name === "Epic") return []

    if (issue.fields.customfield_10014) {
        const epicKey = issue.fields.customfield_10014
        if (!issue.fields.parent || issue.fields.parent.key === epicKey) return [epicKey]
        return [epicKey, issue.fields.parent.key]
    }

    if (!issue.fields.parent) return []

    const parentKey = issue.fields.parent.key
    if (issue.fields.parent.fields.issuetype?.name === "Epic") return [parentKey]

    try {
        const parentIssue = await getIssueRequest(parentKey)
        if (parentIssue.fields.customfield_10014) return [parentIssue.fields.customfield_10014, parentKey]
        if (parentIssue.fields.parent) return [parentIssue.fields.parent.key, parentKey]
    } catch {
        // fallback: show direct parent only
    }
    return [parentKey]
}

export default useTaskDetailData
