import { useState, useEffect, useRef } from "react"
import { jiraApi } from "../lib/jira-api"
import { UserPicker } from "./UserPicker"
import { fmtTime } from "../lib/time"
import type { JiraIssue, JiraTransition, JiraUser, JiraSprint, JiraProject } from "../types/jira"

interface Props {
    issue: JiraIssue
    x: number
    y: number
    selectedProject: JiraProject | null
    onClose: () => void
    onUpdated: () => void
}

export function IssueContextMenu({ issue, x, y, selectedProject, onClose, onUpdated }: Props) {
    const [transitions, setTransitions] = useState<JiraTransition[]>([])
    const [users, setUsers] = useState<JiraUser[]>([])
    const [sprints, setSprints] = useState<JiraSprint[]>([])
    const [myself, setMyself] = useState<JiraUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [estimateDraft, setEstimateDraft] = useState(
        issue.fields.timeoriginalestimate ? fmtTime(issue.fields.timeoriginalestimate) : ""
    )
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const onMouse = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose()
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        document.addEventListener("mousedown", onMouse)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onMouse)
            document.removeEventListener("keydown", onKey)
        }
    }, [onClose])

    useEffect(() => {
        const projectKey = selectedProject?.key ?? issue.fields.project?.key
        if (!projectKey) { setLoading(false); return }
        Promise.all([
            jiraApi.getTransitions(issue.key),
            jiraApi.getAssignableUsers(projectKey),
            jiraApi.getBoards(projectKey)
                .then(({ values }) =>
                    values.length > 0
                        ? jiraApi.getBoardSprints(values[0].id).then(r => r.values)
                        : []
                )
                .catch(() => [] as JiraSprint[]),
            jiraApi.getMyself().catch(() => null),
        ]).then(([transRes, userRes, sprintRes, myselfRes]) => {
            setTransitions(transRes.transitions)
            setUsers(userRes)
            setSprints(sprintRes)
            setMyself(myselfRes)
        }).catch(console.error)
        .finally(() => setLoading(false))
    }, [issue.key, selectedProject])

    const wrap = async (fn: () => Promise<void>) => {
        setSaving(true)
        setError(null)
        try { await fn(); onUpdated(); onClose() }
        catch (e: any) {
            setError(e?.message ?? "Chyba při ukládání")
            setSaving(false)
        }
    }

    const currentSprintId = issue.fields.customfield_10020?.[0]?.id

    const left = Math.min(x, window.innerWidth - 296)
    const top = Math.min(y, window.innerHeight - 480)

    return (
        <div
            ref={ref}
            className="fixed z-[9999] w-72 rounded-xl shadow-2xl border overflow-visible"
            style={{ left, top, background: "var(--c-bg-card)", borderColor: "var(--c-border)" }}
            onContextMenu={e => e.preventDefault()}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b rounded-t-xl" style={{ borderColor: "var(--c-border)", background: "var(--c-bg-titlebar)" }}>
                <div className="flex items-center gap-2">
                    <img src={issue.fields.issuetype.iconUrl} alt={issue.fields.issuetype.name} className="w-4 h-4 shrink-0" />
                    <span className="text-blue-400 font-mono text-xs font-semibold">{issue.key}</span>
                </div>
                <p className="text-xs font-medium mt-1 line-clamp-2" style={{ color: "var(--c-text)" }}>
                    {issue.fields.summary}
                </p>
            </div>

            {loading ? (
                <div className="px-4 py-6 text-center text-xs text-gray-500">Načítám…</div>
            ) : (
                <div className="px-4 py-3 flex flex-col gap-3">
                    {/* Status */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
                            Stav
                        </label>
                        <select
                            className="input w-full"
                            defaultValue=""
                            onChange={e => e.target.value && wrap(() => jiraApi.doTransition(issue.key, e.target.value))}
                            disabled={saving}
                        >
                            <option value="">{issue.fields.status.name}</option>
                            {transitions.map(t => (
                                <option key={t.id} value={t.id}>{t.to.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Assignee */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Přiřazeno
                            </label>
                            {myself && (
                                <button
                                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                                    onClick={() => wrap(() => jiraApi.assignIssue(issue.key, myself.accountId))}
                                    disabled={saving || issue.fields.assignee?.accountId === myself.accountId}
                                >
                                    Přiřadit mně
                                </button>
                            )}
                        </div>
                        <UserPicker
                            users={users}
                            value={issue.fields.assignee}
                            onChange={user => wrap(() => jiraApi.assignIssue(issue.key, user?.accountId ?? null))}
                            placeholder="Přiřadit…"
                        />
                    </div>

                    {/* Sprint */}
                    {sprints.length > 0 && (
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
                                Sprint
                            </label>
                            <select
                                className="input w-full"
                                defaultValue={currentSprintId ?? ""}
                                onChange={e => wrap(() =>
                                    e.target.value
                                        ? jiraApi.moveToSprint(Number(e.target.value), issue.key)
                                        : jiraApi.moveToBacklog(issue.key)
                                )}
                                disabled={saving}
                            >
                                <option value="">— Bez sprintu —</option>
                                {sprints.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Původní odhad */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1 block">
                            Původní odhad
                        </label>
                        <div className="flex gap-1.5">
                            <input
                                className="input flex-1 text-sm"
                                value={estimateDraft}
                                onChange={e => setEstimateDraft(e.target.value)}
                                placeholder="např. 2h, 1h 30m, 1d"
                                disabled={saving}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && estimateDraft.trim())
                                        wrap(() => jiraApi.updateIssue(issue.key, { timetracking: { originalEstimate: estimateDraft.trim() } }))
                                }}
                            />
                            <button
                                className="btn-sm px-3 shrink-0"
                                onClick={() => estimateDraft.trim() && wrap(() => jiraApi.updateIssue(issue.key, { timetracking: { originalEstimate: estimateDraft.trim() } }))}
                                disabled={saving || !estimateDraft.trim()}
                            >
                                Uložit
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="text-[10px] text-red-400 bg-red-900/20 border border-red-700/30 rounded px-2 py-1">{error}</p>
                    )}
                    {saving && (
                        <p className="text-[10px] text-center text-gray-500">Ukládám…</p>
                    )}
                </div>
            )}
        </div>
    )
}
