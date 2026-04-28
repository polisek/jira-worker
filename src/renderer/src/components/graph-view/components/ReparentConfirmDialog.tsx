import { ArrowRight, GitBranch } from "lucide-react"
import type { PendingReparent } from "../hooks/useGraphView.controller"

interface Props {
    pending: PendingReparent
    onCancel: () => void
}

function IssueRow({ label, issueKey, summary, iconUrl }: { label: string; issueKey: string; summary: string; iconUrl?: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--c-text-4)" }}>{label}</span>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border min-w-0" style={{ background: "var(--c-bg-card)", borderColor: "var(--c-border)" }}>
                {iconUrl && <img src={iconUrl} alt="" className="w-4 h-4 shrink-0" />}
                <span className="font-mono text-[11px] text-purple-500 shrink-0">{issueKey}</span>
                <span className="text-xs truncate" style={{ color: "var(--c-text)" }}>{summary}</span>
            </div>
        </div>
    )
}

export function ReparentConfirmDialog({ pending, onCancel }: Props) {
    const { childIssue, oldParentIssue, newParentIssue, typeChange, execute } = pending

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div
                className="relative modal-panel rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-purple-400 shrink-0" />
                    <h2 className="font-semibold text-sm" style={{ color: "var(--c-text)" }}>
                        Změnit nadřazený úkol
                    </h2>
                </div>

                {/* Child issue */}
                <IssueRow
                    label="Přesouvaný úkol"
                    issueKey={childIssue.key}
                    summary={childIssue.fields.summary}
                    iconUrl={childIssue.fields.issuetype.iconUrl}
                />

                {/* Parent change */}
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--c-text-4)" }}>Změna nadřazeného</span>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-1 min-w-0 px-3 py-2 rounded-lg border" style={{ background: "var(--c-bg-card)", borderColor: "var(--c-border)" }}>
                            {oldParentIssue ? (
                                <div className="flex items-center gap-2 min-w-0">
                                    {oldParentIssue.fields.issuetype.iconUrl && (
                                        <img src={oldParentIssue.fields.issuetype.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
                                    )}
                                    <span className="font-mono text-[11px] text-purple-500 shrink-0">{oldParentIssue.key}</span>
                                    <span className="text-xs truncate" style={{ color: "var(--c-text-3)" }}>{oldParentIssue.fields.summary}</span>
                                </div>
                            ) : (
                                <span className="text-xs italic" style={{ color: "var(--c-text-4)" }}>— bez rodiče —</span>
                            )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-purple-500 shrink-0" />
                        <div className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-purple-500/40 bg-purple-500/10">
                            <div className="flex items-center gap-2 min-w-0">
                                {newParentIssue.fields.issuetype.iconUrl && (
                                    <img src={newParentIssue.fields.issuetype.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="font-mono text-[11px] text-purple-500 shrink-0">{newParentIssue.key}</span>
                                <span className="text-xs truncate" style={{ color: "var(--c-text)" }}>{newParentIssue.fields.summary}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Type change notice */}
                {typeChange && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-300">
                        <span className="shrink-0">Typ úkolu se změní:</span>
                        <span className="font-medium">{typeChange}</span>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onCancel} className="btn-secondary text-sm px-4 py-1.5">
                        Zrušit
                    </button>
                    <button onClick={execute} className="btn-primary text-sm px-4 py-1.5">
                        Potvrdit
                    </button>
                </div>
            </div>
        </div>
    )
}
