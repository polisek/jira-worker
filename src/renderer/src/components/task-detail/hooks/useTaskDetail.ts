import { useState } from 'react'
import useTaskDetailData, { type TaskDetailDataProps } from './useTaskDetail.data'
import useTaskDetailController, { type TaskDetailControllerProps } from './useTaskDetail.controller'
import { useUpdateIssueMutation } from '../../../api/issues/update-issue'
import type { AppPrefs } from '../../../types/jira'

export type useTaskDetailProps = {
    issueKey: string
    prefs: AppPrefs
    baseUrl?: string
    onClose: () => void
    onOpenGraph?: (epicKey: string) => void
}

export type TitleEditProps = {
    editing: boolean
    draft: string
    saving: boolean
    onDoubleClick: () => void
    onChange: (value: string) => void
    onSave: () => Promise<void>
    onCancel: () => void
}

export type DialogStateProps = {
    logWorkOpen: boolean
    setLogWorkOpen: (open: boolean) => void
    statusManagerOpen: boolean
    setStatusManagerOpen: (open: boolean) => void
}

export type TaskDetailProps = {
    issueKey: string
    prefs: AppPrefs
    baseUrl?: string
    onClose: () => void
    onOpenGraph?: (epicKey: string) => void
    dataProps: TaskDetailDataProps
    controllerProps: TaskDetailControllerProps
    titleEditProps: TitleEditProps
    dialogProps: DialogStateProps
}

const useTaskDetail = ({ issueKey, prefs, baseUrl, onClose, onOpenGraph }: useTaskDetailProps): TaskDetailProps => {
    const controllerProps = useTaskDetailController(issueKey)
    const dataProps = useTaskDetailData(issueKey, controllerProps.currentKey)

    const [editingTitle, setEditingTitle] = useState(false)
    const [titleDraft, setTitleDraft] = useState('')
    const [logWorkOpen, setLogWorkOpen] = useState(false)
    const [statusManagerOpen, setStatusManagerOpen] = useState(false)

    const titleMutation = useUpdateIssueMutation(controllerProps.currentKey)

    const titleEditProps: TitleEditProps = {
        editing: editingTitle,
        draft: titleDraft,
        saving: titleMutation.isPending,
        onDoubleClick: () => {
            if (!dataProps.issue) return
            setTitleDraft(dataProps.issue.fields.summary)
            setEditingTitle(true)
        },
        onChange: setTitleDraft,
        onSave: async () => {
            if (!titleDraft.trim()) return
            await titleMutation.mutateAsync({ summary: titleDraft })
            setEditingTitle(false)
        },
        onCancel: () => setEditingTitle(false),
    }

    const dialogProps: DialogStateProps = {
        logWorkOpen,
        setLogWorkOpen,
        statusManagerOpen,
        setStatusManagerOpen,
    }

    return {
        issueKey,
        prefs,
        baseUrl,
        onClose,
        onOpenGraph,
        dataProps,
        controllerProps,
        titleEditProps,
        dialogProps,
    }
}

export default useTaskDetail
