import { useState, useEffect, useRef, useCallback } from "react"
import { X, Send, RefreshCw, ChevronRight, Save, Settings2, Network } from "lucide-react"
import { jiraApi } from "../lib/jira-api"
import { formatDate } from "../lib/adf-to-text"
import { UserPicker } from "./UserPicker"
import { StatusBadge } from "./IssueBadges"
import { AdfContent } from "./AdfContent"
import { TimeTracking } from "./TimeTracking"
import { LogWorkDialog } from "./LogWorkDialog"
import { StatusManagerDialog } from "./StatusManagerDialog"
import { RichTextEditor, type RichTextEditorRef } from "./RichTextEditor"
import type { JiraIssue, JiraTransition, JiraUser, AppPrefs } from "../types/jira"

interface Props {
    issueKey: string
    prefs: AppPrefs
    onClose: () => void
    onOpenGraph?: (epicKey: string) => void
}


export function TaskDetail({ issueKey, prefs, onClose, onOpenGraph }: Props) {
    const [detail, setDetail] = useState<JiraIssue | null>(null)
    const [loading, setLoading] = useState(false)
    const [transitions, setTransitions] = useState<JiraTransition[]>([])
    const [sendingComment, setSendingComment] = useState(false)
    const [transitioning, setTransitioning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [assignableUsers, setAssignableUsers] = useState<JiraUser[]>([])
    const [reassigning, setReassigning] = useState(false)
    const [editingDesc, setEditingDesc] = useState(false)
    const [savingDesc, setSavingDesc] = useState(false)
    const descEditorRef = useRef<RichTextEditorRef>(null)
    const commentEditorRef = useRef<RichTextEditorRef>(null)
    const [navStack, setNavStack] = useState<JiraIssue[]>([])
    const [parentChain, setParentChain] = useState<string[]>([])
    const [panelWidth, setPanelWidth] = useState(480)
    const [logWorkOpen, setLogWorkOpen] = useState(false)
    const [statusManagerOpen, setStatusManagerOpen] = useState(false)
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

    const buildParentChain = async (issue: JiraIssue): Promise<string[]> => {
        if (issue.fields.issuetype.name === "Epic") return []

        // Classic Jira: customfield_10014 je přímý odkaz na epic
        if (issue.fields.customfield_10014) {
            const epicKey = issue.fields.customfield_10014
            if (!issue.fields.parent || issue.fields.parent.key === epicKey) return [epicKey]
            return [epicKey, issue.fields.parent.key]
        }

        if (!issue.fields.parent) return []

        const parentKey = issue.fields.parent.key

        // Parent je přímo Epic (next-gen nebo classic)
        if (issue.fields.parent.fields.issuetype?.name === "Epic") return [parentKey]

        // Parent je story/task — potřebujeme jeho rodiče (epic)
        try {
            const parentIssue = await jiraApi.getIssue(parentKey)
            if (parentIssue.fields.customfield_10014) return [parentIssue.fields.customfield_10014, parentKey]
            if (parentIssue.fields.parent) return [parentIssue.fields.parent.key, parentKey]
        } catch {
            // fallback: ukážeme aspoň přímého rodiče
        }
        return [parentKey]
    }

    const loadDetail = async (key?: string) => {
        const targetKey = key ?? detail?.key ?? issueKey
        setLoading(true)
        try {
            const [issueData, transData] = await Promise.all([jiraApi.getIssue(targetKey), jiraApi.getTransitions(targetKey)])
            setDetail(issueData)
            setTransitions(transData.transitions)
            // parentChain sestavujeme jen pro kořenový issue
            if (targetKey === issueKey) {
                buildParentChain(issueData).then(setParentChain)
            }
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setNavStack([])
        setParentChain([])
        setDetail(null)
        loadDetail(issueKey)
        jiraApi
            .getAssignableUsers(issueKey.split("-")[0])
            .then(setAssignableUsers)
            .catch(() => {})
    }, [issueKey])

    const handleReassign = async (user: JiraUser | null) => {
        if (!detail) return
        setReassigning(true)
        try {
            await jiraApi.assignIssue(detail.key, user?.accountId ?? null)
            setDetail((prev) => prev ? { ...prev, fields: { ...prev.fields, assignee: user } } : prev)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setReassigning(false)
        }
    }

    const handleTransition = async (transition: JiraTransition) => {
        if (!detail) return
        setTransitioning(true)
        setError(null)
        try {
            await jiraApi.doTransition(detail.key, transition.id)
            await loadDetail(detail.key)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setTransitioning(false)
        }
    }

    const handleNavigateTo = async (key: string) => {
        if (!detail) return
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
        setEditingDesc(true)
    }

    const handleSaveDesc = async () => {
        if (!detail || !descEditorRef.current) return
        setSavingDesc(true)
        setError(null)
        try {
            const adf = descEditorRef.current.getAdf()
            await jiraApi.updateIssue(detail.key, { description: adf })
            setDetail((prev) => prev ? { ...prev, fields: { ...prev.fields, description: adf as any } } : prev)
            setEditingDesc(false)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSavingDesc(false)
        }
    }

    const handleComment = async () => {
        if (!detail || !commentEditorRef.current) return
        if (commentEditorRef.current.isEmpty()) return
        setSendingComment(true)
        setError(null)
        try {
            const adf = commentEditorRef.current.getAdf()
            await jiraApi.addCommentAdf(detail.key, adf as Record<string, unknown>)
            commentEditorRef.current.clear()
            await loadDetail(detail.key)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSendingComment(false)
        }
    }

    const epicKey = detail
        ? detail.fields.issuetype.name === "Epic"
            ? detail.key
            : (parentChain[0] ?? null)
        : null

    const storyPoints = detail?.fields.customfield_10016

    if (!detail) {
        return (
            <div
                className="detail-panel border-l border-gray-800 flex flex-col overflow-hidden shrink-0 relative items-center justify-center"
                style={{ width: panelWidth }}
            >
                <div
                    className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
                    onMouseDown={onResizeMouseDown}
                />
                {error ? (
                    <p className="text-red-400 text-sm px-4">{error}</p>
                ) : (
                    <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
                )}
            </div>
        )
    }

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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {/* Hierarchie nadřazených issues (epic → story → …) */}
                        {parentChain
                            .filter((k) => !navStack.some((n) => n.key === k) && k !== detail.key)
                            .map((k) => (
                                <span key={k} className="flex items-center gap-0.5">
                                    <button
                                        className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline"
                                        onClick={() => handleNavigateTo(k)}
                                    >
                                        {k}
                                    </button>
                                    <ChevronRight className="w-3 h-3 text-gray-600" />
                                </span>
                            ))}
                        {/* Navigační historie uvnitř panelu */}
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
                        <div className="flex items-center gap-2">
                            <img src={detail.fields.issuetype.iconUrl} alt="" className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-mono text-gray-400">{detail.key}</span>
                            <StatusBadge status={detail.fields.status} />
                        </div>
                    </div>
                    <h2 className="text-sm font-semibold text-gray-100 leading-snug">{detail.fields.summary}</h2>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {epicKey && onOpenGraph && (
                        <button
                            onClick={() => onOpenGraph(epicKey)}
                            className="btn-icon"
                            title={`Otevřít graph pro epic ${epicKey}`}
                        >
                            <Network className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button onClick={() => loadDetail(detail.key)} className="btn-icon" disabled={loading}>
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
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-500">Přesunout do stavu</p>
                            <button
                                className="btn-icon"
                                onClick={() => setStatusManagerOpen(true)}
                                title="Spravovat stavy"
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
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

                {/* Čas */}
                <TimeTracking issue={detail} onLogWork={() => setLogWorkOpen(true)} onOriginalEdited={() => loadDetail(detail.key)} />

                {/* Description */}
                <div className="px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500">Popis</p>
                        {!editingDesc && <span className="text-xs text-gray-600">dvojklik pro úpravu</span>}
                    </div>
                    {editingDesc ? (
                        <>
                            <RichTextEditor
                                ref={descEditorRef}
                                initialContent={detail.fields.description as any}
                                minHeight={180}
                                autoFocus
                            />
                            <div className="flex gap-2 mt-2">
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
                                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded" style={{ background: 'var(--c-bg-card)' }}>
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
                                    <StatusBadge status={s.fields.status} className="shrink-0" />
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
                    <RichTextEditor
                        ref={commentEditorRef}
                        placeholder="Přidat komentář..."
                        minHeight={72}
                        onCtrlEnter={handleComment}
                    />
                    <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-600">Ctrl+Enter pro odeslání</p>
                        <button
                            onClick={handleComment}
                            disabled={sendingComment}
                            className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                            title="Odeslat (Ctrl+Enter)"
                        >
                            {sendingComment ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Send className="w-3.5 h-3.5" />
                            )}
                            Odeslat
                        </button>
                    </div>
                </div>
            </div>

            {logWorkOpen && (
                <LogWorkDialog
                    issue={detail}
                    dailyWorkHours={prefs.dailyWorkHours}
                    onClose={() => setLogWorkOpen(false)}
                    onLogged={() => loadDetail(detail.key)}
                />
            )}

            {statusManagerOpen && (
                <StatusManagerDialog
                    project={detail.fields.project}
                    onClose={() => setStatusManagerOpen(false)}
                />
            )}
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
