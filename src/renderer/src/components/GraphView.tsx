import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { RefreshCw, UploadCloud } from "lucide-react"
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    useReactFlow,
    addEdge,
    type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { IssueNode } from "./IssueNode"
import { LinkEdge } from "./LinkEdge"
import { ParentEdge } from "./ParentEdge"
import { ErrorMessage } from "./ErrorMessage"
import { CreateIssueModal } from "./CreateIssueModal"
import { IssueContextMenu } from "./IssueContextMenu"
import { useGraphData, parentChildHandles } from "../hooks/useGraphData"
import { jiraApi } from "../lib/jira-api"
import type { JiraProject, JiraIssue, AppPrefs } from "../types/jira"

const NODE_TYPES = { issueNode: IssueNode }
const EDGE_TYPES = { linkEdge: LinkEdge, parentEdge: ParentEdge }

interface Props {
    selectedProject: JiraProject | null
    prefs: AppPrefs
    onPrefsChange: (prefs: Partial<AppPrefs>) => void
    onIssueSelect: (issue: JiraIssue) => void
    initialEpicKey?: string | null
}

function GraphCanvas({ selectedProject, prefs, onPrefsChange, onIssueSelect, initialEpicKey }: Props) {
    const [selectedEpicKey, setSelectedEpicKey] = useState<string | null>(initialEpicKey ?? null)
    const [epics, setEpics] = useState<JiraIssue[]>([])
    const [loadingEpics, setLoadingEpics] = useState(false)
    const [createTaskForEpicKey, setCreateTaskForEpicKey] = useState<string | null>(null)
    const [createSubtaskForKey, setCreateSubtaskForKey] = useState<string | null>(null)
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; issue: JiraIssue } | null>(null)
    const dropPositionRef = useRef<{ x: number; y: number } | null>(null)
    const { screenToFlowPosition } = useReactFlow()
    const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

    const {
        nodes: initNodes,
        edges: initEdges,
        loading,
        error,
        layoutSource,
        reload,
        saveLayout,
        saveNewNodePosition,
    } = useGraphData({
        epicKey: selectedEpicKey,
        projectKey: selectedProject?.key ?? null,
        prefs,
        onPrefsChange,
    })

    const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
    const nodesRef = useRef(nodes)
    useEffect(() => {
        nodesRef.current = nodes
    }, [nodes])

    useEffect(() => {
        setNodes(initNodes)
    }, [initNodes, setNodes])
    useEffect(() => {
        setEdges(initEdges)
    }, [initEdges, setEdges])

    useEffect(() => {
        if (!selectedProject) return
        setLoadingEpics(true)
        setSelectedEpicKey(initialEpicKey ?? null)
        jiraApi
            .getEpics(selectedProject.key)
            .then(({ issues }) => setEpics(issues))
            .catch(() => setEpics([]))
            .finally(() => setLoadingEpics(false))
    }, [selectedProject])

    useEffect(() => {
        if (initialEpicKey) setSelectedEpicKey(initialEpicKey)
    }, [initialEpicKey])

    useEffect(() => {
        return () => {
            clearTimeout(saveTimeout.current)
        }
    }, [])

    const onNodeDragStop = useCallback(() => {
        clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => saveLayout(nodesRef.current), 800)

        // Přepočítej handles parent-child hran podle nových pozic
        setEdges((eds) =>
            eds.map((edge) => {
                if (edge.type !== "parentEdge") return edge
                const sourceNode = nodesRef.current.find((n) => n.id === edge.source)
                const targetNode = nodesRef.current.find((n) => n.id === edge.target)
                if (!sourceNode || !targetNode) return edge
                const { sourceHandle, targetHandle } = parentChildHandles(
                    sourceNode.position,
                    targetNode.position,
                    (sourceNode.data as any)?.isEpic === true
                )
                if (edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) return edge
                return { ...edge, sourceHandle, targetHandle }
            })
        )
    }, [saveLayout, setEdges])

    // When two nodes are connected: create Jira link for task→task, visual edge for parent
    const onConnect = useCallback(
        (connection: Connection) => {
            const { source, target, sourceHandle } = connection
            if (!source || !target) return

            const isBlocks = sourceHandle === "right-blocks" || sourceHandle === "left-blocks-src"
            const isRelates = sourceHandle === "right-relates" || sourceHandle === "left-relates-src"

            if (isBlocks || isRelates) {
                const typeName = isBlocks ? "Blocks" : "Relates"
                const color = isBlocks ? "#f85149" : "#58a6ff"
                const tempId = `temp-${source}-${target}-${Date.now()}`

                setEdges((eds) =>
                    addEdge(
                        {
                            ...connection,
                            id: tempId,
                            type: "linkEdge",
                            animated: isBlocks,
                            label: isBlocks ? "blocks" : "relates to",
                            data: { linkType: typeName, linkId: "", isBlocking: isBlocks },
                            style: {
                                stroke: color,
                                strokeWidth: isBlocks ? 2 : 1.5,
                                strokeDasharray: isRelates ? "5 3" : undefined,
                            },
                            markerEnd: { type: "arrowclosed" as const, color },
                        },
                        eds
                    )
                )

                jiraApi
                    .createIssueLink(source, target, typeName)
                    .then((linkId) =>
                        setEdges((eds) => eds.map((e) => (e.id === tempId ? { ...e, data: { ...e.data, linkId } } : e)))
                    )
                    .catch(console.error)
            } else {
                // Parent-child or epic→task visual edge
                setEdges((eds) =>
                    addEdge(
                        {
                            ...connection,
                            type: "default",
                            style: { stroke: "#8b5cf6", strokeWidth: 1.5, strokeDasharray: "4 2" },
                            markerEnd: { type: "arrowclosed" as const, color: "#8b5cf6" },
                        },
                        eds
                    )
                )
            }
        },
        [setEdges]
    )

    // Drag to empty canvas: epic → create task, task bottom handle → create subtask
    const onConnectEnd = useCallback(
        (event: MouseEvent | TouchEvent, state: any) => {
            if (state?.isValid) return
            const sourceId: string | undefined = state?.fromNode?.id
            if (!sourceId) return
            const clientX = "clientX" in event ? event.clientX : (event.touches[0]?.clientX ?? 0)
            const clientY = "clientY" in event ? event.clientY : (event.touches[0]?.clientY ?? 0)
            dropPositionRef.current = screenToFlowPosition({ x: clientX, y: clientY })
            const sourceNode = nodesRef.current.find((n) => n.id === sourceId)
            if (sourceNode?.data?.isEpic) {
                setCreateTaskForEpicKey(sourceId)
            } else if (state?.fromHandle?.id === "bottom") {
                setCreateSubtaskForKey(sourceId)
            }
        },
        [screenToFlowPosition]
    )

    const handleNodeSelect = useCallback(
        async (issue: JiraIssue) => {
            const full = await jiraApi.getIssue(issue.key)
            onIssueSelect(full)
        },
        [onIssueSelect]
    )

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
        event.preventDefault()
        const issue = node.data?.issue as JiraIssue | undefined
        if (!issue) return
        setContextMenu({ x: event.clientX, y: event.clientY, issue })
    }, [])

    const nodesWithCallback = useMemo(
        () => nodes.map((n) => ({ ...n, data: { ...n.data, onSelect: handleNodeSelect } })),
        [nodes, handleNodeSelect]
    )

    const handleEdgeDelete = useCallback(
        (edgeId: string, linkId: string) => {
            setEdges((eds) => eds.filter((e) => e.id !== edgeId))
            jiraApi.deleteIssueLink(linkId).catch(console.error)
        },
        [setEdges]
    )

    const edgesWithCallback = useMemo(
        () => edges.map((e) => (e.type === "linkEdge" ? { ...e, data: { ...e.data, onDelete: handleEdgeDelete } } : e)),
        [edges, handleEdgeDelete]
    )

    const epicIssueForModal = useMemo(
        () =>
            createTaskForEpicKey
                ? ((nodesRef.current.find((n) => n.id === createTaskForEpicKey)?.data?.issue as
                      | JiraIssue
                      | undefined) ?? null)
                : null,
        [createTaskForEpicKey]
    )

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
            {/* Toolbar */}
            <div
                className="flex items-center gap-3 px-4 py-2 shrink-0"
                style={{ background: "var(--c-bg-titlebar)", borderBottom: "1px solid var(--c-border)" }}
            >
                <span className="badge-epic">EPIC</span>
                <select
                    className="input text-sm h-8 py-0 min-w-0 w-56"
                    value={selectedEpicKey ?? ""}
                    onChange={(e) => setSelectedEpicKey(e.target.value || null)}
                    disabled={loadingEpics}
                >
                    <option value="">{loadingEpics ? "Načítám epicy…" : "— Vyber epic —"}</option>
                    {epics.map((e) => (
                        <option key={e.key} value={e.key}>
                            {e.key} · {e.fields.summary}
                        </option>
                    ))}
                </select>

                {selectedEpicKey && (
                    <>
                        <button
                            className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5"
                            onClick={reload}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                            {loading ? "Načítám…" : "Refresh"}
                        </button>
                        <button
                            className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                            onClick={() => saveLayout(nodes)}
                            title="Uložit aktuální rozmístění nodů do Jiry"
                        >
                            <UploadCloud className="w-3.5 h-3.5" />
                            Uložit layout
                        </button>
                        {layoutSource !== "none" && (
                            <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                    layoutSource === "jira"
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                        : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                                }`}
                                title={
                                    layoutSource === "jira"
                                        ? "Layout synchronizován s Jirou — sdíleno se všemi uživateli"
                                        : "Layout uložen pouze lokálně — klikni Uložit layout pro sync do Jiry"
                                }
                            >
                                {layoutSource === "jira" ? "☁ Jira" : "💾 Lokální"}
                            </span>
                        )}
                    </>
                )}

                <div className="flex items-center gap-3 ml-auto text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-purple-500 inline-block shrink-0" /> Rodič
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block shrink-0" /> Blokuje
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shrink-0" /> Souvisí
                    </span>
                </div>
            </div>

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
                                const key = (n.data as any)?.issue?.fields?.status?.statusCategory?.key
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

export function GraphView(props: Props) {
    return (
        <ReactFlowProvider>
            <GraphCanvas {...props} />
        </ReactFlowProvider>
    )
}
