import { useState } from "react"
import { X, Search, Plus, Loader2, AlertCircle } from "lucide-react"
import { jiraApi } from "../../../utils/jira-api"
import { useIssues } from "../../../hooks/useIssues"
import type { JiraUser, JiraIssue, JiraProject, AppPrefs } from "../../../types/jira"
import { parseTimeInput, toDayStarted, formatSeconds, type WorklogCell } from "../utils"

interface DayPopupProps {
    day: Date
    cells: WorklogCell[]
    selectedUser: JiraUser
    selectedProject: JiraProject | null
    prefs: AppPrefs
    updatedSince: string
    onClose: () => void
    onLogged: (cell: WorklogCell) => void
}

export function DayPopup({
    day,
    cells,
    selectedUser,
    selectedProject,
    prefs,
    updatedSince,
    onClose,
    onLogged,
}: DayPopupProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
    const [timeInput, setTimeInput] = useState("")
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const popupPrefs = { ...prefs, doneMaxAgeDays: -1, maxResults: 5 }

    const { issues, loading: issuesLoading } = useIssues({
        selectedProject,
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
        } catch (e) {
            setSubmitError((e as Error).message ?? "Chyba při logování")
        } finally {
            setSubmitting(false)
        }
    }

    const dateLabel = day.toLocaleDateString("cs-CZ", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="modal-panel rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh] overflow-hidden"
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
                                        <span className="text-xs text-gray-400 truncate flex-1">
                                            {c.issueSummary}
                                        </span>
                                        <span className="text-xs text-gray-300 shrink-0">
                                            {formatSeconds(c.timeSpentSeconds)}
                                        </span>
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
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        setSelectedIssue(null)
                                    }}
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
                                    <span className="text-xs font-mono text-blue-400 shrink-0">
                                        {selectedIssue.key}
                                    </span>
                                    <span className="text-xs text-gray-300 truncate flex-1">
                                        {selectedIssue.fields.summary}
                                    </span>
                                    <button
                                        onClick={() => setSelectedIssue(null)}
                                        className="text-gray-500 hover:text-gray-300 shrink-0"
                                    >
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
                                            <span className="text-xs font-mono text-blue-400 shrink-0 mt-0.5">
                                                {issue.key}
                                            </span>
                                            <span className="text-xs text-gray-300 line-clamp-2">
                                                {issue.fields.summary}
                                            </span>
                                        </button>
                                    ))}
                                    {!issuesLoading && issues.length === 0 && (
                                        <p className="text-xs text-gray-500 px-3 py-3 text-center">
                                            Žádné úkoly nenalezeny
                                        </p>
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
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Logování…
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" /> Zalogovat
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
