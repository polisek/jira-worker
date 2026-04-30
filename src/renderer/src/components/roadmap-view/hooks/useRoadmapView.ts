import useRoadmapViewData, { type RoadmapViewDataProps } from './useRoadmapView.data'
import useRoadmapViewController, { type RoadmapViewControllerProps } from './useRoadmapView.controller'
import type { AppPrefs, JiraIssue, JiraProject } from '../../../types/jira'

export type useRoadmapViewProps = {
    selectedProject: JiraProject | null
    prefs: AppPrefs
    onPrefsChange: (prefs: Partial<AppPrefs>) => void
    onIssueSelect: (issue: JiraIssue) => void
}

export type RoadmapViewProps = {
    selectedProject: JiraProject | null
    prefs: AppPrefs
    onIssueSelect: (issue: JiraIssue) => void
    dataProps: RoadmapViewDataProps
    controllerProps: RoadmapViewControllerProps
}

const useRoadmapView = ({
    selectedProject,
    prefs,
    onPrefsChange,
    onIssueSelect,
}: useRoadmapViewProps): RoadmapViewProps => {
    const dataProps = useRoadmapViewData({ selectedProject })
    const controllerProps = useRoadmapViewController({ dataProps, prefs, onPrefsChange })

    return {
        selectedProject,
        prefs,
        onIssueSelect,
        dataProps,
        controllerProps,
    }
}

export default useRoadmapView
