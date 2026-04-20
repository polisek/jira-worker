import useWorkLogViewController, { type WorkLogViewControllerProps } from "./useWorkLogView.controller"
import useWorkLogViewData, { type WorkLogViewDataProps } from "./useWorkLogView.data"
import type { AppPrefs, JiraProject } from "../../../types/jira"

export type useWorkLogViewProps = {
    prefs: AppPrefs
    selectedProject: JiraProject | null
}

export type WorkLogViewProps = useWorkLogViewProps & {
    controllerProps: WorkLogViewControllerProps
    dataProps: WorkLogViewDataProps
}

const useWorkLogView = ({ prefs, selectedProject }: useWorkLogViewProps): WorkLogViewProps => {
    const controllerProps = useWorkLogViewController()
    const dataProps = useWorkLogViewData({
        selectedUser: controllerProps.selectedUser,
        currentMonth: controllerProps.currentMonth,
        selectedProject,
    })

    return {
        prefs,
        selectedProject,
        controllerProps,
        dataProps,
    }
}

export default useWorkLogView
