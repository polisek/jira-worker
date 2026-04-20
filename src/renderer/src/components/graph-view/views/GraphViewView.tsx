import { ReactFlow, Background, Controls, MiniMap, BackgroundVariant } from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { IssueNode } from "../components/IssueNode"
import { LinkEdge } from "../components/LinkEdge"
import { ParentEdge } from "../components/ParentEdge"
import { GraphToolbar } from "../components/GraphToolbar"
import { ErrorMessage } from "../../ErrorMessage"
import { CreateIssueModal } from "../../CreateIssueModal"
import { IssueContextMenu } from "../../IssueContextMenu"
import type { GraphViewProps } from "../hooks/useGraphView"

const NODE_TYPES = { issueNode: IssueNode }
const EDGE_TYPES = { linkEdge: LinkEdge, parentEdge: ParentEdge }

export function GraphViewView({
    selectedProject,
    prefs,
    selectedEpicKey,
    setSelectedEpicKey,
    dataProps,
    controllerProps,
}: GraphViewProps) {
    const { epics, loadingEpics, loading, error, layoutSource, reload, saveLayout, saveNewNodePosition } = dataProps
    const {
        nodes,
        onNodesChange,
        onEdgesChange,
        nodesWithCallback,
        edgesWithCallback,
        onNodeDragStop,
        onConnect,
        onConnectEnd,
        handleNodeContextMenu,
        contextMenu,
        setContextMenu,
        createTaskForEpicKey,
        setCreateTaskForEpicKey,
        createSubtaskForKey,
        setCreateSubtaskForKey,
        epicIssueForModal,
        dropPositionRef,
    } = controllerProps

    if (!selectedProject) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Vyber projekt v sidebaru
            </div>
        )
    }

    const isLight =
        prefs.theme === "light" || (prefs.theme === "auto" && document.documentElement.classList.contains("light"))
    const rfColorMode = prefs.theme === "auto" ? "system" : prefs.theme

    return (
        <div className="flex flex-col h-full w-full">
            <GraphToolbar
                epics={epics}
                loadingEpics={loadingEpics}
                selectedEpicKey={selectedEpicKey}
                loading={loading}
                layoutSource={layoutSource}
                nodes={nodes}
                onEpicChange={setSelectedEpicKey}
                onReload={reload}
                onSaveLayout={saveLayout}
            />

            {error && (
                <ErrorMessage
                    message={error}
                    className="mx-4 mt-2 px-3 py-2 bg-red-900/30 border border-red-700/30 rounded shrink-0"
                />
            )}

            {!selectedEpicKey && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-600">
                    <span className="text-4xl">◈</span>
                    <p className="text-sm">Vyber epic pro zobrazení dependency grafu</p>
                </div>
            )}

            {selectedEpicKey && (
                <div className="flex-1 relative">
                    <ReactFlow
                        nodes={nodesWithCallback}
                        edges={edgesWithCallback}
                        nodeTypes={NODE_TYPES}
                        edgeTypes={EDGE_TYPES}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onConnectEnd={onConnectEnd}
                        onNodeDragStop={onNodeDragStop}
                        onNodeContextMenu={handleNodeContextMenu}
                        onPaneClick={() => setContextMenu(null)}
                        fitView
                        fitViewOptions={{ padding: 0.15 }}
                        deleteKeyCode="Delete"
                        colorMode={rfColorMode}
                        defaultEdgeOptions={{ type: "default" }}
                    >
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={20}
                            size={1}
                            color={isLight ? "#d0d7de" : "#1f2937"}
                        />
                        <Controls className="!rounded-lg" />
                        <MiniMap
                            nodeColor={(n) => {
                                const issue = (n.data as Record<string, unknown> | undefined)?.issue as
                                    | { fields?: { status?: { statusCategory?: { key?: string } } } }
                                    | undefined
                                const key = issue?.fields?.status?.statusCategory?.key
                                return key === "done"
                                    ? isLight
                                        ? "#bbf7d0"
                                        : "#14532d"
                                    : key === "indeterminate"
                                      ? isLight
                                          ? "#bfdbfe"
                                          : "#1d3a5c"
                                      : isLight
                                        ? "#e5e7eb"
                                        : "#374151"
                            }}
                            className="!rounded-lg"
                        />
                    </ReactFlow>
                </div>
            )}

            {createTaskForEpicKey && (
                <CreateIssueModal
                    projects={selectedProject ? [selectedProject] : []}
                    defaultProject={selectedProject}
                    defaultEpic={epicIssueForModal}
                    defaultIssueTypeName="Task"
                    onClose={() => setCreateTaskForEpicKey(null)}
                    onCreated={(issue) => {
                        if (dropPositionRef.current) saveNewNodePosition(issue.key, dropPositionRef.current)
                        setCreateTaskForEpicKey(null)
                        reload()
                    }}
                />
            )}

            {createSubtaskForKey && (
                <CreateIssueModal
                    projects={selectedProject ? [selectedProject] : []}
                    defaultProject={selectedProject}
                    defaultParentKey={createSubtaskForKey}
                    onClose={() => setCreateSubtaskForKey(null)}
                    onCreated={(issue) => {
                        if (dropPositionRef.current) saveNewNodePosition(issue.key, dropPositionRef.current)
                        setCreateSubtaskForKey(null)
                        reload()
                    }}
                />
            )}

            {contextMenu && (
                <IssueContextMenu
                    issue={contextMenu.issue}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    selectedProject={selectedProject}
                    onClose={() => setContextMenu(null)}
                    onUpdated={reload}
                />
            )}
        </div>
    )
}
