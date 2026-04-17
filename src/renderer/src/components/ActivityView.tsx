import { useState, useEffect, useRef } from "react"
import { ChevronLeft, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import type { JiraUser, JiraIssue, JiraProject, AppPrefs } from "../types/jira"

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityType = "created" | "status_change" | "comment" | "worklog" | "assignment" | "field_change"

interface ActivityEntry {
    id: string
    date: string // ISO
    type: ActivityType
    issue: JiraIssue
    details: string
}

const TYPE_LABEL: Record<ActivityType, string> = {
    created: "Vytvořeno",
    status_change: "Stav",
    comment: "Komentář",
    worklog: "Worklog",
    assignment: "Přiřazení",
    field_change: "Změna",
}

const TYPE_CLASS: Record<ActivityType, string> = {
    created: "bg-yellow-500/15 text-yellow-400",
    status_change: "bg-blue-500/15 text-blue-400",
    comment: "bg-green-500/15 text-green-400",
    worklog: "bg-purple-500/15 text-purple-400",
    assignment: "bg-orange-500/15 text-orange-400",
    field_change: "bg-gray-500/15 text-gray-400",
}

const RANGE_OPTIONS = [
    { value: 7, label: "7 dní" },
    { value: 14, label: "14 dní" },
    { value: 30, label: "30 dní" },
    { value: 90, label: "90 dní" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60_000)
    if (min < 2) return "Právě teď"
    if (min < 60) return `před ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `před ${h} h`
    const d = Math.floor(h / 24)
    if (d < 7) return `před ${d} d`
    return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" })
}

function formatAbsolute(iso: string): string {
    return new Date(iso).toLocaleString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatSeconds(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

const MEANINGFUL_FIELDS = new Set([
    "status",
    "assignee",
    "priority",
    "summary",
    "description",
    "duedate",
    "labels",
    "sprint",
    "story_points",
    "customfield_10016",
    "issuetype",
    "resolution",
])

// ── ActivityView ──────────────────────────────────────────────────────────────

interface Props {
    prefs: AppPrefs
    selectedProject: JiraProject | null
    onSelectIssue: (issue: JiraIssue) => void
}

export function ActivityView({ selectedProject, onSelectIssue }: Props) {
    const today = new Date()
    const [selectedUser, setSelectedUser] = useState<JiraUser | null>(null)
    const [myself, setMyself] = useState<JiraUser | null>(null)
    const [userSearch, setUserSearch] = useState("")
    const [userResults, setUserResults] = useState<JiraUser[]>([])
    const [userDropdownOpen, setUserDropdownOpen] = useState(false)
    const [rangeDays, setRangeDays] = useState(30)
    const [activities, setActivities] = useState<ActivityEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const userSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        jiraApi
            .getMyself()
            .then((u) => {
                setMyself(u)
                setSelectedUser(u)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (!selectedUser) return
        loadActivity(selectedUser, rangeDays, selectedProject)
    }, [selectedUser, rangeDays, selectedProject])

    const loadActivity = async (user: JiraUser, days: number, project: JiraProject | null) => {
        setLoading(true)
        setError(null)
        const sinceDate = new Date(today)
        sinceDate.setDate(sinceDate.getDate() - days)
        const sinceMs = sinceDate.getTime()

        try {
            const projectClause = project ? ` AND project = "${project.key}"` : ""
            const jql = `(assignee = "${user.accountId}" OR reporter = "${user.accountId}" OR worklogAuthor = "${user.accountId}") AND updated >= "-${days}d"${projectClause} ORDER BY updated DESC`
            const { issues } = await jiraApi.searchIssues(jql, 30)

            const entries: ActivityEntry[] = []

            // Issues created by user
            for (const issue of issues) {
                if (issue.fields.reporter?.accountId === user.accountId) {
                    const created = issue.fields.created
                    if (new Date(created).getTime() >= sinceMs) {
                        entries.push({
                            id: `created-${issue.id}`,
                            date: created,
                            type: "created",
                            issue,
                            details: issue.fields.issuetype.name,
                        })
                    }
                }
            }

            // Comments by user (already in issue.fields.comment.comments)
            for (const issue of issues) {
                for (const comment of issue.fields.comment?.comments ?? []) {
                    if (comment.author.accountId !== user.accountId) continue
                    if (new Date(comment.created).getTime() < sinceMs) continue
                    const text =
                        comment.body?.content
                            ?.flatMap((n: any) => n.content ?? [])
                            ?.filter((n: any) => n.type === "text")
                            ?.map((n: any) => n.text)
                            ?.join("") ?? ""
                    entries.push({
                        id: `comment-${comment.id}`,
                        date: comment.created,
                        type: "comment",
                        issue,
                        details: text.slice(0, 120) || "—",
                    })
                }
            }

            // Changelogs + worklogs in parallel
            await Promise.all(
                issues.slice(0, 20).map(async (issue) => {
                    try {
                        const [changelogRes, worklogRes] = await Promise.all([
                            jiraApi.getIssueChangelog(issue.key),
                            jiraApi.getIssueWorklogs(issue.key, sinceMs),
                        ])

                        for (const cl of changelogRes.values) {
                            if (cl.author.accountId !== user.accountId) continue
                            if (new Date(cl.created).getTime() < sinceMs) continue
                            for (const item of cl.items) {
                                if (!MEANINGFUL_FIELDS.has(item.field)) continue
                                let type: ActivityType = "field_change"
                                let details = ""
                                if (item.field === "status") {
                                    type = "status_change"
                                    details = `${item.fromString ?? "—"} → ${item.toString ?? "—"}`
                                } else if (item.field === "assignee") {
                                    type = "assignment"
                                    details = `Přiřazeno: ${item.toString ?? "nikdo"}`
                                } else if (item.field === "priority") {
                                    details = `Priorita: ${item.fromString ?? "—"} → ${item.toString ?? "—"}`
                                } else if (item.field === "duedate") {
                                    details = `Termín: ${item.toString ?? "odebrán"}`
                                } else {
                                    details = `${item.field}: ${item.toString ?? "—"}`
                                }
                                entries.push({
                                    id: `cl-${cl.id}-${item.field}`,
                                    date: cl.created,
                                    type,
                                    issue,
                                    details,
                                })
                            }
                        }

                        for (const wl of worklogRes.worklogs) {
                            if (wl.author.accountId !== user.accountId) continue
                            if (new Date(wl.started).getTime() < sinceMs) continue
                            const note =
                                wl.comment?.content
                                    ?.flatMap((n: any) => n.content ?? [])
                                    ?.filter((n: any) => n.type === "text")
                                    ?.map((n: any) => n.text)
                                    ?.join("") ?? ""
                            entries.push({
                                id: `wl-${wl.id}`,
                                date: wl.started,
                                type: "worklog",
                                issue,
                                details: formatSeconds(wl.timeSpentSeconds) + (note ? ` — ${note}` : ""),
                            })
                        }
                    } catch {
                        // skip issue on error
                    }
                })
            )

            entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setActivities(entries)
        } catch (e: any) {
            setError(e.message ?? "Chyba při načítání aktivity")
        } finally {
            setLoading(false)
        }
    }

    const handleUserSearch = (q: string) => {
        setUserSearch(q)
        if (userSearchRef.current) clearTimeout(userSearchRef.current)
        if (!q.trim()) {
            setUserResults([])
            return
        }
        userSearchRef.current = setTimeout(async () => {
            try {
                setUserResults(await jiraApi.searchUsers(q))
            } catch {
                setUserResults([])
            }
        }, 400)
    }

    const selectUser = (u: JiraUser) => {
        setSelectedUser(u)
        setUserDropdownOpen(false)
        setUserSearch("")
        setUserResults([])
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-800/60 shrink-0">
                <div className="flex items-center gap-2">
                    <h1 className="text-base font-semibold text-gray-100">Aktivita</h1>
                    {loading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
                    {!loading && selectedUser && (
                        <button
                            onClick={() => loadActivity(selectedUser, rangeDays, selectedProject)}
                            className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
                            title="Obnovit"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {error && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {error}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Date range */}
                    <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-0.5">
                        {RANGE_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setRangeDays(opt.value)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                    rangeDays === opt.value
                                        ? "bg-gray-700 text-gray-100"
                                        : "text-gray-500 hover:text-gray-300"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* User picker */}
                    <div className="relative">
                        <button
                            onClick={() => setUserDropdownOpen((v) => !v)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:bg-gray-800 transition-colors text-sm"
                        >
                            {selectedUser ? (
                                <>
                                    <img
                                        src={selectedUser.avatarUrls["48x48"]}
                                        className="w-5 h-5 rounded-full"
                                        alt=""
                                    />
                                    <span className="text-gray-200 max-w-[140px] truncate">
                                        {selectedUser.displayName}
                                    </span>
                                </>
                            ) : (
                                <span className="text-gray-400">Vybrat uživatele</span>
                            )}
                            <ChevronLeft className="w-3 h-3 text-gray-500 -rotate-90" />
                        </button>

                        {userDropdownOpen && (
                            <div className="modal-panel absolute right-0 top-full mt-1 z-40 w-72 rounded-xl shadow-xl overflow-hidden">
                                <div className="p-2 border-b border-gray-800/60">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={userSearch}
                                        onChange={(e) => handleUserSearch(e.target.value)}
                                        placeholder="Hledat uživatele…"
                                        className="input w-full text-sm py-1.5"
                                    />
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {myself && !userSearch && (
                                        <button
                                            onClick={() => selectUser(myself)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800/60 text-left"
                                        >
                                            <img
                                                src={myself.avatarUrls["48x48"]}
                                                className="w-6 h-6 rounded-full"
                                                alt=""
                                            />
                                            <div>
                                                <p className="text-sm text-gray-200">{myself.displayName}</p>
                                                <p className="text-xs text-gray-500">Já</p>
                                            </div>
                                        </button>
                                    )}
                                    {userResults.map((u) => (
                                        <button
                                            key={u.accountId}
                                            onClick={() => selectUser(u)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800/60 text-left"
                                        >
                                            <img src={u.avatarUrls["48x48"]} className="w-6 h-6 rounded-full" alt="" />
                                            <div>
                                                <p className="text-sm text-gray-200">{u.displayName}</p>
                                                <p className="text-xs text-gray-500 truncate">{u.emailAddress}</p>
                                            </div>
                                        </button>
                                    ))}
                                    {userSearch && userResults.length === 0 && (
                                        <p className="text-xs text-gray-500 px-3 py-3 text-center">
                                            Žádní uživatelé nenalezeni
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                {loading && activities.length === 0 ? (
                    <div className="flex items-center justify-center h-32 gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Načítám aktivitu…</span>
                    </div>
                ) : !loading && activities.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                        <p className="text-sm text-gray-500">Žádná aktivita za zvolené období</p>
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10 app-bg">
                            <tr className="border-b border-gray-800/60">
                                <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5 w-36">Čas</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-28">Typ</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5 w-28">Úkol</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Popis</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activities.map((entry) => (
                                <tr
                                    key={entry.id}
                                    onClick={() => onSelectIssue(entry.issue)}
                                    className="border-b border-gray-800/30 hover:bg-gray-800/30 cursor-pointer transition-colors"
                                >
                                    {/* Time */}
                                    <td
                                        className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap"
                                        title={formatAbsolute(entry.date)}
                                    >
                                        {formatRelative(entry.date)}
                                    </td>

                                    {/* Type badge */}
                                    <td className="px-3 py-2.5">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${TYPE_CLASS[entry.type]}`}
                                        >
                                            {TYPE_LABEL[entry.type]}
                                        </span>
                                    </td>

                                    {/* Issue key */}
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1.5">
                                            <img
                                                src={entry.issue.fields.issuetype.iconUrl}
                                                alt={entry.issue.fields.issuetype.name}
                                                className="w-3.5 h-3.5 shrink-0"
                                            />
                                            <span className="font-mono text-xs text-blue-400 whitespace-nowrap">
                                                {entry.issue.key}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Summary */}
                                    <td className="px-3 py-2.5 max-w-xs">
                                        <span className="text-xs text-gray-300 line-clamp-1">
                                            {entry.issue.fields.summary}
                                        </span>
                                    </td>

                                    {/* Detail */}
                                    <td className="px-3 py-2.5 max-w-sm">
                                        <span className="text-xs text-gray-500 line-clamp-1">{entry.details}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Close user dropdown on outside click */}
            {userDropdownOpen && <div className="fixed inset-0 z-30" onClick={() => setUserDropdownOpen(false)} />}
        </div>
    )
}
