import { useState } from 'react'
import useCreateIssueModalData, { type CreateIssueModalDataProps } from './useCreateIssueModal.data'
import useCreateIssueModalController, { type CreateIssueModalControllerProps } from './useCreateIssueModal.controller'
import type { JiraProject, JiraIssue } from '../../../types/jira'

export type useCreateIssueModalProps = {
    projects: JiraProject[]
    defaultProject: JiraProject | null
    onClose: () => void
    onCreated: (issue: JiraIssue) => void
    defaultEpic?: JiraIssue | null
    defaultParentKey?: string
    defaultIssueTypeName?: string
}

export type CreateIssueModalProps = {
    projects: JiraProject[]
    project: JiraProject | null
    setProject: (p: JiraProject | null) => void
    onClose: () => void
    defaultEpic?: JiraIssue | null
    defaultParentKey?: string
    defaultIssueTypeName?: string
    dataProps: CreateIssueModalDataProps
    controllerProps: CreateIssueModalControllerProps
}

const useCreateIssueModal = ({
    projects,
    defaultProject,
    onClose,
    onCreated,
    defaultEpic,
    defaultParentKey,
    defaultIssueTypeName,
}: useCreateIssueModalProps): CreateIssueModalProps => {
    const [project, setProject] = useState<JiraProject | null>(defaultProject ?? projects[0] ?? null)

    const dataProps = useCreateIssueModalData({
        projectKey: project?.key ?? '',
        defaultEpic,
        defaultParentKey,
    })

    const controllerProps = useCreateIssueModalController({
        project,
        dataProps,
        defaultEpic,
        defaultParentKey,
        defaultIssueTypeName,
        onCreated,
        onClose,
    })

    return {
        projects,
        project,
        setProject,
        onClose,
        defaultEpic,
        defaultParentKey,
        defaultIssueTypeName,
        dataProps,
        controllerProps,
    }
}

export default useCreateIssueModal
