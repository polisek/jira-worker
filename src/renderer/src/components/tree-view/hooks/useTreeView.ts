import useTreeViewData, { type TreeViewDataProps } from "./useTreeView.data"
import useTreeViewController, { type TreeViewControllerProps } from "./useTreeView.controller"
import type { JiraIssue, JiraProject, AppPrefs } from "../../../types/jira"

export type useTreeViewProps = {
    selectedProject: JiraProject | null
    projects: JiraProject[]
    searchQuery: string
    onSelectIssue: (issue: JiraIssue) => void
    prefs: AppPrefs
}

export type TreeViewProps = {
    selectedProject: JiraProject | null
    projects: JiraProject[]
    onSelectIssue: (issue: JiraIssue) => void
    dataProps: TreeViewDataProps
    controllerProps: TreeViewControllerProps
}

const useTreeView = ({
    selectedProject,
    projects,
    searchQuery,
    onSelectIssue,
    prefs,
}: useTreeViewProps): TreeViewProps => {
    const dataProps = useTreeViewData({ selectedProject, searchQuery, prefs })
    const controllerProps = useTreeViewController(dataProps)

    return {
        selectedProject,
        projects,
        onSelectIssue,
        dataProps,
        controllerProps,
    }
}

export default useTreeView
