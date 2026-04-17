import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, X, Search, Plus, Loader2, AlertCircle } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import { useIssues } from "../hooks/useIssues"
import type { JiraUser, JiraIssue, AppPrefs } from "../types/jira"

interface WorklogCell {
    issueKey: string
    issueSummary: string
    timeSpentSeconds: number
}

type WorklogMap = Record<string, WorklogCell[]>

const DAYS_CZ = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]
const MONTHS_CZ = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
]

function toDateStr(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

function toDayStarted(date: Date): string {
    // Jira started format: "2025-01-15T09:00:00.000+0000"
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}T09:00:00.000+0000`
}

function parseTimeInput(raw: string): number | null {
    const s = raw.trim().toLowerCase()
    const hm = s.match(/^(\d+(?:\.\d+)?)h\s*(?:(\d+)m?)?$/)
    if (hm) return Math.round(parseFloat(hm[1]) * 3600 + parseInt(hm[2] ?? "0") * 60)
    const m = s.match(/^(\d+)m$/)
    if (m) return parseInt(m[1]) * 60
    const colon = s.match(/^(\d+):(\d+)$/)
    if (colon) return parseInt(colon[1]) * 3600 + parseInt(colon[2]) * 60
    const num = parseFloat(s)
    if (!isNaN(num) && num > 0) return Math.round(num * 3600)
    return null
}

function formatSeconds(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6
}

function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1)
    // Mon=0 .. Sun=6
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = [
        ...Array(startDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ]
    while (cells.length % 7 !== 0) cells.push(null)
    const weeks: (Date | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
}

// ── DayPopup ──────────────────────────────────────────────────────────────────

interface DayPopupProps {
    day: Date
    cells: WorklogCell[]
    selectedUser: JiraUser
    prefs: AppPrefs
    updatedSince: string
    onClose: () => void
    onLogged: (cell: WorklogCell) => void
}

function DayPopup({ day, cells, selectedUser, prefs, updatedSince, onClose, onLogged }: DayPopupProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
    const [timeInput, setTimeInput] = useState("")
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const popupPrefs = { ...prefs, doneMaxAgeDays: -1, maxResults: 5 }

    const { issues, loading: issuesLoading } = useIssues({
        selectedProject: null,
        filter: "mine",
        searchQuery,
        prefs: popupPrefs,
        assigneeAccountId: selectedUser.accountId,
        updatedSince,
    })

    const handleSubmit = async () => {
        if (!selectedIssue) return
        const seconds = parseTimeInput(timeInput)
        if (!seconds) {
            setSubmitError("Neplatný formát času (např. 2h 30m, 1.5h, 45m)")
            return
        }
        setSubmitting(true)
        setSubmitError(null)
        try {
            await jiraApi.logWork(selectedIssue.key, seconds, note || undefined, toDayStarted(day))
            onLogged({
                issueKey: selectedIssue.key,
                issueSummary: selectedIssue.fields.summary,
                timeSpentSeconds: seconds,
            })
            setSelectedIssue(null)
            setTimeInput("")
            setNote("")
            setSearchQuery("")
        } catch (e: any) {
            setSubmitError(e.message ?? "Chyba při logování")
        } finally {
            setSubmitting(false)
        }
    }

    const dateLabel = day.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-[#151820] border border-gray-700/60 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 shrink-0">
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Worklog</p>
                        <h2 className="text-base font-semibold text-gray-100 capitalize">{dateLabel}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto flex flex-col">
                    {/* Existing worklogs */}
                    {cells.length > 0 && (
                        <div className="px-5 py-3 border-b border-gray-800/60">
                            <p className="text-xs text-gray-500 mb-2">Zalogováno tento den</p>
                            <div className="flex flex-col gap-1.5">
                                {cells.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-mono text-blue-400 shrink-0">{c.issueKey}</span>
                                        <span className="text-xs text-gray-400 truncate flex-1">{c.issueSummary}</span>
                                        <span className="text-xs text-gray-300 shrink-0">{formatSeconds(c.timeSpentSeconds)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-800/60 flex justify-between text-xs">
                                <span className="text-gray-500">Celkem</span>
                                <span className="text-gray-200 font-medium">
                                    {formatSeconds(cells.reduce((s, c) => s + c.timeSpentSeconds, 0))}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Add new worklog */}
                    <div className="px-5 py-4 flex flex-col gap-3">
                        <p className="text-xs text-gray-500">Přidat worklog</p>

                        {/* Issue search + list */}
                        <div>
                            <label className="form-label">Úkol</label>
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedIssue(null) }}
                                    placeholder="Hledat úkol…"
                                    className="input w-full pl-8 text-sm"
                                />
                                {issuesLoading && (
                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 animate-spin" />
                                )}
                            </div>

                            {/* Selected issue badge */}
                            {selectedIssue && (
                                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-2">
                                    <span className="text-xs font-mono text-blue-400 shrink-0">{selectedIssue.key}</span>
                                    <span className="text-xs text-gray-300 truncate flex-1">{selectedIssue.fields.summary}</span>
                                    <button onClick={() => setSelectedIssue(null)} className="text-gray-500 hover:text-gray-300 shrink-0">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            {/* Issue list */}
                            {!selectedIssue && (
                                <div className="flex flex-col border border-gray-800/60 rounded-lg overflow-hidden">
                                    {issues.slice(0, 5).map((issue) => (
                                        <button
                                            key={issue.id}
                                            onClick={() => setSelectedIssue(issue)}
                                            className="flex items-start gap-2 px-3 py-2 hover:bg-gray-800/60 text-left border-b border-gray-800/40 last:border-b-0 transition-colors"
                                        >
                                            <span className="text-xs font-mono text-blue-400 shrink-0 mt-0.5">{issue.key}</span>
                                            <span className="text-xs text-gray-300 line-clamp-2">{issue.fields.summary}</span>
                                        </button>
                                    ))}
                                    {!issuesLoading && issues.length === 0 && (
                                        <p className="text-xs text-gray-500 px-3 py-3 text-center">Žádné úkoly nenalezeny</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Time */}
                        <div>
                            <label className="form-label">Čas (2h 30m · 1.5h · 45m · 1:30)</label>
                            <input
                                type="text"
                                value={timeInput}
                                onChange={(e) => setTimeInput(e.target.value)}
                                placeholder="např. 2h 30m"
                                className="input w-full text-sm"
                            />
                        </div>

                        {/* Note */}
                        <div>
                            <label className="form-label">Poznámka (volitelně)</label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Co jsem dělal…"
                                className="input w-full text-sm"
                            />
                        </div>

                        {submitError && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {submitError}
                            </p>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={!selectedIssue || !timeInput || submitting}
                            className="btn-primary flex items-center justify-center gap-2"
                        >
                            {submitting
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Logování…</>
                                : <><Plus className="w-4 h-4" /> Zalogovat</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── WorkLogView ───────────────────────────────────────────────────────────────

interface Props {
    prefs: AppPrefs
}

export function WorkLogView({ prefs }: Props) {
    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
    const updatedSince = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1))
    const [myself, setMyself] = useState<JiraUser | null>(null)
    const [selectedUser, setSelectedUser] = useState<JiraUser | null>(null)
    const [userSearch, setUserSearch] = useState("")
    const [userResults, setUserResults] = useState<JiraUser[]>([])
    const [userDropdownOpen, setUserDropdownOpen] = useState(false)
    const [worklogMap, setWorklogMap] = useState<WorklogMap>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedDay, setSelectedDay] = useState<Date | null>(null)
    const userSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Load myself on mount
    useEffect(() => {
        jiraApi.getMyself().then((u) => {
            setMyself(u)
            setSelectedUser(u)
        }).catch(() => {})
    }, [])

    // Load worklogs when month or user changes
    useEffect(() => {
        if (!selectedUser) return
        loadWorklogs(selectedUser, currentMonth)
    }, [selectedUser, currentMonth])

    const loadWorklogs = useCallback(async (user: JiraUser, monthStart: Date) => {
        setLoading(true)
        setError(null)
        const year = monthStart.getFullYear()
        const month = monthStart.getMonth()
        const start = toDateStr(new Date(year, month, 1))
        const end = toDateStr(new Date(year, month + 1, 0))
        const startMs = new Date(year, month, 1).getTime()

        try {
            const jql = `worklogAuthor = "${user.accountId}" AND worklogDate >= "${start}" AND worklogDate <= "${end}"`
            const { issues } = await jiraApi.searchIssues(jql, 200)

            const map: WorklogMap = {}
            await Promise.all(
                issues.map(async (issue) => {
                    try {
                        const { worklogs } = await jiraApi.getIssueWorklogs(issue.key, startMs)
                        for (const wl of worklogs) {
                            if (wl.author.accountId !== user.accountId) continue
                            const dateStr = wl.started.slice(0, 10)
                            if (dateStr < start || dateStr > end) continue
                            if (!map[dateStr]) map[dateStr] = []
                            // Merge same issue on same day
                            const existing = map[dateStr].find((c) => c.issueKey === issue.key)
                            if (existing) {
                                existing.timeSpentSeconds += wl.timeSpentSeconds
                            } else {
                                map[dateStr].push({
                                    issueKey: issue.key,
                                    issueSummary: issue.fields.summary,
                                    timeSpentSeconds: wl.timeSpentSeconds,
                                })
                            }
                        }
                    } catch {
                        // skip issue if worklog fetch fails
                    }
                })
            )
            setWorklogMap(map)
        } catch (e: any) {
            setError(e.message ?? "Chyba při načítání worklogů")
        } finally {
            setLoading(false)
        }
    }, [])

    const handleUserSearch = (q: string) => {
        setUserSearch(q)
        if (userSearchRef.current) clearTimeout(userSearchRef.current)
        if (!q.trim()) { setUserResults([]); return }
        userSearchRef.current = setTimeout(async () => {
            try {
                const users = await jiraApi.searchUsers(q)
                setUserResults(users)
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

    const handleLogged = (day: Date, cell: WorklogCell) => {
        const key = toDateStr(day)
        setWorklogMap((prev) => {
            const existing = prev[key] ?? []
            const idx = existing.findIndex((c) => c.issueKey === cell.issueKey)
            if (idx >= 0) {
                const updated = [...existing]
                updated[idx] = { ...updated[idx], timeSpentSeconds: updated[idx].timeSpentSeconds + cell.timeSpentSeconds }
                return { ...prev, [key]: updated }
            }
            return { ...prev, [key]: [...existing, cell] }
        })
    }

    const prevMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    const nextMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

    const weeks = buildCalendarGrid(currentMonth.getFullYear(), currentMonth.getMonth())
    const dailySec = prefs.dailyWorkHours * 3600

    const getCellColor = (day: Date, totalSec: number): string => {
        if (isWeekend(day) || totalSec === 0) return ""
        const ratio = totalSec / dailySec
        if (ratio >= 0.8) return "bg-green-500/15 border-green-500/30"
        if (ratio >= 0.5) return "bg-yellow-500/15 border-yellow-500/30"
        return "bg-red-500/15 border-red-500/30"
    }

    const getBadgeColor = (day: Date, totalSec: number): string => {
        if (isWeekend(day) || totalSec === 0) return "bg-gray-700 text-gray-400"
        const ratio = totalSec / dailySec
        if (ratio >= 0.8) return "bg-green-500/25 text-green-400"
        if (ratio >= 0.5) return "bg-yellow-500/25 text-yellow-400"
        return "bg-red-500/25 text-red-400"
    }

    const todayStr = toDateStr(today)

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h1 className="text-base font-semibold text-gray-100 min-w-[160px] text-center">
                        {MONTHS_CZ[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h1>
                    <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    {loading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin ml-1" />}
                    {error && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {error}
                        </span>
                    )}
                </div>

                {/* User picker */}
                <div className="relative">
                    <button
                        onClick={() => setUserDropdownOpen((v) => !v)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:bg-gray-800 transition-colors text-sm"
                    >
                        {selectedUser ? (
                            <>
                                <img src={selectedUser.avatarUrls["48x48"]} className="w-5 h-5 rounded-full" alt="" />
                                <span className="text-gray-200 max-w-[160px] truncate">{selectedUser.displayName}</span>
                            </>
                        ) : (
                            <span className="text-gray-400">Vybrat uživatele</span>
                        )}
                        <ChevronLeft className="w-3 h-3 text-gray-500 -rotate-90" />
                    </button>

                    {userDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 z-40 w-72 bg-[#151820] border border-gray-700/60 rounded-xl shadow-xl overflow-hidden">
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
                                        <img src={myself.avatarUrls["48x48"]} className="w-6 h-6 rounded-full" alt="" />
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
                                    <p className="text-xs text-gray-500 px-3 py-3 text-center">Žádní uživatelé nenalezeni</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Calendar */}
            <div className="flex-1 flex flex-col overflow-hidden px-3 pb-3 pt-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-px mb-px shrink-0">
                    {DAYS_CZ.map((d, i) => (
                        <div
                            key={d}
                            className={`text-center text-xs font-medium py-1.5 ${i >= 5 ? "text-gray-600" : "text-gray-500"}`}
                        >
                            {d}
                        </div>
                    ))}
                </div>

                {/* Weeks grid */}
                <div
                    className="flex-1 grid gap-px"
                    style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}
                >
                    {weeks.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 gap-px">
                            {week.map((day, di) => {
                                if (!day) {
                                    return <div key={di} className="bg-gray-900/20 rounded" />
                                }
                                const dateStr = toDateStr(day)
                                const cells = worklogMap[dateStr] ?? []
                                const totalSec = cells.reduce((s, c) => s + c.timeSpentSeconds, 0)
                                const isToday = dateStr === todayStr
                                const weekend = isWeekend(day)
                                const cellColor = getCellColor(day, totalSec)
                                const badgeColor = getBadgeColor(day, totalSec)

                                return (
                                    <div
                                        key={di}
                                        onClick={() => setSelectedDay(day)}
                                        className={`
                                            rounded border flex flex-col p-1.5 overflow-hidden cursor-pointer
                                            transition-colors hover:border-gray-600/60
                                            ${cellColor || (weekend ? "border-gray-800/30 bg-gray-900/10" : "border-gray-800/50 bg-gray-900/30")}
                                        `}
                                    >
                                        {/* Date number */}
                                        <div className="flex items-center justify-between mb-1 shrink-0">
                                            <span
                                                className={`
                                                    text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full
                                                    ${isToday ? "bg-blue-500 text-white" : weekend ? "text-gray-600" : "text-gray-400"}
                                                `}
                                            >
                                                {day.getDate()}
                                            </span>
                                            {totalSec > 0 && (
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                                                    {formatSeconds(totalSec)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Issue pills */}
                                        <div className="flex flex-col gap-0.5 overflow-hidden">
                                            {cells.map((c) => (
                                                <div
                                                    key={c.issueKey}
                                                    className="flex items-center gap-1 min-w-0"
                                                    title={`${c.issueKey} — ${c.issueSummary} (${formatSeconds(c.timeSpentSeconds)})`}
                                                >
                                                    <span className="text-[10px] font-mono text-blue-400 shrink-0">{c.issueKey}</span>
                                                    <span className="text-[10px] text-gray-500 truncate">{c.issueSummary}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Day popup */}
            {selectedDay && selectedUser && (
                <DayPopup
                    day={selectedDay}
                    cells={worklogMap[toDateStr(selectedDay)] ?? []}
                    selectedUser={selectedUser}
                    prefs={prefs}
                    updatedSince={updatedSince}
                    onClose={() => setSelectedDay(null)}
                    onLogged={(cell) => {
                        handleLogged(selectedDay, cell)
                    }}
                />
            )}

            {/* Close user dropdown on outside click */}
            {userDropdownOpen && (
                <div className="fixed inset-0 z-30" onClick={() => setUserDropdownOpen(false)} />
            )}
        </div>
    )
}
