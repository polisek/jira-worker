import { ArrowRight } from "lucide-react"
import type { MoveCtx } from "../hooks/useTreeView.controller"
import { issueTypeStyle } from "./TreeNode"

interface Props {
    moveCtx: MoveCtx
    onConfirm: () => void
    onCancel: () => void
}

export function MoveToEpicDialog({ moveCtx, onConfirm, onCancel }: Props) {
    if (!moveCtx) return null

    const typeStyle = issueTypeStyle(moveCtx.issue.fields.issuetype.name)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative modal-panel rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4">
                {/* Header */}
                <div className="min-w-0">
                    <h2 className="font-semibold text-base" style={{ color: "var(--c-text)" }}>
                        Přesunout úkol mezi epicy
                    </h2>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${typeStyle.dot}`} />
                        <span className={`text-xs font-mono font-semibold shrink-0 ${typeStyle.text}`}>
                            {moveCtx.issue.key}:
                        </span>
                        <span className="text-xs truncate" style={{ color: "var(--c-text-3)" }}>
                            {moveCtx.issue.fields.summary}
                        </span>
                    </div>
                </div>

                {/* From → To epic */}
                <div
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: "var(--c-bg-card)", border: "1px solid var(--c-border)" }}
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-xs mb-0.5" style={{ color: "var(--c-text-4)" }}>
                            Z epicu
                        </p>
                        <p className="text-sm font-mono text-purple-400 truncate">{moveCtx.fromEpicKey}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--c-text-4)" }} />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs mb-0.5" style={{ color: "var(--c-text-4)" }}>
                            Do epicu
                        </p>
                        <p className="text-sm font-mono text-purple-400 truncate">{moveCtx.toEpicKey}</p>
                    </div>
                </div>

                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="btn-secondary">
                        Zrušit
                    </button>
                    <button onClick={onConfirm} className="btn-primary">
                        Přesunout
                    </button>
                </div>
            </div>
        </div>
    )
}
