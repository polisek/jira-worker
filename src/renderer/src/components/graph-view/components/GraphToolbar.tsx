import { RefreshCw, UploadCloud } from "lucide-react"
import type { Node } from "@xyflow/react"
import type { JiraIssue } from "../../../types/jira"
import type { LayoutSource } from "../hooks/useGraphView.graph-data"

interface Props {
    epics: JiraIssue[]
    loadingEpics: boolean
    selectedEpicKey: string | null
    loading: boolean
    layoutSource: LayoutSource
    nodes: Node[]
    onEpicChange: (key: string | null) => void
    onReload: () => void
    onSaveLayout: (nodes: Node[]) => void
}

export function GraphToolbar({
    epics,
    loadingEpics,
    selectedEpicKey,
    loading,
    layoutSource,
    nodes,
    onEpicChange,
    onReload,
    onSaveLayout,
}: Props) {
    return (
        <div
            className="flex items-center gap-3 px-4 py-2 shrink-0"
            style={{ background: "var(--c-bg-titlebar)", borderBottom: "1px solid var(--c-border)" }}
        >
            <span className="badge-epic">EPIC</span>
            <select
                className="input text-sm h-8 py-0 min-w-0 w-56"
                value={selectedEpicKey ?? ""}
                onChange={(e) => onEpicChange(e.target.value || null)}
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
                        onClick={onReload}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        {loading ? "Načítám…" : "Refresh"}
                    </button>
                    <button
                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                        onClick={() => onSaveLayout(nodes)}
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
    )
}
