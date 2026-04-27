import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createIssueRequest } from '../../../api/issues/create-issue'
import { getIssueRequest } from '../../../api/issues/get-issue'
import { queryKeys } from '../../../api/queryKeys'
import type { RichTextEditorRef } from '../../rich-text-editor'
import type { JiraProject, JiraIssue, JiraIssueType, JiraUser, JiraSprint } from '../../../types/jira'
import type { CreateIssueModalDataProps } from './useCreateIssueModal.data'

export const PRIORITIES = [
    { name: 'Highest', color: 'text-red-400' },
    { name: 'High', color: 'text-orange-400' },
    { name: 'Medium', color: 'text-yellow-400' },
    { name: 'Low', color: 'text-blue-400' },
    { name: 'Lowest', color: 'text-gray-400' },
]

export type CreateIssueModalControllerProps = {
    descriptionRef: React.RefObject<RichTextEditorRef>
    summary: string
    setSummary: (v: string) => void
    issueType: JiraIssueType | null
    setIssueType: (t: JiraIssueType | null) => void
    priority: string
    setPriority: (v: string) => void
    assignee: JiraUser | null
    setAssignee: (u: JiraUser | null) => void
    sprint: JiraSprint | null
    setSprint: (s: JiraSprint | null) => void
    storyPoints: string
    setStoryPoints: (v: string) => void
    labels: string[]
    labelInput: string
    setLabelInput: (v: string) => void
    epic: JiraIssue | null
    setEpic: (e: JiraIssue | null) => void
    submitting: boolean
    error: string | null
    success: boolean
    handleSubmit: () => Promise<void>
    addLabel: () => void
    removeLabel: (l: string) => void
}

type useCIMControllerInput = {
    project: JiraProject | null
    dataProps: CreateIssueModalDataProps
    defaultEpic?: JiraIssue | null
    defaultParentKey?: string
    defaultIssueTypeName?: string
    onCreated: (issue: JiraIssue) => void
    onClose: () => void
}

const useCreateIssueModalController = ({
    project,
    dataProps,
    defaultEpic,
    defaultParentKey,
    defaultIssueTypeName,
    onCreated,
    onClose,
}: useCIMControllerInput): CreateIssueModalControllerProps => {
    const queryClient = useQueryClient()
    const descriptionRef = useRef<RichTextEditorRef>(null)

    const [summary, setSummary] = useState('')
    const [issueType, setIssueType] = useState<JiraIssueType | null>(null)
    const [priority, setPriority] = useState('Medium')
    const [assignee, setAssignee] = useState<JiraUser | null>(null)
    const [sprint, setSprint] = useState<JiraSprint | null>(null)
    const [storyPoints, setStoryPoints] = useState('')
    const [labels, setLabels] = useState<string[]>([])
    const [labelInput, setLabelInput] = useState('')
    const [epic, setEpic] = useState<JiraIssue | null>(defaultEpic ?? null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Reset form fields when project changes
    useEffect(() => {
        setIssueType(null)
        setSprint(null)
        setAssignee(null)
        setEpic(defaultEpic ?? null)
    }, [project?.key, defaultEpic])

    // Sync default issueType when filteredIssueTypes load
    useEffect(() => {
        const types = dataProps.filteredIssueTypes
        if (types.length === 0) return
        if (defaultParentKey) {
            setIssueType(types[0] ?? null)
        } else if (defaultIssueTypeName) {
            setIssueType(
                types.find((t) => t.name.toLowerCase() === defaultIssueTypeName.toLowerCase()) ??
                    types.find((t) => t.name === 'Story') ??
                    types.find((t) => t.name === 'Task') ??
                    types[0] ??
                    null
            )
        } else {
            setIssueType(
                types.find((t) => t.name === 'Story') ??
                    types.find((t) => t.name === 'Task') ??
                    types[0] ??
                    null
            )
        }
    }, [dataProps.filteredIssueTypes, defaultIssueTypeName, defaultParentKey])

    // Sync default sprint when sprints load
    useEffect(() => {
        const sp = dataProps.sprints
        if (sp.length === 0) return
        if (!defaultParentKey) {
            setSprint(sp.find((s) => s.state === 'active') ?? null)
        } else {
            setSprint(null)
        }
    }, [dataProps.sprints, defaultParentKey])

    const handleSubmit = useCallback(async () => {
        if (!project || !summary.trim() || !issueType) return
        setSubmitting(true)
        setError(null)

        const fields: Record<string, unknown> = {
            project: { key: project.key },
            summary: summary.trim(),
            issuetype: { id: issueType.id },
            priority: { name: priority },
        }

        const descAdf = descriptionRef.current?.getAdf()
        if (descAdf && !descriptionRef.current?.isEmpty()) fields.description = descAdf
        if (assignee) fields.assignee = { accountId: assignee.accountId }
        if (sprint) fields.customfield_10020 = sprint.id
        if (storyPoints !== '') fields.customfield_10016 = Number(storyPoints)
        if (labels.length > 0) fields.labels = labels
        if (defaultParentKey) fields.parent = { key: defaultParentKey }

        const epicKey = epic?.key ?? null

        try {
            if (epicKey) fields.parent = { key: epicKey }
            const created = await createIssueRequest(fields)
            await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
            const full = await getIssueRequest(created.key)
            setSuccess(true)
            setTimeout(() => {
                onCreated(full)
                onClose()
            }, 800)
        } catch (e) {
            // If next-gen parent link failed with 400, retry with classic epic-link field
            if (epicKey && String((e as Error).message).includes('400')) {
                try {
                    delete fields.parent
                    fields.customfield_10014 = epicKey
                    const created = await createIssueRequest(fields)
                    await queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists() })
                    const full = await getIssueRequest(created.key)
                    setSuccess(true)
                    setTimeout(() => {
                        onCreated(full)
                        onClose()
                    }, 800)
                    return
                } catch (e2) {
                    setError((e2 as Error).message)
                }
            } else {
                setError((e as Error).message)
            }
        } finally {
            setSubmitting(false)
        }
    }, [project, summary, issueType, priority, assignee, sprint, storyPoints, labels, defaultParentKey, epic, queryClient, onCreated, onClose])

    const addLabel = useCallback(() => {
        const l = labelInput.trim()
        if (l && !labels.includes(l)) setLabels((prev) => [...prev, l])
        setLabelInput('')
    }, [labelInput, labels])

    const removeLabel = useCallback((l: string) => {
        setLabels((prev) => prev.filter((x) => x !== l))
    }, [])

    return {
        descriptionRef,
        summary,
        setSummary,
        issueType,
        setIssueType,
        priority,
        setPriority,
        assignee,
        setAssignee,
        sprint,
        setSprint,
        storyPoints,
        setStoryPoints,
        labels,
        labelInput,
        setLabelInput,
        epic,
        setEpic,
        submitting,
        error,
        success,
        handleSubmit,
        addLabel,
        removeLabel,
    }
}

export default useCreateIssueModalController
