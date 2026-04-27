import { X, Plus, Loader, CheckCircle } from "lucide-react"
import { ErrorMessage } from "../../shared/ErrorMessage"
import { UserPicker } from "../../UserPicker"
import { RichTextEditor } from "../../rich-text-editor"
import { PRIORITIES } from "../hooks/useCreateIssueModal.controller"
import type { CreateIssueModalProps } from "../hooks/useCreateIssueModal"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="form-label">{label}</label>
            {children}
        </div>
    )
}

function CreateIssueModalView({
    projects,
    project,
    setProject,
    onClose,
    defaultEpic,
    defaultParentKey,
    defaultIssueTypeName,
    dataProps,
    controllerProps,
}: CreateIssueModalProps) {
    const { filteredIssueTypes, users, sprints, epics, isLoading } = dataProps
    const {
        descriptionRef,
        summary,
        setSummary,
        issueType,
        setIssueType,
        priority,
        setPriority,
        assignee,
        setAssignee,
        sprint,
        setSprint,
        storyPoints,
        setStoryPoints,
        labels,
        labelInput,
        setLabelInput,
        epic,
        setEpic,
        submitting,
        error,
        success,
        handleSubmit,
        addLabel,
        removeLabel,
    } = controllerProps

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

                    {isLoading && (
                        <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                            <Loader className="w-4 h-4 animate-spin" />
                            Načítám možnosti projektu...
                        </div>
                    )}

                    {/* Typ + Priorita */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Typ úkolu *">
                            <select
                                value={issueType?.id ?? ""}
                                onChange={(e) =>
                                    setIssueType(filteredIssueTypes.find((t) => t.id === e.target.value) ?? null)
                                }
                                className="input w-full"
                            >
                                {filteredIssueTypes.map((t) => (
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
                                        onClick={() => removeLabel(l)}
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

export default CreateIssueModalView
