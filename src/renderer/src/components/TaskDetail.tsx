import { useState, useEffect, useRef, useCallback } from "react"
import { X, Send, RefreshCw, ChevronRight, Save } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import { adfToText, formatDate } from "../lib/adf-to-text"
import { UserPicker } from "./UserPicker"
import { AdfContent } from "./AdfContent"
import type { JiraIssue, JiraTransition, JiraUser } from "../types/jira"

interface Props {
    issue: JiraIssue
    onClose: () => void
    onUpdate: (updated: JiraIssue) => void
}

const statusCategoryClass: Record<string, string> = {
    new: "badge-gray",
    indeterminate: "badge-blue",
    done: "badge-green",
}

export function TaskDetail({ issue, onClose, onUpdate }: Props) {
    const [detail, setDetail] = useState<JiraIssue>(issue)
    const [loading, setLoading] = useState(false)
    const [transitions, setTransitions] = useState<JiraTransition[]>([])
    const [comment, setComment] = useState("")
    const [sendingComment, setSendingComment] = useState(false)
    const [transitioning, setTransitioning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [assignableUsers, setAssignableUsers] = useState<JiraUser[]>([])
    const [reassigning, setReassigning] = useState(false)
    const [editingDesc, setEditingDesc] = useState(false)
    const [descDraft, setDescDraft] = useState("")
    const [savingDesc, setSavingDesc] = useState(false)
    const [navStack, setNavStack] = useState<JiraIssue[]>([])
    const [panelWidth, setPanelWidth] = useState(480)
    const dragStartX = useRef<number | null>(null)
    const dragStartWidth = useRef<number>(480)

    const onResizeMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            dragStartX.current = e.clientX
            dragStartWidth.current = panelWidth

            const onMouseMove = (ev: MouseEvent) => {
                if (dragStartX.current === null) return
                const delta = dragStartX.current - ev.clientX
                setPanelWidth(Math.max(480, dragStartWidth.current + delta))
            }
            const onMouseUp = () => {
                dragStartX.current = null
                window.removeEventListener("mousemove", onMouseMove)
                window.removeEventListener("mouseup", onMouseUp)
            }
            window.addEventListener("mousemove", onMouseMove)
            window.addEventListener("mouseup", onMouseUp)
        },
        [panelWidth]
    )

    const loadDetail = async (key = detail.key) => {
        setLoading(true)
        try {
            const [issueData, transData] = await Promise.all([jiraApi.getIssue(key), jiraApi.getTransitions(key)])
            setDetail(issueData)
            setTransitions(transData.transitions)
            // onUpdate jen pro kořenový issue — jinak by změna selectedIssue v App.tsx
            // resetovala navStack přes useEffect
            if (key === issue.key) onUpdate(issueData)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setNavStack([])
        loadDetail(issue.key)
        jiraApi
            .getAssignableUsers(issue.key.split("-")[0])
            .then(setAssignableUsers)
            .catch(() => {})
    }, [issue.key])

    const handleReassign = async (user: JiraUser | null) => {
        setReassigning(true)
        try {
            await jiraApi.assignIssue(detail.key, user?.accountId ?? null)
            setDetail((prev) => ({ ...prev, fields: { ...prev.fields, assignee: user } }))
            onUpdate({ ...detail, fields: { ...detail.fields, assignee: user } })
        } catch (e: any) {
            setError(e.message)
        } finally {
            setReassigning(false)
        }
    }

    const handleTransition = async (transition: JiraTransition) => {
        setTransitioning(true)
        setError(null)
        try {
            await jiraApi.doTransition(detail.key, transition.id)
            await loadDetail()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setTransitioning(false)
        }
    }

    const handleNavigateTo = async (key: string) => {
        setError(null)
        try {
            const [targetIssue, transData] = await Promise.all([jiraApi.getIssue(key), jiraApi.getTransitions(key)])
            setNavStack((prev) => [...prev, detail])
            setDetail(targetIssue)
            setTransitions(transData.transitions)
        } catch (e: any) {
            setError(e.message)
        }
    }

    const handleBreadcrumbNav = async (index: number) => {
        const target = navStack[index]
        setNavStack((prev) => prev.slice(0, index))
        setError(null)
        try {
            const transData = await jiraApi.getTransitions(target.key)
            setDetail(target)
            setTransitions(transData.transitions)
        } catch {
            setDetail(target)
        }
    }

    const handleDescEdit = () => {
        setDescDraft(adfToText(detail.fields.description as any))
        setEditingDesc(true)
    }

    const handleSaveDesc = async () => {
        setSavingDesc(true)
        setError(null)
        try {
            const adf = {
                type: "doc",
                version: 1,
                content: descDraft.split("\n").map((line) => ({
                    type: "paragraph",
                    content: line ? [{ type: "text", text: line }] : [],
                })),
            }
            await jiraApi.updateIssue(detail.key, { description: adf })
            setDetail((prev) => ({ ...prev, fields: { ...prev.fields, description: adf as any } }))
            onUpdate({ ...detail, fields: { ...detail.fields, description: adf as any } })
            setEditingDesc(false)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSavingDesc(false)
        }
    }

    const handleComment = async () => {
        if (!comment.trim()) return
        setSendingComment(true)
        setError(null)
        try {
            await jiraApi.addComment(detail.key, comment.trim())
            setComment("")
            await loadDetail()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSendingComment(false)
        }
    }

    const storyPoints = detail.fields.customfield_10016

    return (
        <div
            className="detail-panel border-l border-gray-800 flex flex-col overflow-hidden shrink-0 relative"
            style={{ width: panelWidth }}
        >
            {/* Resize handle */}
            <div
                className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
                onMouseDown={onResizeMouseDown}
            />
            {/* Header */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-gray-800 gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {navStack.length > 0 && (
                            <>
                                {navStack.map((item, i) => (
                                    <span key={item.key} className="flex items-center gap-0.5">
                                        <button
                                            className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline"
                                            onClick={() => handleBreadcrumbNav(i)}
                                        >
                                            {item.key}
                                        </button>
                                        <ChevronRight className="w-3 h-3 text-gray-600" />
                                    </span>
                                ))}
                            </>
                        )}
                        <div className="flex items-center gap-2">
                            <img src={detail.fields.issuetype.iconUrl} alt="" className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-mono text-gray-400">{detail.key}</span>
                            <span
                                className={`badge ${statusCategoryClass[detail.fields.status.statusCategory.key] ?? "badge-gray"}`}
                            >
                                {detail.fields.status.name}
                            </span>
                        </div>
                    </div>
                    <h2 className="text-sm font-semibold text-gray-100 leading-snug">{detail.fields.summary}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => loadDetail()} className="btn-icon" disabled={loading}>
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={onClose} className="btn-icon">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Transitions */}
                {transitions.length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-800">
                        <p className="text-xs text-gray-500 mb-2">Přesunout do stavu</p>
                        <div className="flex flex-wrap gap-1.5">
                            {transitions.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => handleTransition(t)}
                                    disabled={transitioning}
                                    className="btn-sm"
                                >
                                    {transitioning ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3" />
                                    )}
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Meta */}
                <div className="px-4 py-3 border-b border-gray-800 grid grid-cols-2 gap-3">
                    <MetaItem label="Přiřazeno">
                        <UserPicker
                            users={assignableUsers}
                            value={detail.fields.assignee}
                            onChange={handleReassign}
                            placeholder="Přiřadit..."
                        />
                        {reassigning && <p className="text-xs text-gray-500 mt-1">Ukládám...</p>}
                    </MetaItem>

                    <MetaItem label="Reporter">
                        <div className="flex items-center gap-1.5">
                            <img
                                src={detail.fields.reporter.avatarUrls["48x48"]}
                                alt=""
                                className="w-5 h-5 rounded-full"
                            />
                            <span className="text-xs text-gray-300">{detail.fields.reporter.displayName}</span>
                        </div>
                    </MetaItem>

                    <MetaItem label="Priorita">
                        <div className="flex items-center gap-1.5">
                            <img src={detail.fields.priority.iconUrl} alt="" className="w-4 h-4" />
                            <span className="text-xs text-gray-300">{detail.fields.priority.name}</span>
                        </div>
                    </MetaItem>

                    {storyPoints != null && (
                        <MetaItem label="Story Points">
                            <span className="text-xs text-gray-300 font-semibold">{storyPoints}</span>
                        </MetaItem>
                    )}

                    <MetaItem label="Vytvořeno">
                        <span className="text-xs text-gray-400">{formatDate(detail.fields.created)}</span>
                    </MetaItem>

                    <MetaItem label="Aktualizováno">
                        <span className="text-xs text-gray-400">{formatDate(detail.fields.updated)}</span>
                    </MetaItem>

                    {detail.fields.duedate && (
                        <MetaItem label="Termín">
                            <span className="text-xs text-gray-300">{detail.fields.duedate}</span>
                        </MetaItem>
                    )}

                    {detail.fields.parent && (
                        <MetaItem label="Rodičovský task">
                            <span className="text-xs text-gray-400 font-mono">{detail.fields.parent.key}</span>
                        </MetaItem>
                    )}
                </div>

                {/* Labels */}
                {detail.fields.labels?.length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-800">
                        <p className="text-xs text-gray-500 mb-2">Štítky</p>
                        <div className="flex flex-wrap gap-1.5">
                            {detail.fields.labels.map((l) => (
                                <span key={l} className="badge badge-gray">
                                    {l}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Description */}
                <div className="px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500">Popis</p>
                        {!editingDesc && <span className="text-xs text-gray-600">dvojklik pro úpravu</span>}
                    </div>
                    {editingDesc ? (
                        <>
                            <textarea
                                value={descDraft}
                                onChange={(e) => setDescDraft(e.target.value)}
                                rows={8}
                                className="input w-full resize-y text-sm font-mono mb-2"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveDesc}
                                    disabled={savingDesc}
                                    className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                                >
                                    {savingDesc ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3.5 h-3.5" />
                                    )}
                                    Uložit
                                </button>
                                <button onClick={() => setEditingDesc(false)} disabled={savingDesc} className="btn-sm">
                                    Zrušit
                                </button>
                            </div>
                        </>
                    ) : (
                        <div
                            className="text-sm text-gray-300 leading-relaxed cursor-text min-h-[2rem]"
                            onDoubleClick={handleDescEdit}
                        >
                            {detail.fields.description ? (
                                <AdfContent
                                    node={detail.fields.description as any}
                                    attachments={detail.fields.attachment}
                                />
                            ) : (
                                <span className="text-gray-600 italic">Žádný popis — dvojklikem přidejte</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Subtasks */}
                {detail.fields.subtasks?.length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-800">
                        <p className="text-xs text-gray-500 mb-2">Podúkoly ({detail.fields.subtasks.length})</p>
                        <div className="flex flex-col gap-1">
                            {detail.fields.subtasks.map((s) => (
                                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-gray-800/50">
                                    <img src={s.fields.issuetype.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
                                    <button
                                        className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline shrink-0"
                                        onClick={() => handleNavigateTo(s.key)}
                                    >
                                        {s.key}
                                    </button>
                                    <span className="text-xs text-gray-300 truncate flex-1">{s.fields.summary}</span>
                                    {s.fields.assignee && (
                                        <img
                                            src={s.fields.assignee.avatarUrls["48x48"]}
                                            alt={s.fields.assignee.displayName}
                                            title={s.fields.assignee.displayName}
                                            className="w-4 h-4 rounded-full shrink-0"
                                        />
                                    )}
                                    <span
                                        className={`shrink-0 badge text-xs ${statusCategoryClass[s.fields.status.statusCategory.key] ?? "badge-gray"}`}
                                    >
                                        {s.fields.status.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Comments */}
                <div className="px-4 py-3">
                    <p className="text-xs text-gray-500 mb-3">Komentáře ({detail.fields.comment?.total ?? 0})</p>
                    <div className="flex flex-col gap-3 mb-4">
                        {detail.fields.comment?.comments.slice(-10).map((c) => (
                            <div key={c.id} className="flex gap-2">
                                <img
                                    src={c.author.avatarUrls["48x48"]}
                                    alt=""
                                    className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-xs font-semibold text-gray-300">
                                            {c.author.displayName}
                                        </span>
                                        <span className="text-xs text-gray-600">{formatDate(c.created)}</span>
                                    </div>
                                    <AdfContent
                                        node={c.body as any}
                                        className="text-xs text-gray-400 leading-relaxed"
                                        attachments={detail.fields.attachment}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add comment */}
                    {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
                    <div className="flex gap-2">
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Přidat komentář..."
                            rows={2}
                            className="input flex-1 resize-none text-sm"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) handleComment()
                            }}
                        />
                        <button
                            onClick={handleComment}
                            disabled={sendingComment || !comment.trim()}
                            className="btn-primary self-end px-3 py-2"
                            title="Odeslat (Ctrl+Enter)"
                        >
                            {sendingComment ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Ctrl+Enter pro odeslání</p>
                </div>
            </div>
        </div>
    )
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-gray-600 mb-0.5">{label}</p>
            {children}
        </div>
    )
}
