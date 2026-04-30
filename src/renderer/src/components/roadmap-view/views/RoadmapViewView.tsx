import { FC, useMemo, useState } from "react"
import { RefreshCw, Plus, Map, Square, AlertTriangle } from "lucide-react"
import { useCloseSprintMutation, useStartSprintMutation } from "../../../api/sprints/close-sprint"
import type { RoadmapViewProps } from "../hooks/useRoadmapView"
import type { RoadmapUser } from "../../../types/jira"
import { RoadmapUserHeader } from "../components/RoadmapUserHeader"
import { RoadmapSprintCell } from "../components/RoadmapSprintCell"
import { RoadmapBacklog } from "../components/RoadmapBacklog"
import { CreateSprintModal } from "../components/CreateSprintModal"

function issueHours(issue: {
    fields: {
        timeoriginalestimate?: number | null
        subtasks?: Array<{ fields: { timeoriginalestimate?: number | null } }>
    }
}): number {
    const own = issue.fields.timeoriginalestimate ?? 0
    const sub = issue.fields.subtasks?.reduce((s, st) => s + (st.fields.timeoriginalestimate ?? 0), 0) ?? 0
    return (own + sub) / 3600
}

const BACKLOG_OPEN_HEIGHT = 280
const BACKLOG_CLOSED_HEIGHT = 36

const RoadmapViewView: FC<RoadmapViewProps> = ({ selectedProject, onIssueSelect, dataProps, controllerProps }) => {
    const { boardId, sprints, allProjectUsers, loading, error, refetch } = dataProps
    const [confirmCloseSprintId, setConfirmCloseSprintId] = useState<number | null>(null)
    const [closeError, setCloseError] = useState<string | null>(null)
    const closeSprint = useCloseSprintMutation()
    const startSprint = useStartSprintMutation()

    const {
        selectedUserIds,
        getUserCapacity,
        setUserCapacity,
        backlogOpen,
        showUserPicker,
        showCreateSprint,
        dragPayload,
        dragOverTarget,
        localSprintIssues,
        localBacklogIssues,
        setBacklogOpen,
        setShowUserPicker,
        setShowCreateSprint,
        handleUserToggle,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDragEnd,
    } = controllerProps

    const selectedUsers = useMemo<RoadmapUser[]>(
        () =>
            selectedUserIds
                .map((id, index) => {
                    const user = allProjectUsers.find((u) => u.accountId === id)
                    if (!user) return null
                    return { user, colorIndex: index }
                })
                .filter((u): u is RoadmapUser => u !== null),
        [selectedUserIds, allProjectUsers]
    )

    const totalPlanned = localSprintIssues.length
    const totalBacklog = localBacklogIssues.length

    const avgFill = useMemo(() => {
        if (sprints.length === 0 || selectedUsers.length === 0) return 0
        const totalUsedHours = localSprintIssues.reduce((sum, i) => sum + issueHours(i), 0)
        const totalCap = sprints.length * selectedUsers.reduce((s, ru) => s + getUserCapacity(ru.user.accountId), 0)
        return totalCap > 0 ? Math.round((totalUsedHours / totalCap) * 100) : 0
    }, [localSprintIssues, sprints, selectedUsers, getUserCapacity])

    if (!selectedProject) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ color: "var(--c-text-4)" }}>
                <div className="text-center">
                    <Map className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Vyberte projekt pro zobrazení roadmapy</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden" onDragEnd={handleDragEnd}>
            {/* Toolbar */}
            <div
                className="flex items-center gap-2 px-4 py-2 border-b shrink-0 flex-wrap"
                style={{ borderColor: "var(--c-border)" }}
            >
                <div
                    className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs border"
                    style={{
                        background: "var(--c-bg-card)",
                        borderColor: "var(--c-border-card)",
                        color: "var(--c-text-3)",
                    }}
                >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#3b82f6" }} />
                    Naplánováno
                    <strong style={{ color: "#3b82f6" }}>{totalPlanned}</strong>
                </div>
                <div
                    className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs border"
                    style={{
                        background: "var(--c-bg-card)",
                        borderColor: "var(--c-border-card)",
                        color: "var(--c-text-3)",
                    }}
                >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#f59e0b" }} />
                    Backlog
                    <strong style={{ color: "#f59e0b" }}>{totalBacklog}</strong>
                </div>
                <div
                    className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs border"
                    style={{
                        background: "var(--c-bg-card)",
                        borderColor: "var(--c-border-card)",
                        color: "var(--c-text-3)",
                    }}
                >
                    <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: avgFill > 100 ? "#E24B4A" : avgFill > 80 ? "#EF9F27" : "#1D9E75" }}
                    />
                    Průměrné využití
                    <strong style={{ color: avgFill > 100 ? "#E24B4A" : avgFill > 80 ? "#EF9F27" : "#1D9E75" }}>
                        {avgFill}%
                    </strong>
                </div>

                <div className="ml-auto flex items-center gap-1.5 relative">
                    <button
                        onClick={refetch}
                        className="p-1.5 rounded transition-colors btn-icon"
                        title="Obnovit"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setShowCreateSprint(true)}
                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                        disabled={!boardId}
                        title="Nový sprint"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Nový sprint
                    </button>

                    <button
                        onClick={() => setShowUserPicker(!showUserPicker)}
                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Přidat uživatele
                    </button>

                    {showUserPicker && (
                        <div
                            className="absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-lg py-1 min-w-[220px]"
                            style={{ background: "var(--c-bg-detail)", borderColor: "var(--c-border)" }}
                        >
                            {allProjectUsers.length === 0 && (
                                <p className="px-3 py-2 text-xs" style={{ color: "var(--c-text-4)" }}>
                                    Žádní uživatelé
                                </p>
                            )}
                            {allProjectUsers.map((u) => {
                                const checked = selectedUserIds.includes(u.accountId)
                                return (
                                    <button
                                        key={u.accountId}
                                        onClick={() => handleUserToggle(u.accountId)}
                                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors"
                                        style={{ color: "var(--c-text-2)" }}
                                    >
                                        <img
                                            src={u.avatarUrls["48x48"]}
                                            alt=""
                                            className="w-5 h-5 rounded-full shrink-0"
                                        />
                                        <span className="flex-1 text-left truncate">{u.displayName}</span>
                                        <span
                                            className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                                            style={{
                                                background: checked ? "#3b82f6" : "transparent",
                                                borderColor: checked ? "#3b82f6" : "var(--c-border)",
                                            }}
                                        >
                                            {checked && (
                                                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                                                    <path
                                                        d="M1.5 5L4 7.5 8.5 2.5"
                                                        stroke="white"
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            )}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div
                    className="px-4 py-2 text-xs text-red-400 border-b shrink-0"
                    style={{ borderColor: "var(--c-border)" }}
                >
                    {error}
                </div>
            )}

            {selectedUsers.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--c-text-4)" }}>
                    Přidejte uživatele tlačítkem výše pro zobrazení sloupců
                </div>
            ) : (
                <>
                    {/* Sprint table — scrollable */}
                    <div className="flex-1 overflow-auto" onClick={() => showUserPicker && setShowUserPicker(false)}>
                        <table className="roadmap-table">
                            <thead>
                                <tr>
                                    <th
                                        className="roadmap-sprint-col roadmap-user-th text-left font-normal"
                                        style={{ color: "var(--c-text-4)", fontSize: 11 }}
                                    >
                                        Sprint / Os.
                                    </th>
                                    {selectedUsers.map((ru) => (
                                        <th key={ru.user.accountId} className="roadmap-user-th group/th">
                                            <RoadmapUserHeader
                                                user={ru.user}
                                                colorIndex={ru.colorIndex}
                                                capacity={getUserCapacity(ru.user.accountId)}
                                                onRemove={handleUserToggle}
                                                onSetCapacity={setUserCapacity}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sprints.map((sprint) => {
                                    const sprintAllIssues = localSprintIssues.filter((i) =>
                                        i.fields.customfield_10020?.some((s) => s.id === sprint.id)
                                    )
                                    const sprintUsedHours = sprintAllIssues.reduce((sum, i) => sum + issueHours(i), 0)
                                    const sprintTotalCapHours = selectedUsers.reduce(
                                        (s, ru) => s + getUserCapacity(ru.user.accountId),
                                        0
                                    )
                                    const sprintPct =
                                        sprintTotalCapHours > 0
                                            ? Math.min(Math.round((sprintUsedHours / sprintTotalCapHours) * 100), 100)
                                            : 0

                                    const startStr = sprint.startDate
                                        ? new Date(sprint.startDate).toLocaleDateString("cs-CZ", {
                                              day: "numeric",
                                              month: "numeric",
                                          })
                                        : null
                                    const endStr = sprint.endDate
                                        ? new Date(sprint.endDate).toLocaleDateString("cs-CZ", {
                                              day: "numeric",
                                              month: "numeric",
                                          })
                                        : null

                                    const isActive = sprint.state === "active"
                                    const todayPct = (() => {
                                        if (!isActive || !sprint.startDate || !sprint.endDate) return null
                                        const now = Date.now()
                                        const start = new Date(sprint.startDate).getTime()
                                        const end = new Date(sprint.endDate).getTime()
                                        return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100))
                                    })()
                                    const daysLeft = (() => {
                                        if (!isActive || !sprint.endDate) return null
                                        return Math.max(
                                            0,
                                            Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86400000)
                                        )
                                    })()

                                    return (
                                        <tr key={sprint.id} className={isActive ? "roadmap-row-active" : ""}>
                                            <td
                                                className={`roadmap-sprint-col${isActive ? " sprint-active" : ""}`}
                                                style={{ padding: 0, height: "1px" }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        height: "100%",
                                                        padding: 6,
                                                        boxSizing: "border-box",
                                                    }}
                                                >
                                                    {/* Top: name, dates, capacity */}
                                                    <div>
                                                        <div className="roadmap-capacity-bar">
                                                            <div
                                                                style={{
                                                                    height: "100%",
                                                                    width: `${sprintPct}%`,
                                                                    background:
                                                                        sprintUsedHours > sprintTotalCapHours
                                                                            ? "#E24B4A"
                                                                            : sprintPct > 80
                                                                              ? "#EF9F27"
                                                                              : "#1D9E75",
                                                                    borderRadius: 2,
                                                                }}
                                                            />
                                                        </div>
                                                        <div
                                                            className="text-[10px] mt-1"
                                                            style={{ color: "var(--c-text-4)" }}
                                                        >
                                                            {sprintUsedHours.toFixed(1)} / {sprintTotalCapHours}h
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mb-0.5 mt-4">
                                                            {isActive && (
                                                                <span
                                                                    className="text-[11px] font-semibold px-1 py-px rounded uppercase tracking-wide shrink-0"
                                                                    style={{
                                                                        background: "rgba(29,158,117,0.18)",
                                                                        color: "#1D9E75",
                                                                    }}
                                                                >
                                                                    Aktivní
                                                                </span>
                                                            )}
                                                            <div
                                                                className="text-[13px] font-medium truncate"
                                                                style={{ color: "var(--c-text)" }}
                                                            >
                                                                {sprint.name}
                                                            </div>
                                                        </div>
                                                        {(startStr || endStr) && (
                                                            <div
                                                                className="text-[12px] mt-0.5"
                                                                style={{ color: "var(--c-text-4)" }}
                                                            >
                                                                {startStr} – {endStr}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bottom: today progress + end sprint button */}
                                                    {isActive && (
                                                        <div style={{ marginTop: "auto", paddingTop: 8 }}>
                                                            {todayPct !== null && (
                                                                <div className="mb-2">
                                                                    <div
                                                                        className="text-[9px] mt-1 mb-1 text-right"
                                                                        style={{ color: "#1D9E75" }}
                                                                    >
                                                                        {daysLeft === 0
                                                                            ? "Končí dnes"
                                                                            : `${daysLeft}d zbývá`}
                                                                    </div>

                                                                    <div
                                                                        className="relative"
                                                                        style={{
                                                                            height: 4,
                                                                            borderRadius: 2,
                                                                            background: "var(--c-border)",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                position: "absolute",
                                                                                left: 0,
                                                                                top: 0,
                                                                                bottom: 0,
                                                                                width: `${todayPct}%`,
                                                                                background: "#1D9E75",
                                                                                borderRadius: 2,
                                                                            }}
                                                                        />
                                                                        <div
                                                                            style={{
                                                                                position: "absolute",
                                                                                left: `${todayPct}%`,
                                                                                top: -4,
                                                                                transform: "translateX(-50%)",
                                                                                width: 0,
                                                                                height: 0,
                                                                                borderLeft: "4px solid transparent",
                                                                                borderRight: "4px solid transparent",
                                                                                borderTop: "5px solid #1D9E75",
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={() => setConfirmCloseSprintId(sprint.id)}
                                                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors w-full justify-center"
                                                                style={{
                                                                    color: "#E24B4A",
                                                                    background: "rgba(226,75,74,0.08)",
                                                                    border: "1px solid rgba(226,75,74,0.2)",
                                                                }}
                                                            >
                                                                <Square className="w-2.5 h-2.5" />
                                                                Ukončit sprint
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            {selectedUsers.map((ru) => {
                                                const userIssues = sprintAllIssues.filter(
                                                    (i) => i.fields.assignee?.accountId === ru.user.accountId
                                                )
                                                return (
                                                    <RoadmapSprintCell
                                                        key={ru.user.accountId}
                                                        issues={userIssues}
                                                        userId={ru.user.accountId}
                                                        sprintId={sprint.id}
                                                        sprintCapacity={getUserCapacity(ru.user.accountId)}
                                                        userColorIndex={ru.colorIndex}
                                                        dragOverPayload={dragPayload}
                                                        dragOverTarget={dragOverTarget}
                                                        onDrop={handleDrop}
                                                        onDragOver={handleDragOver}
                                                        onDragLeave={handleDragLeave}
                                                        onIssueClick={onIssueSelect}
                                                        onIssueCardDragStart={handleDragStart}
                                                    />
                                                )
                                            })}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Backlog panel — sticky, fixed height, different bg */}
                    <div
                        className="roadmap-backlog-panel"
                        style={{ height: backlogOpen ? BACKLOG_OPEN_HEIGHT : BACKLOG_CLOSED_HEIGHT }}
                    >
                        <RoadmapBacklog
                            open={backlogOpen}
                            onToggle={() => setBacklogOpen(!backlogOpen)}
                            backlogIssues={localBacklogIssues}
                            selectedUsers={selectedUsers}
                            getUserCapacity={getUserCapacity}
                            dragOverPayload={dragPayload}
                            dragOverTarget={dragOverTarget}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onIssueClick={onIssueSelect}
                            onIssueCardDragStart={handleDragStart}
                        />
                    </div>
                </>
            )}

            {showCreateSprint && boardId && (
                <CreateSprintModal
                    boardId={boardId}
                    onClose={() => setShowCreateSprint(false)}
                    onCreated={() => setShowCreateSprint(false)}
                />
            )}

            {confirmCloseSprintId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setConfirmCloseSprintId(null)}
                    />
                    <div className="relative modal-panel rounded-xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-1" style={{ color: "#E24B4A" }} />
                            <div>
                                <h2 className="font-semibold text-xl" style={{ color: "var(--c-text)" }}>
                                    Ukončit sprint
                                </h2>
                                <p className="mt-1" style={{ color: "var(--c-text-3)" }}>
                                    Opravdu chcete sprint ukončit? Tato akce je nevratná. Nedokončené úkoly budou
                                    přesunuty do backlogu.
                                </p>
                            </div>
                        </div>
                        {closeError && <p className="text-xs text-red-400">{closeError}</p>}
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    setConfirmCloseSprintId(null)
                                    setCloseError(null)
                                }}
                                className="btn-secondary"
                            >
                                Zrušit
                            </button>
                            <button
                                onClick={async () => {
                                    const id = confirmCloseSprintId!
                                    const sprint = sprints.find((s) => s.id === id)!
                                    const now = new Date().toISOString()
                                    setCloseError(null)
                                    try {
                                        await closeSprint.mutateAsync({
                                            sprintId: id,
                                            name: sprint.name,
                                            startDate: sprint.startDate ?? now,
                                            endDate: sprint.endDate ?? now,
                                        })
                                        const nextSprint = sprints.find((s) => s.state === "future")
                                        if (nextSprint) {
                                            const now = new Date()
                                            const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
                                            await startSprint.mutateAsync({
                                                sprintId: nextSprint.id,
                                                name: nextSprint.name,
                                                startDate: nextSprint.startDate ?? now.toISOString(),
                                                endDate: nextSprint.endDate ?? twoWeeks.toISOString(),
                                            })
                                        }
                                        setConfirmCloseSprintId(null)
                                        refetch()
                                    } catch (e) {
                                        setCloseError(e instanceof Error ? e.message : "Operace se nezdařila")
                                    }
                                }}
                                disabled={closeSprint.isPending || startSprint.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors"
                                style={{ background: "#E24B4A", color: "#fff" }}
                            >
                                Ukončit sprint
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default RoadmapViewView
