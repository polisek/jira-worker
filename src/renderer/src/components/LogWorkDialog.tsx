import { useState, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import type { JiraIssue, JiraUser } from "../types/jira"

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

interface Props {
    issue: JiraIssue
    dailyWorkHours: number
    onClose: () => void
    onLogged?: () => void
}

export function LogWorkDialog({ issue, dailyWorkHours, onClose, onLogged }: Props) {
    const today = new Date()
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
    const [selectedDay, setSelectedDay] = useState<Date>(today)
    const [worklogMap, setWorklogMap] = useState<WorklogMap>({})
    const [loadingWorklogs, setLoadingWorklogs] = useState(false)
    const [myself, setMyself] = useState<JiraUser | null>(null)
    const [timeInput, setTimeInput] = useState("")
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [loggedToday, setLoggedToday] = useState(false)

    useEffect(() => {
        jiraApi.getMyself().then(setMyself).catch(() => {})
    }, [])

    const loadWorklogs = useCallback(async (user: JiraUser, monthStart: Date) => {
        setLoadingWorklogs(true)
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
                issues.map(async (iss) => {
                    try {
                        const { worklogs } = await jiraApi.getIssueWorklogs(iss.key, startMs)
                        for (const wl of worklogs) {
                            if (wl.author.accountId !== user.accountId) continue
                            const dateStr = wl.started.slice(0, 10)
                            if (dateStr < start || dateStr > end) continue
                            if (!map[dateStr]) map[dateStr] = []
                            const existing = map[dateStr].find((c) => c.issueKey === iss.key)
                            if (existing) {
                                existing.timeSpentSeconds += wl.timeSpentSeconds
                            } else {
                                map[dateStr].push({
                                    issueKey: iss.key,
                                    issueSummary: iss.fields.summary,
                                    timeSpentSeconds: wl.timeSpentSeconds,
                                })
                            }
                        }
                    } catch {}
                })
            )
            setWorklogMap(map)
        } catch {}
        finally {
            setLoadingWorklogs(false)
        }
    }, [])

    useEffect(() => {
        if (myself) loadWorklogs(myself, currentMonth)
    }, [myself, currentMonth, loadWorklogs])

    const handleSubmit = async () => {
        const seconds = parseTimeInput(timeInput)
        if (!seconds) {
            setSubmitError("Neplatný formát času (např. 2h 30m, 1.5h, 45m)")
            return
        }
        setSubmitting(true)
        setSubmitError(null)
        try {
            await jiraApi.logWork(issue.key, seconds, note || undefined, toDayStarted(selectedDay))
            const key = toDateStr(selectedDay)
            setWorklogMap((prev) => {
                const existing = prev[key] ?? []
                const idx = existing.findIndex((c) => c.issueKey === issue.key)
                if (idx >= 0) {
                    const updated = [...existing]
                    updated[idx] = { ...updated[idx], timeSpentSeconds: updated[idx].timeSpentSeconds + seconds }
                    return { ...prev, [key]: updated }
                }
                return { ...prev, [key]: [...existing, { issueKey: issue.key, issueSummary: issue.fields.summary, timeSpentSeconds: seconds }] }
            })
            setTimeInput("")
            setNote("")
            setLoggedToday(true)
            onLogged?.()
        } catch (e: any) {
            setSubmitError(e.message ?? "Chyba při logování")
        } finally {
            setSubmitting(false)
        }
    }

    const dailySec = dailyWorkHours * 3600
    const weeks = buildCalendarGrid(currentMonth.getFullYear(), currentMonth.getMonth())
    const todayStr = toDateStr(today)
    const selectedDayStr = toDateStr(selectedDay)

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

    const selectedDateLabel = selectedDay.toLocaleDateString("cs-CZ", {
        weekday: "long", day: "numeric", month: "long",
    })
    const selectedCells = worklogMap[selectedDayStr] ?? []
    const selectedTotalSec = selectedCells.reduce((s, c) => s + c.timeSpentSeconds, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="modal-panel rounded-xl shadow-2xl w-full mx-4 flex flex-col overflow-hidden"
                style={{ maxWidth: 680, maxHeight: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 shrink-0">
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Zaznamenat práci</p>
                        <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2 min-w-0">
                            <span className="font-mono text-blue-400 shrink-0">{issue.key}</span>
                            <span className="text-gray-400 font-normal truncate">{issue.fields.summary}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1 rounded shrink-0 ml-3">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden min-h-0">
                    {/* Left: Mini calendar */}
                    <div className="flex flex-col border-r border-gray-800/60 p-4 shrink-0" style={{ width: 300 }}>
                        {/* Month navigation */}
                        <div className="flex items-center justify-between mb-3 gap-1">
                            <button
                                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                                className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-200">
                                    {MONTHS_CZ[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                </span>
                                {loadingWorklogs && <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />}
                            </div>
                            <button
                                onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                                className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Day headers */}
                        <div className="grid grid-cols-7 mb-1">
                            {DAYS_CZ.map((d, i) => (
                                <div
                                    key={d}
                                    className={`text-center text-[10px] font-medium py-0.5 ${i >= 5 ? "text-gray-600" : "text-gray-500"}`}
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Calendar grid */}
                        <div className="flex flex-col gap-px">
                            {weeks.map((week, wi) => (
                                <div key={wi} className="grid grid-cols-7 gap-px">
                                    {week.map((day, di) => {
                                        if (!day) return <div key={di} className="rounded aspect-square" />
                                        const dateStr = toDateStr(day)
                                        const cells = worklogMap[dateStr] ?? []
                                        const totalSec = cells.reduce((s, c) => s + c.timeSpentSeconds, 0)
                                        const isToday = dateStr === todayStr
                                        const isSelected = dateStr === selectedDayStr
                                        const weekend = isWeekend(day)
                                        const cellColor = getCellColor(day, totalSec)
                                        const badgeColor = getBadgeColor(day, totalSec)

                                        return (
                                            <button
                                                key={di}
                                                onClick={() => { setSelectedDay(day); setLoggedToday(false) }}
                                                className={[
                                                    "rounded border flex flex-col items-center justify-start pt-1 pb-1 px-0.5 cursor-pointer transition-all min-h-[44px]",
                                                    isSelected
                                                        ? "border-blue-500 ring-1 ring-blue-500/50 bg-blue-500/10"
                                                        : cellColor || (weekend
                                                            ? "border-gray-800/30 bg-gray-900/10"
                                                            : "border-gray-800/50 bg-gray-900/30"),
                                                    "hover:border-gray-600/60",
                                                ].join(" ")}
                                            >
                                                <span
                                                    className={[
                                                        "text-[10px] font-semibold w-5 h-5 flex items-center justify-center rounded-full leading-none",
                                                        isToday
                                                            ? "bg-blue-500 text-white"
                                                            : weekend ? "text-gray-600" : "text-gray-400",
                                                    ].join(" ")}
                                                >
                                                    {day.getDate()}
                                                </span>
                                                {totalSec > 0 && (
                                                    <span className={`text-[9px] font-medium px-1 rounded mt-0.5 leading-tight ${badgeColor}`}>
                                                        {formatSeconds(totalSec)}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto min-w-0">
                        {/* Selected day label */}
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Vybraný den</p>
                            <p className="text-sm font-medium text-gray-200 capitalize">{selectedDateLabel}</p>
                            {selectedTotalSec > 0 && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Celkem zalogováno:{" "}
                                    <span className="text-gray-300 font-medium">{formatSeconds(selectedTotalSec)}</span>
                                </p>
                            )}
                        </div>

                        {/* Existing worklogs for selected day */}
                        {selectedCells.length > 0 && (
                            <div className="rounded-lg border border-gray-800/60 overflow-hidden">
                                {selectedCells.map((c, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-2 px-3 py-2 border-b border-gray-800/40 last:border-b-0 ${
                                            c.issueKey === issue.key ? "bg-blue-500/5" : ""
                                        }`}
                                    >
                                        <span
                                            className={`text-[10px] font-mono shrink-0 ${
                                                c.issueKey === issue.key ? "text-blue-400" : "text-gray-500"
                                            }`}
                                        >
                                            {c.issueKey}
                                        </span>
                                        <span className="text-xs text-gray-400 truncate flex-1">{c.issueSummary}</span>
                                        <span className="text-xs text-gray-300 shrink-0 font-medium">
                                            {formatSeconds(c.timeSpentSeconds)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {loggedToday && (
                            <p className="text-xs text-green-400 flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> Práce zalogována. Přidejte další nebo zavřete dialog.
                            </p>
                        )}

                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="form-label">Čas (2h 30m · 1.5h · 45m · 1:30)</label>
                                <input
                                    type="text"
                                    value={timeInput}
                                    onChange={(e) => setTimeInput(e.target.value)}
                                    placeholder="např. 2h 30m"
                                    className="input w-full text-sm"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
                                />
                            </div>

                            <div>
                                <label className="form-label">Poznámka (volitelně)</label>
                                <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Co jsem dělal…"
                                    className="input w-full text-sm"
                                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
                                />
                            </div>

                            {submitError && (
                                <p className="text-xs text-red-400 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {submitError}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!timeInput || submitting}
                            className="btn-primary flex items-center justify-center gap-2 mt-auto"
                        >
                            {submitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Logování…</>
                            ) : (
                                <><Plus className="w-4 h-4" /> Zalogovat</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
