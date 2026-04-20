import { useState, useEffect } from "react"
import { X, Plus, Pencil, Trash2, RefreshCw, Check, AlertCircle } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import type { JiraProject, JiraStatus } from "../types/jira"

type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE"

const CATEGORY_OPTIONS: { value: StatusCategory; label: string; dotClass: string; jiraKey: string }[] = [
    { value: "TODO",        label: "To Do",       dotClass: "bg-gray-400",  jiraKey: "new" },
    { value: "IN_PROGRESS", label: "In Progress", dotClass: "bg-blue-400",  jiraKey: "indeterminate" },
    { value: "DONE",        label: "Done",        dotClass: "bg-green-400", jiraKey: "done" },
]

function categoryForKey(jiraKey: string): StatusCategory {
    if (jiraKey === "indeterminate") return "IN_PROGRESS"
    if (jiraKey === "done") return "DONE"
    return "TODO"
}

function dotClass(jiraKey: string): string {
    return CATEGORY_OPTIONS.find(o => o.value === categoryForKey(jiraKey))?.dotClass ?? "bg-gray-400"
}

function categoryLabel(jiraKey: string): string {
    return CATEGORY_OPTIONS.find(o => o.value === categoryForKey(jiraKey))?.label ?? "To Do"
}

interface Props {
    project: JiraProject
    onClose: () => void
}

export function StatusManagerDialog({ project, onClose }: Props) {
    const projectId = project.id
    const [statuses, setStatuses] = useState<JiraStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editStatusCategory, setEditStatusCategory] = useState<StatusCategory>("TODO")
    const [saving, setSaving] = useState(false)

    const [adding, setAdding] = useState(false)
    const [newName, setNewName] = useState("")
    const [newCategory, setNewCategory] = useState<StatusCategory>("TODO")

    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        loadStatuses()
    }, [])

    async function loadStatuses() {
        setLoading(true)
        setError(null)
        try {
            const result = await jiraApi.getStatusesForProject(projectId)
            setStatuses(result)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    function startEdit(status: JiraStatus) {
        setEditingId(status.id)
        setEditName(status.name)
        setEditStatusCategory(categoryForKey(status.statusCategory.key))
        setAdding(false)
        setError(null)
    }

    async function saveEdit() {
        if (!editingId || !editName.trim()) return
        setSaving(true)
        setError(null)
        try {
            await jiraApi.updateStatuses([{ id: editingId, name: editName.trim(), statusCategory: editStatusCategory }])
            setStatuses(prev => prev.map(s => s.id === editingId
                ? { ...s, name: editName.trim() }
                : s
            ))
            setEditingId(null)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        setDeletingId(id)
        setError(null)
        try {
            await jiraApi.deleteStatus(id)
            setStatuses(prev => prev.filter(s => s.id !== id))
        } catch (e: any) {
            setError(e.message)
        } finally {
            setDeletingId(null)
        }
    }

    async function handleAdd() {
        if (!newName.trim()) return
        setSaving(true)
        setError(null)
        try {
            const created = await jiraApi.createStatuses(
                [{ name: newName.trim(), statusCategory: newCategory }],
                projectId
            )
            setStatuses(prev => [...prev, ...(created as JiraStatus[])])
            setNewName("")
            setNewCategory("TODO")
            setAdding(false)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="modal-panel rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-100">Správa stavů</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{project.name}</p>
                    </div>
                    <button className="btn-icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="spinner" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {statuses.map(status => (
                                <div
                                    key={status.id}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
                                    style={{ background: "var(--c-bg-card)" }}
                                >
                                    {editingId === status.id ? (
                                        <>
                                            <span
                                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass(status.statusCategory.key)}`}
                                                title={`Kategorie: ${categoryLabel(status.statusCategory.key)} — nelze změnit`}
                                            />
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="input flex-1 py-1 text-sm"
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === "Enter") saveEdit()
                                                    if (e.key === "Escape") setEditingId(null)
                                                }}
                                            />
                                            <button
                                                className="btn-icon"
                                                onClick={saveEdit}
                                                disabled={saving || !editName.trim()}
                                                title="Uložit (Enter)"
                                            >
                                                {saving
                                                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    : <Check className="w-3.5 h-3.5 text-green-400" />}
                                            </button>
                                            <button className="btn-icon" onClick={() => setEditingId(null)} title="Zrušit">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass(status.statusCategory.key)}`} />
                                            <span className="text-sm text-gray-200 flex-1">{status.name}</span>
                                            <span className="text-xs text-gray-500 shrink-0">{categoryLabel(status.statusCategory.key)}</span>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => startEdit(status)}
                                                    title="Upravit název"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleDelete(status.id)}
                                                    disabled={deletingId === status.id}
                                                    title="Smazat stav"
                                                >
                                                    {deletingId === status.id
                                                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}

                            {adding ? (
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mt-1 border border-dashed border-gray-700">
                                    <div className="flex items-center gap-1.5 shrink-0" title="Vyberte kategorii">
                                        {CATEGORY_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setNewCategory(opt.value)}
                                                title={opt.label}
                                                className={`w-3 h-3 rounded-full transition-all ${opt.dotClass} ${
                                                    newCategory === opt.value
                                                        ? "scale-125 ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
                                                        : "opacity-40 hover:opacity-80"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <input
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Název nového stavu..."
                                        className="input flex-1 py-1 text-sm"
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === "Enter") handleAdd()
                                            if (e.key === "Escape") setAdding(false)
                                        }}
                                    />
                                    <button
                                        className="btn-icon"
                                        onClick={handleAdd}
                                        disabled={saving || !newName.trim()}
                                        title="Přidat (Enter)"
                                    >
                                        {saving
                                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            : <Check className="w-3.5 h-3.5 text-green-400" />}
                                    </button>
                                    <button className="btn-icon" onClick={() => setAdding(false)} title="Zrušit">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 px-3 py-2 mt-1 rounded-lg transition-colors"
                                    style={{ background: "transparent" }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "var(--c-item-h)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    onClick={() => { setAdding(true); setEditingId(null); setError(null) }}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Přidat stav
                                </button>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 mt-3 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
