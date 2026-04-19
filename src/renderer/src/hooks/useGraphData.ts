import { useState, useEffect, useCallback, useRef } from "react"
import type { Node, Edge } from "@xyflow/react"
import { jiraApi } from "../lib/jira-api"
import type { JiraIssue, GraphLayout, GraphNodePosition, AppPrefs } from "../types/jira"

interface UseGraphDataProps {
    epicKey: string | null
    projectKey: string | null
    prefs: AppPrefs
    onPrefsChange: (prefs: Partial<AppPrefs>) => void
}

export type LayoutSource = "jira" | "local" | "none"

interface UseGraphDataReturn {
    nodes: Node[]
    edges: Edge[]
    loading: boolean
    error: string | null
    layoutSource: LayoutSource
    reload: () => void
    saveLayout: (nodes: Node[]) => void
    saveNewNodePosition: (issueKey: string, position: { x: number; y: number }) => void
}

function autoPosition(index: number, total: number): { x: number; y: number } {
    const cols = Math.ceil(Math.sqrt(total))
    return {
        x: 60 + (index % cols) * 280,
        y: 60 + Math.floor(index / cols) * 180,
    }
}

function issuesToNodes(issues: JiraIssue[], savedPositions: Record<string, GraphNodePosition>): Node[] {
    return issues.map((issue, index) => {
        const pos = savedPositions[issue.key] ?? autoPosition(index, issues.length)
        return {
            id: issue.key,
            type: "issueNode",
            position: pos,
            data: {
                issue,
                isEpic: issue.fields.issuetype.name === "Epic",
            },
        }
    })
}

function issuesToEdges(issues: JiraIssue[], positions: Record<string, GraphNodePosition>): Edge[] {
    const edges: Edge[] = []
    const seen = new Set<string>()
    const issueKeys = new Set(issues.map((i) => i.key))
    const epicKeys  = new Set(issues.filter((i) => i.fields.issuetype.name.toLowerCase() === "epic").map((i) => i.key))

    const addEdge = (id: string, source: string, target: string, edge: Omit<Edge, "id" | "source" | "target">) => {
        if (seen.has(id)) return
        seen.add(id)
        edges.push({ id, source, target, ...edge })
    }

    issues.forEach((issue) => {
        // Parent → child hierarchy edges (Epic→Task, Task→Subtask)
        const parentKey = issue.fields.parent?.key
        if (parentKey && issueKeys.has(parentKey)) {
            addEdge(`parent--${parentKey}--${issue.key}`, parentKey, issue.key, {
                type: "parentEdge",
                animated: false,
                sourceHandle: "bottom",
                targetHandle: "top",
                data: { originalEstimate: issue.fields.timeoriginalestimate ?? 0 },
                style: { stroke: "#8b5cf6", strokeWidth: 1.5, strokeDasharray: "4 2" },
                markerEnd: { type: "arrowclosed" as const, color: "#8b5cf6" },
            })
        }

        // Explicit issuelinks (blocks, relates to, …)
        issue.fields.issuelinks?.forEach((link) => {
            const targetKey = link.outwardIssue?.key ?? link.inwardIssue?.key
            if (!targetKey || !issueKeys.has(targetKey)) return

            const sourceKey = link.outwardIssue ? issue.key : targetKey
            const destKey   = link.outwardIssue ? targetKey : issue.key
            const edgeId    = [sourceKey, destKey].sort().join("--")
            const isBlocking = link.type.name.toLowerCase().includes("block")

            const sourceX = positions[sourceKey]?.x ?? 0
            const destX   = positions[destKey]?.x ?? 0
            const ltr     = sourceX <= destX
            const srcIsEpic = epicKeys.has(sourceKey)
            const dstIsEpic = epicKeys.has(destKey)
            const hSuffix = isBlocking ? "blocks" : "relates"
            const sourceHandle = ltr
                ? (srcIsEpic ? "right"    : `right-${hSuffix}`)
                : (srcIsEpic ? "left-src" : `left-${hSuffix}-src`)
            const targetHandle = ltr
                ? (dstIsEpic ? "left"      : `left-${hSuffix}`)
                : (dstIsEpic ? "right-tgt" : `right-${hSuffix}-tgt`)

            addEdge(edgeId, sourceKey, destKey, {
                type: "linkEdge",
                animated: isBlocking,
                sourceHandle,
                targetHandle,
                label: link.type.outward || link.type.inward,
                data: { linkType: link.type.name, linkId: link.id, isBlocking },
                style: {
                    stroke: isBlocking ? "#f85149" : "#58a6ff",
                    strokeWidth: isBlocking ? 2 : 1.5,
                    strokeDasharray: link.type.name.includes("relates") ? "5 3" : undefined,
                },
                markerEnd: { type: "arrowclosed" as const, color: isBlocking ? "#f85149" : "#58a6ff" },
            })
        })
    })

    return edges
}

export function useGraphData({ epicKey, projectKey, prefs, onPrefsChange }: UseGraphDataProps): UseGraphDataReturn {
    const [nodes, setNodes] = useState<Node[]>([])
    const [edges, setEdges] = useState<Edge[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [layoutSource, setLayoutSource] = useState<LayoutSource>("none")

    // Aktuální pozice v paměti — pro inkrementální ukládání bez extra fetch
    const currentPositionsRef = useRef<Record<string, GraphNodePosition>>({})
    // Fallback lokální layout (z electron-store) — udržujeme v ref, abychom neprovokovali reload
    const localLayoutRef = useRef<Record<string, GraphNodePosition>>({})

    // Sync lokálního fallbacku do ref kdykoli se změní prefs (ale bez triggeru load)
    useEffect(() => {
        localLayoutRef.current = (epicKey && projectKey)
            ? prefs.graphLayouts?.find((l: GraphLayout) => l.epicKey === epicKey && l.projectKey === projectKey)?.positions ?? {}
            : {}
    }, [epicKey, projectKey, prefs.graphLayouts])

    const load = useCallback(async () => {
        if (!epicKey) return
        setLoading(true)
        setError(null)
        try {
            // Načteme issues a Jira layout paralelně
            const [issues, jiraLayout] = await Promise.all([
                jiraApi.getEpicIssues(epicKey, projectKey ?? undefined),
                jiraApi.getGraphLayout(epicKey),
            ])

            // Priorita: Jira > lokální > nic
            let savedPositions: Record<string, GraphNodePosition>
            if (jiraLayout?.positions && Object.keys(jiraLayout.positions).length > 0) {
                savedPositions = jiraLayout.positions
                setLayoutSource("jira")
            } else if (Object.keys(localLayoutRef.current).length > 0) {
                savedPositions = localLayoutRef.current
                setLayoutSource("local")
            } else {
                savedPositions = {}
                setLayoutSource("none")
            }

            const computedNodes = issuesToNodes(issues, savedPositions)
            const positions: Record<string, GraphNodePosition> = {}
            computedNodes.forEach((n) => { positions[n.id] = n.position })
            currentPositionsRef.current = positions

            setNodes(computedNodes)
            setEdges(issuesToEdges(issues, positions))
        } catch (e) {
            setError(e instanceof Error ? e.message : "Chyba při načítání")
        } finally {
            setLoading(false)
        }
    }, [epicKey, projectKey])   // záměrně bez prefs.graphLayouts — čteme přes ref

    useEffect(() => {
        load()
    }, [load])

    /** Uloží pozice všech nodů — Jira primárně, electron-store jako fallback */
    const saveLayout = useCallback(
        (currentNodes: Node[]) => {
            if (!epicKey) return
            const positions: Record<string, GraphNodePosition> = {}
            currentNodes.forEach((n) => { positions[n.id] = n.position })
            currentPositionsRef.current = positions

            // Jira — fire & forget, chyba se pouze loguje
            jiraApi.saveGraphLayout(epicKey, positions)
                .then(() => setLayoutSource("jira"))
                .catch((e) => console.warn("[GraphLayout] Jira uložení selhalo:", e))

            // Lokální fallback
            if (projectKey) {
                const existing = prefs.graphLayouts?.filter(
                    (l: GraphLayout) => !(l.epicKey === epicKey && l.projectKey === projectKey)
                ) ?? []
                onPrefsChange({
                    graphLayouts: [...existing, { epicKey, projectKey, positions, updatedAt: Date.now() }],
                })
            }
        },
        [epicKey, projectKey, prefs.graphLayouts, onPrefsChange]
    )

    /** Přidá/aktualizuje pozici jednoho nodu (při vytvoření přetažením) */
    const saveNewNodePosition = useCallback(
        (issueKey: string, position: { x: number; y: number }) => {
            if (!epicKey) return
            const updatedPositions = { ...currentPositionsRef.current, [issueKey]: position }
            currentPositionsRef.current = updatedPositions

            jiraApi.saveGraphLayout(epicKey, updatedPositions)
                .then(() => setLayoutSource("jira"))
                .catch((e) => console.warn("[GraphLayout] Jira uložení selhalo:", e))

            if (projectKey) {
                const existing = prefs.graphLayouts?.filter(
                    (l: GraphLayout) => !(l.epicKey === epicKey && l.projectKey === projectKey)
                ) ?? []
                onPrefsChange({
                    graphLayouts: [...existing, { epicKey, projectKey, positions: updatedPositions, updatedAt: Date.now() }],
                })
            }
        },
        [epicKey, projectKey, prefs.graphLayouts, onPrefsChange]
    )

    return { nodes, edges, loading, error, layoutSource, reload: load, saveLayout, saveNewNodePosition }
}
