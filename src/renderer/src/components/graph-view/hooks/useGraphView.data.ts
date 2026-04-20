import { useEffect } from "react"
import { useGraphData } from "./useGraphView.graph-data"
import { useEpicsQuery } from "../../../api/epics/get-epics"
import type { JiraIssue, JiraProject, AppPrefs } from "../../../types/jira"
import type { Node, Edge } from "@xyflow/react"
import type { LayoutSource } from "./useGraphView.graph-data"

export type GraphViewDataProps = {
    epics: JiraIssue[]
    loadingEpics: boolean
    nodes: Node[]
    edges: Edge[]
    loading: boolean
    error: string | null
    layoutSource: LayoutSource
    reload: () => void
    saveLayout: (nodes: Node[]) => void
    saveNewNodePosition: (issueKey: string, position: { x: number; y: number }) => void
}

export type useGraphViewDataProps = {
    selectedProject: JiraProject | null
    selectedEpicKey: string | null
    prefs: AppPrefs
    onPrefsChange: (prefs: Partial<AppPrefs>) => void
    initialEpicKey?: string | null
    onSelectedEpicKeyChange: (key: string | null) => void
}

const useGraphViewData = ({
    selectedProject,
    selectedEpicKey,
    prefs,
    onPrefsChange,
    initialEpicKey,
    onSelectedEpicKeyChange,
}: useGraphViewDataProps): GraphViewDataProps => {
    const epicsQuery = useEpicsQuery(selectedProject?.key ?? "", {
        enabled: !!selectedProject,
    })

    const graphData = useGraphData({
        epicKey: selectedEpicKey,
        projectKey: selectedProject?.key ?? null,
        prefs,
        onPrefsChange,
    })

    useEffect(() => {
        if (initialEpicKey) onSelectedEpicKeyChange(initialEpicKey)
    }, [initialEpicKey, onSelectedEpicKeyChange])

    return {
        epics: epicsQuery.data?.issues ?? [],
        loadingEpics: epicsQuery.isFetching,
        ...graphData,
    }
}

export default useGraphViewData
