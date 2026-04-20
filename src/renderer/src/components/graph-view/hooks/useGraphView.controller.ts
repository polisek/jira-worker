import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
    useNodesState,
    useEdgesState,
    useReactFlow,
    addEdge,
    type Connection,
} from "@xyflow/react"
import type { Node } from "@xyflow/react"
import { parentChildHandles } from "./useGraphView.graph-data"
import { jiraApi } from "../../../utils/jira-api"
import type { JiraIssue } from "../../../types/jira"
import type { GraphViewDataProps } from "./useGraphView.data"

export type ContextMenuState = { x: number; y: number; issue: JiraIssue } | null

export type GraphViewControllerProps = {
    nodes: ReturnType<typeof useNodesState>[0]
    edges: ReturnType<typeof useEdgesState>[0]
    onNodesChange: ReturnType<typeof useNodesState>[2]
    onEdgesChange: ReturnType<typeof useEdgesState>[2]
    nodesWithCallback: Node[]
    edgesWithCallback: ReturnType<typeof useEdgesState>[0]
    onNodeDragStop: () => void
    onConnect: (connection: Connection) => void
    onConnectEnd: (event: MouseEvent | TouchEvent, state: Record<string, unknown>) => void
    handleNodeContextMenu: (event: React.MouseEvent, node: Record<string, unknown>) => void
    contextMenu: ContextMenuState
    setContextMenu: (menu: ContextMenuState) => void
    createTaskForEpicKey: string | null
    setCreateTaskForEpicKey: (key: string | null) => void
    createSubtaskForKey: string | null
    setCreateSubtaskForKey: (key: string | null) => void
    epicIssueForModal: JiraIssue | null
    dropPositionRef: React.RefObject<{ x: number; y: number } | null>
}

const useGraphViewController = (
    dataProps: GraphViewDataProps,
    onIssueSelect: (issue: JiraIssue) => void
): GraphViewControllerProps => {
    const { nodes: initNodes, edges: initEdges, saveLayout } = dataProps
    const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
    const [createTaskForEpicKey, setCreateTaskForEpicKey] = useState<string | null>(null)
    const [createSubtaskForKey, setCreateSubtaskForKey] = useState<string | null>(null)
    const nodesRef = useRef(nodes)
    const dropPositionRef = useRef<{ x: number; y: number } | null>(null)
    const saveTimeout = useRef<ReturnType<typeof setTimeout>>()
    const { screenToFlowPosition } = useReactFlow()

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
        return () => {
            clearTimeout(saveTimeout.current)
        }
    }, [])

    const onNodeDragStop = useCallback(() => {
        clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => saveLayout(nodesRef.current), 800)

        setEdges((eds) =>
            eds.map((edge) => {
                if (edge.type !== "parentEdge") return edge
                const sourceNode = nodesRef.current.find((n) => n.id === edge.source)
                const targetNode = nodesRef.current.find((n) => n.id === edge.target)
                if (!sourceNode || !targetNode) return edge
                const { sourceHandle, targetHandle } = parentChildHandles(
                    sourceNode.position,
                    targetNode.position,
                    (sourceNode.data as Record<string, unknown>)?.isEpic === true
                )
                if (edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) return edge
                return { ...edge, sourceHandle, targetHandle }
            })
        )
    }, [saveLayout, setEdges])

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

    const onConnectEnd = useCallback(
        (event: MouseEvent | TouchEvent, state: Record<string, unknown>) => {
            if (state?.isValid) return
            const sourceId = (state?.fromNode as Record<string, unknown> | undefined)?.id as string | undefined
            if (!sourceId) return
            const clientX = "clientX" in event ? event.clientX : (event.touches[0]?.clientX ?? 0)
            const clientY = "clientY" in event ? event.clientY : (event.touches[0]?.clientY ?? 0)
            dropPositionRef.current = screenToFlowPosition({ x: clientX, y: clientY })
            const sourceNode = nodesRef.current.find((n) => n.id === sourceId)
            const handleId = (state?.fromHandle as Record<string, unknown> | undefined)?.id as string | undefined
            if ((sourceNode?.data as Record<string, unknown> | undefined)?.isEpic) {
                setCreateTaskForEpicKey(sourceId)
            } else if (handleId === "bottom" || handleId === "right-parent" || handleId === "left-parent-src") {
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

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Record<string, unknown>) => {
        event.preventDefault()
        const issue = (node.data as Record<string, unknown> | undefined)?.issue as JiraIssue | undefined
        if (!issue) return
        setContextMenu({ x: event.clientX, y: event.clientY, issue })
    }, [])

    const handleEdgeDelete = useCallback(
        (edgeId: string, linkId: string) => {
            setEdges((eds) => eds.filter((e) => e.id !== edgeId))
            jiraApi.deleteIssueLink(linkId).catch(console.error)
        },
        [setEdges]
    )

    const nodesWithCallback = useMemo(
        () => nodes.map((n) => ({ ...n, data: { ...n.data, onSelect: handleNodeSelect } })),
        [nodes, handleNodeSelect]
    )

    const edgesWithCallback = useMemo(
        () => edges.map((e) => (e.type === "linkEdge" ? { ...e, data: { ...e.data, onDelete: handleEdgeDelete } } : e)),
        [edges, handleEdgeDelete]
    )

    const epicIssueForModal = useMemo(
        () =>
            createTaskForEpicKey
                ? ((nodes.find((n) => n.id === createTaskForEpicKey)?.data?.issue as JiraIssue | undefined) ?? null)
                : null,
        [createTaskForEpicKey, nodes]
    )

    return {
        nodes,
        edges,
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
    }
}

export default useGraphViewController
