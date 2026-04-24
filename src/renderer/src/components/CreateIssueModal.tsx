import { useState, useEffect, useRef } from "react"
import { X, Plus, Loader, AlertCircle, CheckCircle } from "lucide-react"
import { ErrorMessage } from "./ErrorMessage"
import { jiraApi } from "../utils/jira-api"
import { UserPicker } from "./UserPicker"
import { RichTextEditor, type RichTextEditorRef } from "./rich-text-editor"
import type { JiraProject, JiraUser, JiraIssueType, JiraSprint, JiraIssue } from "../types/jira"

interface Props {
    projects: JiraProject[]
    defaultProject: JiraProject | null
    onClose: () => void
    onCreated: (issue: JiraIssue) => void
    /** Pre-fills and locks the epic link (used from TreeView when adding under an Epic) */
    defaultEpic?: JiraIssue | null
    /** Pre-fills parent key, forces Subtask type (used from TreeView when adding under a Task) */
    defaultParentKey?: string
    /** Intended issue type name shown in header and pre-selected in form (e.g. "Epic", "Task", "Subtask") */
    defaultIssueTypeName?: string
}

const PRIORITIES = [
    { name: "Highest", color: "text-red-400" },
    { name: "High", color: "text-orange-400" },
    { name: "Medium", color: "text-yellow-400" },
    { name: "Low", color: "text-blue-400" },
    { name: "Lowest", color: "text-gray-400" },
]

export function CreateIssueModal({
    projects,
    defaultProject,
    onClose,
    onCreated,
    defaultEpic,
    defaultParentKey,
    defaultIssueTypeName,
}: Props) {
    const [project, setProject] = useState<JiraProject | null>(defaultProject ?? projects[0] ?? null)

    // Form fields
    const [summary, setSummary] = useState("")
    const descriptionRef = useRef<RichTextEditorRef>(null)
    const [issueType, setIssueType] = useState<JiraIssueType | null>(null)
    const [priority, setPriority] = useState("Medium")
    const [assignee, setAssignee] = useState<JiraUser | null>(null)
    const [sprint, setSprint] = useState<JiraSprint | null>(null)
    const [storyPoints, setStoryPoints] = useState<string>("")
    const [labels, setLabels] = useState<string[]>([])
    const [labelInput, setLabelInput] = useState("")
    const [epic, setEpic] = useState<JiraIssue | null>(defaultEpic ?? null)

    // Async data
    const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([])
    const [users, setUsers] = useState<JiraUser[]>([])
    const [sprints, setSprints] = useState<JiraSprint[]>([])
    const [epics, setEpics] = useState<JiraIssue[]>([])
    const [dataLoading, setDataLoading] = useState(false)

    // Submit state
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Načti data projektu
    useEffect(() => {
        if (!project) return
        setDataLoading(true)
        setIssueType(null)
        setSprint(null)
        setAssignee(null)
        setEpic(defaultEpic ?? null)

        Promise.allSettled([
            jiraApi.getIssueTypes(project.key),
            jiraApi.getAssignableUsers(project.key),
            jiraApi.getBoards(project.key).then(async (res) => {
                const boardId = res.values?.[0]?.id
                if (!boardId) return []
                const sprintsRes = await jiraApi.getBoardSprints(boardId)
                return sprintsRes.values ?? []
            }),
            jiraApi.getEpics(project.key),
        ]).then(([typesRes, usersRes, sprintsRes, epicsRes]) => {
            if (typesRes.status === "fulfilled") {
                let types = typesRes.value
                if (defaultEpic) {
                    // Under an epic: only non-subtask, non-epic types (i.e. Task/Story/Bug)
                    // Prefer plain Task if present
                    const taskOnly = types.filter((t) => !t.subtask && t.name.toLowerCase() === "task")
                    if (taskOnly.length > 0) {
                        types = taskOnly
                    } else {
                        types = types.filter((t) => !t.subtask && t.name.toLowerCase() !== "epic")
                    }
                }
                if (defaultParentKey) {
                    // Under a task: only subtask types (Jira subtask boolean = true)
                    const subtaskTypes = types.filter((t) => t.subtask === true)
                    if (subtaskTypes.length > 0) types = subtaskTypes
                }
                setIssueTypes(types)
                // Výchozí typ
                if (defaultParentKey) {
                    setIssueType(types[0] ?? null)
                } else if (defaultIssueTypeName) {
                    setIssueType(
                        types.find((t) => t.name.toLowerCase() === defaultIssueTypeName.toLowerCase()) ??
                            types.find((t) => t.name === "Story") ??
                            types.find((t) => t.name === "Task") ??
                            types[0] ??
                            null
                    )
                } else {
                    setIssueType(
                        types.find((t) => t.name === "Story") ??
                            types.find((t) => t.name === "Task") ??
                            types[0] ??
                            null
                    )
                }
            }
            if (usersRes.status === "fulfilled") setUsers(usersRes.value)
            if (sprintsRes.status === "fulfilled") {
                const sp = sprintsRes.value as JiraSprint[]
                setSprints(sp)
                // Dílčí úkoly nemají sprint — nastavit null a nezobrazovat
                if (!defaultParentKey) {
                    setSprint(sp.find((s) => s.state === "active") ?? null)
                } else {
                    setSprint(null)
                }
            }
            if (epicsRes.status === "fulfilled") setEpics((epicsRes.value as any).issues ?? [])
            setDataLoading(false)
        })
    }, [defaultEpic, defaultIssueTypeName, defaultParentKey, project, project?.key])

    const handleSubmit = async () => {
        if (!project || !summary.trim() || !issueType) return
        setSubmitting(true)
        setError(null)

        const fields: Record<string, unknown> = {
            project: { key: project.key },
            summary: summary.trim(),
            issuetype: { id: issueType.id },
            priority: { name: priority },
        }

        const descAdf = descriptionRef.current?.getAdf()
        if (descAdf && !descriptionRef.current?.isEmpty()) {
            fields.description = descAdf
        }
        if (assignee) fields.assignee = { accountId: assignee.accountId }
        if (sprint) fields.customfield_10020 = sprint.id
        if (storyPoints !== "") fields.customfield_10016 = Number(storyPoints)
        if (labels.length > 0) fields.labels = labels
        if (defaultParentKey) fields.parent = { key: defaultParentKey } // subtask parent

        // Epic link: next-gen projects use `parent`, classic use `customfield_10014`
        // Try `parent` first; on 400 fall back to classic field.
        const epicKey = epic?.key ?? null

        try {
            if (epicKey) fields.parent = { key: epicKey }
            const created = await jiraApi.createIssue(fields)
            const full = await jiraApi.getIssue(created.key)
            setSuccess(true)
            setTimeout(() => {
                onCreated(full)
                onClose()
            }, 800)
        } catch (e: any) {
            // If linking via parent failed, retry with classic epic-link field
            if (epicKey && String(e.message).includes("400")) {
                try {
                    delete fields.parent
                    fields.customfield_10014 = epicKey
                    const created = await jiraApi.createIssue(fields)
                    const full = await jiraApi.getIssue(created.key)
                    setSuccess(true)
                    setTimeout(() => {
                        onCreated(full)
                        onClose()
                    }, 800)
                    return
                } catch (e2: any) {
                    setError(e2.message)
                }
            } else {
                setError(e.message)
            }
        } finally {
            setSubmitting(false)
        }
    }

    const addLabel = () => {
        const l = labelInput.trim()
        if (l && !labels.includes(l)) setLabels((prev) => [...prev, l])
        setLabelInput("")
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative modal-panel rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-blue-400" />
                            <h2 className="font-semibold text-gray-100">
                                Nový{" "}
                                {defaultIssueTypeName ?? (defaultParentKey ? "Subtask" : defaultEpic ? "Task" : "Task")}
                            </h2>
                        </div>
                        {(defaultEpic || defaultParentKey) && (
                            <p className="text-xs pl-6" style={{ color: "var(--c-text-4)" }}>
                                pod&nbsp;
                                <span className="font-mono" style={{ color: "var(--c-text-3)" }}>
                                    {defaultEpic?.key ?? defaultParentKey}
                                </span>
                                {defaultEpic && (
                                    <span style={{ color: "var(--c-text-3)" }}> — {defaultEpic.fields.summary}</span>
                                )}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="btn-icon">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                    {/* Projekt */}
                    <Field label="Projekt *">
                        <select
                            value={project?.id ?? ""}
                            onChange={(e) => setProject(projects.find((p) => p.id === e.target.value) ?? null)}
                            className="input w-full"
                        >
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {dataLoading && (
                        <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                            <Loader className="w-4 h-4 animate-spin" />
                            Načítám možnosti projektu...
                        </div>
                    )}

                    {/* Typ + Priorita — vedle sebe */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Typ úkolu *">
                            <select
                                value={issueType?.id ?? ""}
                                onChange={(e) => setIssueType(issueTypes.find((t) => t.id === e.target.value) ?? null)}
                                className="input w-full"
                            >
                                {issueTypes.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Priorita">
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="input w-full"
                            >
                                {PRIORITIES.map((p) => (
                                    <option key={p.name} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {/* Summary */}
                    <Field label="Název *">
                        <input
                            type="text"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="Stručný popis úkolu..."
                            className="input w-full"
                            autoFocus
                        />
                    </Field>

                    {/* Description */}
                    <Field label="Popis">
                        <RichTextEditor
                            ref={descriptionRef}
                            placeholder="Podrobnější popis, kroky k reprodukci, poznámky..."
                            minHeight={120}
                        />
                    </Field>

                    {/* Přiřazení + Sprint */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Přiřadit">
                            <UserPicker
                                users={users}
                                value={assignee}
                                onChange={setAssignee}
                                placeholder="Hledat osobu..."
                            />
                        </Field>

                        <Field label="Sprint">
                            <select
                                value={sprint?.id ?? ""}
                                onChange={(e) =>
                                    setSprint(sprints.find((s) => String(s.id) === e.target.value) ?? null)
                                }
                                className="input w-full"
                                disabled={!!defaultParentKey}
                            >
                                <option value="">
                                    {defaultParentKey ? "— Dílčí úkoly nemají sprint —" : "— Bez sprintu —"}
                                </option>
                                {!defaultParentKey &&
                                    sprints.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                            {s.state === "active" ? " ✓" : ""}
                                        </option>
                                    ))}
                            </select>
                        </Field>
                    </div>

                    {/* Story points + Epic */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Story points">
                            <input
                                type="number"
                                min={0}
                                max={999}
                                value={storyPoints}
                                onChange={(e) => setStoryPoints(e.target.value)}
                                placeholder="0"
                                className="input w-full"
                            />
                        </Field>

                        <Field label="Epic">
                            {defaultEpic ? (
                                <div className="input w-full text-sm opacity-70 cursor-not-allowed truncate">
                                    {defaultEpic.key}: {defaultEpic.fields.summary}
                                </div>
                            ) : (
                                <select
                                    value={epic?.key ?? ""}
                                    onChange={(e) => setEpic(epics.find((ep) => ep.key === e.target.value) ?? null)}
                                    className="input w-full"
                                >
                                    <option value="">— Bez epicu —</option>
                                    {epics.map((ep) => (
                                        <option key={ep.key} value={ep.key}>
                                            {ep.key}: {ep.fields.summary}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </Field>
                    </div>

                    {/* Labels */}
                    <Field label="Štítky">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {labels.map((l) => (
                                <span key={l} className="badge badge-gray flex items-center gap-1">
                                    {l}
                                    <button
                                        onClick={() => setLabels((prev) => prev.filter((x) => x !== l))}
                                        className="text-gray-500 hover:text-gray-300"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={labelInput}
                                onChange={(e) => setLabelInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        addLabel()
                                    }
                                }}
                                placeholder="Přidat štítek + Enter"
                                className="input flex-1 text-sm"
                            />
                            <button onClick={addLabel} className="btn-secondary px-3 text-sm">
                                Přidat
                            </button>
                        </div>
                    </Field>

                    {/* Error / Success */}
                    {error && (
                        <ErrorMessage
                            message={error}
                            className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                        />
                    )}

                    {success && (
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <p className="text-green-300 text-sm">Task vytvořen!</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
                    <p className="text-xs text-gray-600">* povinné pole</p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="btn-secondary">
                            Zrušit
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!summary.trim() || !issueType || !project || submitting}
                            className="btn-primary flex items-center gap-2 min-w-28 justify-center"
                        >
                            {submitting ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" /> Vytvářím...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" /> Vytvořit task
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="form-label">{label}</label>
            {children}
        </div>
    )
}
