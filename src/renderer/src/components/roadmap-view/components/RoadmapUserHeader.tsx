import { useState } from "react"
import { X } from "lucide-react"
import { ROADMAP_USER_COLORS } from "./RoadmapIssueCard"
import type { JiraUser } from "../../../types/jira"

interface Props {
    user: JiraUser
    colorIndex: number
    capacity: number
    onRemove: (userId: string) => void
    onSetCapacity: (accountId: string, hours: number) => void
}

export function RoadmapUserHeader({ user, colorIndex, capacity, onRemove, onSetCapacity }: Props) {
    const color = ROADMAP_USER_COLORS[colorIndex % ROADMAP_USER_COLORS.length]
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(String(capacity))

    const commit = () => {
        const parsed = parseInt(draft, 10)
        if (!isNaN(parsed) && parsed > 0) onSetCapacity(user.accountId, parsed)
        setEditing(false)
    }

    return (
        <div className="flex items-center gap-2 w-full">
            <img src={user.avatarUrls["48x48"]} alt={user.displayName} className="w-6 h-6 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "var(--c-text)" }}>
                    {user.displayName}
                </div>
                {editing ? (
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min={1}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commit()
                                if (e.key === "Escape") setEditing(false)
                            }}
                            autoFocus
                            className="text-[11px] rounded px-1 py-px w-10"
                            style={{
                                background: "var(--c-bg-input)",
                                color: "var(--c-text)",
                                border: "1px solid var(--c-border)",
                            }}
                        />
                        <span className="text-[11px]" style={{ color: "var(--c-text-4)" }}>
                            h/sprint
                        </span>
                    </div>
                ) : (
                    <div
                        className="text-[11px] meta-field-editable inline-block"
                        style={{ color: "var(--c-text-4)" }}
                        onDoubleClick={() => {
                            setDraft(String(capacity))
                            setEditing(true)
                        }}
                        title="Dvojklik pro úpravu kapacity"
                    >
                        kapacita {capacity}h
                    </div>
                )}
            </div>
            <button
                onClick={() => onRemove(user.accountId)}
                className="shrink-0 p-0.5 rounded opacity-0 group-hover/th:opacity-100 transition-opacity"
                style={{ color: "var(--c-text-4)" }}
                title="Odebrat uživatele"
            >
                <X className="w-3 h-3" />
            </button>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color.dot }} />
        </div>
    )
}
