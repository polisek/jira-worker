import { useState, useMemo } from "react"
import useBoardViewData, { type BoardViewDataProps } from "./useBoardView.data"
import useBoardViewController, { type BoardViewControllerProps } from "./useBoardView.controller"
import type { JiraProject, JiraIssue, AppPrefs, JiraSprint } from "../../../types/jira"

export type useBoardViewProps = {
    selectedProject: JiraProject | null
    projects: JiraProject[]
    filter: "all" | "mine" | "unassigned"
    searchQuery: string
    onSelectIssue: (issue: JiraIssue) => void
    prefs: AppPrefs
}

export type BoardViewDialogProps = {
    showCreate: boolean
    setShowCreate: (open: boolean) => void
    showStatusManager: boolean
    setShowStatusManager: (open: boolean) => void
}

export type BoardViewSprintProps = {
    selectedSprint: string
    setSelectedSprint: (sprint: string) => void
    sprintOpen: boolean
    setSprintOpen: (open: boolean) => void
    sprintLabel: string
    sprints: JiraSprint[]
}

export type BoardViewProps = {
    selectedProject: JiraProject | null
    projects: JiraProject[]
    onSelectIssue: (issue: JiraIssue) => void
    dataProps: BoardViewDataProps
    controllerProps: BoardViewControllerProps
    dialogProps: BoardViewDialogProps
    sprintProps: BoardViewSprintProps
}

const useBoardView = ({
    selectedProject,
    projects,
    filter,
    searchQuery,
    onSelectIssue,
    prefs,
}: useBoardViewProps): BoardViewProps => {
    const [selectedSprint, setSelectedSprint] = useState("active")
    const [sprintOpen, setSprintOpen] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [showStatusManager, setShowStatusManager] = useState(false)

    const dataProps = useBoardViewData({
        selectedProject,
        filter,
        searchQuery,
        prefs,
        sprint: selectedSprint,
    })

    const controllerProps = useBoardViewController({
        rawStatuses: dataProps.rawStatuses,
        issues: dataProps.issues,
        setIssues: dataProps.setIssues,
        refetch: dataProps.refetch,
        selectedProject,
    })

    const sprintLabel = useMemo(() => {
        if (selectedSprint === "active") return "Aktivní sprint"
        if (selectedSprint === "all") return "Všechny sprinty"
        if (selectedSprint === "none") return "Bez sprintu"
        const s = controllerProps.sprints.find((sp) => String(sp.id) === selectedSprint)
        return s?.name ?? "Sprint"
    }, [selectedSprint, controllerProps.sprints])

    return {
        selectedProject,
        projects,
        onSelectIssue,
        dataProps,
        controllerProps,
        dialogProps: {
            showCreate,
            setShowCreate,
            showStatusManager,
            setShowStatusManager,
        },
        sprintProps: {
            selectedSprint,
            setSelectedSprint,
            sprintOpen,
            setSprintOpen,
            sprintLabel,
            sprints: controllerProps.sprints,
        },
    }
}

export default useBoardView
