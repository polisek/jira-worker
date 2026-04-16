import { useState, useEffect } from "react"
import { X, Filter, Bookmark, FilterX } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import { UserPicker } from "./UserPicker"
import type { JiraProject, JiraUser, JiraStatus, AdvancedFilter, SavedFilter } from "../types/jira"

const STORAGE_KEY = "jira-worker-saved-filters"

function loadSavedFilters(): SavedFilter[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    } catch {
        return []
    }
}

function storeSavedFilters(filters: SavedFilter[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
}

interface Props {
    selectedProject: JiraProject | null
    initialValues: AdvancedFilter
    onApply: (values: AdvancedFilter | undefined) => void
    onClose: () => void
}

export function FilterModal({ selectedProject, initialValues, onApply, onClose }: Props) {
    const [summary, setSummary] = useState(initialValues.summary)
    const [assignee, setAssignee] = useState<JiraUser | null>(initialValues.assignee)
    const [reporter, setReporter] = useState<JiraUser | null>(initialValues.reporter)
    const [status, setStatus] = useState<JiraStatus | null>(initialValues.status)

    const [users, setUsers] = useState<JiraUser[]>([])
    const [statuses, setStatuses] = useState<JiraStatus[]>([])
    const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(loadSavedFilters)
    const [saveName, setSaveName] = useState("")

    useEffect(() => {
        if (selectedProject) {
            jiraApi
                .getAssignableUsers(selectedProject.key)
                .then(setUsers)
                .catch(() => {})
            jiraApi
                .getProjectStatuses(selectedProject.key)
                .then((groups) => {
                    const seen = new Set<string>()
                    const all: JiraStatus[] = []
                    groups.forEach((g) =>
                        g.statuses.forEach((s) => {
                            if (!seen.has(s.id)) {
                                seen.add(s.id)
                                all.push(s)
                            }
                        })
                    )
                    setStatuses(all)
                })
                .catch(() => {
                    jiraApi
                        .getAllStatuses()
                        .then(setStatuses)
                        .catch(() => {})
                })
        } else {
            jiraApi
                .getAllStatuses()
                .then(setStatuses)
                .catch(() => {})
        }
    }, [selectedProject])

    const handleLoadSaved = (id: string) => {
        const found = savedFilters.find((f) => f.id === id)
        if (!found) return
        onApply({ summary: found.summary, assignee: found.assignee, reporter: found.reporter, status: found.status })
        onClose()
    }

    const handleApply = () => {
        onApply({ summary, assignee, reporter, status })
        onClose()
    }

    const handleSave = () => {
        if (!saveName.trim()) return
        const name = saveName.trim()
        const existingIndex = savedFilters.findIndex((f) => f.name.toLowerCase() === name.toLowerCase())
        let updated: SavedFilter[]
        if (existingIndex >= 0) {
            updated = savedFilters.map((f, i) =>
                i === existingIndex
                    ? { ...f, summary, assignee, reporter, status }
                    : f
            )
        } else {
            const newFilter: SavedFilter = {
                id: Date.now().toString(),
                name,
                summary,
                assignee,
                reporter,
                status,
            }
            updated = [...savedFilters, newFilter]
        }
        setSavedFilters(updated)
        storeSavedFilters(updated)
        setSaveName("")
    }

    const handleDelete = (id: string) => {
        const updated = savedFilters.filter((f) => f.id !== id)
        setSavedFilters(updated)
        storeSavedFilters(updated)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[480px] max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <h2 className="font-semibold text-gray-100">Filtr tasků</h2>
                    </div>
                    <button onClick={onClose} className="btn-icon">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                    {/* Saved filters */}
                    {savedFilters.length > 0 && (
                        <div>
                            <label className="block text-xs text-gray-500 mb-1.5">Uložené filtry</label>
                            <div className="flex flex-wrap gap-1.5">
                                {savedFilters.map((f) => (
                                    <div
                                        key={f.id}
                                        className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-200"
                                    >
                                        <button
                                            onClick={() => handleLoadSaved(f.id)}
                                            className="hover:text-white transition-colors max-w-[160px] truncate"
                                        >
                                            {f.name}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(f.id)}
                                            className="w-4 h-4 flex items-center justify-center rounded-full text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                                            title="Smazat filtr"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Název tasku</label>
                        <input
                            type="text"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="input w-full text-sm"
                            placeholder="Hledat v názvu..."
                        />
                    </div>

                    {/* Assignee */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Přiřazeno</label>
                        <UserPicker
                            users={users}
                            value={assignee}
                            onChange={setAssignee}
                            placeholder="Jakýkoli uživatel"
                        />
                    </div>

                    {/* Reporter */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Reportér</label>
                        <UserPicker
                            users={users}
                            value={reporter}
                            onChange={setReporter}
                            placeholder="Jakýkoli uživatel"
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Status</label>
                        <select
                            className="input w-full text-sm"
                            value={status?.id ?? ""}
                            onChange={(e) => {
                                setStatus(statuses.find((s) => s.id === e.target.value) ?? null)
                            }}
                        >
                            <option value="">— Jakýkoli status —</option>
                            {statuses.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Save filter */}
                    <div className="flex gap-2 pt-1">
                        <input
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave()
                            }}
                            className="input flex-1 text-sm"
                            placeholder="Název pro uložení filtru..."
                        />
                        <button
                            onClick={handleSave}
                            disabled={!saveName.trim()}
                            className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5 disabled:opacity-40"
                            title="Uložit filtr"
                        >
                            <Bookmark className="w-4 h-4" />
                            Uložit
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="btn-secondary text-sm px-4 py-1.5">
                        Zrušit
                    </button>
                    <button
                        onClick={() => {
                            onApply(undefined)
                            onClose()
                        }}
                        className="btn-danger flex items-center gap-1.5 text-sm px-4 py-1.5"
                    >
                        <FilterX className="w-3.5 h-3.5" />
                        Odstranit filtr
                    </button>
                    <button onClick={handleApply} className="btn-primary flex items-center gap-1.5 text-sm px-4 py-1.5">
                        <Filter className="w-3.5 h-3.5" />
                        Aplikovat filtr
                    </button>
                </div>
            </div>
        </div>
    )
}
