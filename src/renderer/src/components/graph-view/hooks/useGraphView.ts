import { useEffect, useState } from "react"
import useGraphViewData, { type GraphViewDataProps } from "./useGraphView.data"
import useGraphViewController, { type GraphViewControllerProps } from "./useGraphView.controller"
import type { JiraProject, JiraIssue, AppPrefs } from "../../../types/jira"

export type useGraphViewProps = {
    selectedProject: JiraProject | null
    prefs: AppPrefs
    onPrefsChange: (prefs: Partial<AppPrefs>) => void
    onIssueSelect: (issue: JiraIssue) => void
    initialEpicKey?: string | null
}

export type GraphViewProps = {
    selectedProject: JiraProject | null
    prefs: AppPrefs
    selectedEpicKey: string | null
    setSelectedEpicKey: (key: string | null) => void
    hideDone: boolean
    toggleHideDone: () => void
    dataProps: GraphViewDataProps
    controllerProps: GraphViewControllerProps
}

const useGraphView = ({
    selectedProject,
    prefs,
    onPrefsChange,
    onIssueSelect,
    initialEpicKey,
}: useGraphViewProps): GraphViewProps => {
    const [selectedEpicKey, setSelectedEpicKey] = useState<string | null>(initialEpicKey ?? null)
    const [hideDone, setHideDone] = useState(false)
    useEffect(() => {
        if (initialEpicKey) setSelectedEpicKey(initialEpicKey)
    }, [initialEpicKey])

    const dataProps = useGraphViewData({
        selectedProject,
        selectedEpicKey,
        prefs,
        onPrefsChange,
    })

    const controllerProps = useGraphViewController(dataProps, onIssueSelect)

    return {
        selectedProject,
        prefs,
        selectedEpicKey,
        setSelectedEpicKey,
        hideDone,
        toggleHideDone: () => setHideDone((v) => !v),
        dataProps,
        controllerProps,
    }
}

export default useGraphView
