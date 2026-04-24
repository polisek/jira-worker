import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import type { JiraUser } from "../../../types/jira"

export interface MentionListRef {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

interface Props {
    items: JiraUser[]
    command: (attrs: { id: string; label: string }) => void
    loading?: boolean
}

export const MentionList = forwardRef<MentionListRef, Props>(({ items, command, loading }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
        setSelectedIndex(0)
    }, [items])

    const selectItem = (index: number) => {
        const item = items[index]
        if (item) {
            command({ id: item.accountId, label: item.displayName })
        }
    }

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.key === "ArrowUp") {
                setSelectedIndex((i) => (i + items.length - 1) % items.length)
                return true
            }
            if (event.key === "ArrowDown") {
                setSelectedIndex((i) => (i + 1) % items.length)
                return true
            }
            if (event.key === "Enter") {
                selectItem(selectedIndex)
                return true
            }
            return false
        },
    }))

    if (loading) {
        return (
            <div
                className="mention-dropdown rounded-lg border border-gray-700 shadow-xl py-1 px-2 text-xs"
                style={{ background: "var(--c-bg-detail)" }}
            >
                <span style={{ color: "var(--c-text-4)" }}>Hledám…</span>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div
                className="mention-dropdown rounded-lg border border-gray-700 shadow-xl py-1 px-2 text-xs"
                style={{ background: "var(--c-bg-detail)" }}
            >
                <span style={{ color: "var(--c-text-4)" }}>Žádní uživatelé</span>
            </div>
        )
    }

    return (
        <div
            className="mention-dropdown rounded-lg border border-gray-700 shadow-xl overflow-hidden"
            style={{ background: "var(--c-bg-detail)", minWidth: 220, maxHeight: 240, overflowY: "auto" }}
        >
            {items.map((user, index) => (
                <button
                    key={user.accountId}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors"
                    style={{
                        background: index === selectedIndex ? "var(--c-bg-card)" : "transparent",
                        color: "var(--c-text)",
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(e) => {
                        e.preventDefault()
                        selectItem(index)
                    }}
                >
                    <img src={user.avatarUrls?.["48x48"]} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                    <span className="truncate">{user.displayName}</span>
                    {user.emailAddress && (
                        <span className="ml-auto flex-shrink-0 opacity-50 text-[10px]">
                            {user.emailAddress.split("@")[0]}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
})

MentionList.displayName = "MentionList"
