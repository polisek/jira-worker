import { X, RefreshCw, ChevronRight, Network, Save } from 'lucide-react'
import { StatusBadge } from '../../IssueBadges'
import { LogWorkDialog } from '../../LogWorkDialog'
import { StatusManagerDialog } from '../../StatusManagerDialog'
import { TransitionsSection } from '../components/TransitionsSection'
import { IssueInfoSection } from '../components/IssueInfoSection'
import { TimeSection } from '../components/TimeSection'
import { DescriptionSection } from '../components/DescriptionSection'
import { CommentsSection } from '../components/CommentsSection'
import type { TaskDetailProps } from '../hooks/useTaskDetail'

function TaskDetailView({
    issueKey,
    prefs,
    onClose,
    onOpenGraph,
    dataProps,
    controllerProps,
    titleEditProps,
    dialogProps,
}: TaskDetailProps) {
    const { issue, transitions, assignableUsers, parentChain, isLoading, errorMessage, refetch } = dataProps
    const {
        navHistory,
        panelWidth,
        onResizeMouseDown,
        handleNavigateTo,
        handleBreadcrumbNav,
        handleBreadcrumbRoot,
    } = controllerProps
    const { editing: editingTitle, draft: titleDraft, saving: titleSaving, onDoubleClick: onTitleDoubleClick, onChange: onTitleChange, onSave: onTitleSave, onCancel: onTitleCancel } = titleEditProps
    const { logWorkOpen, setLogWorkOpen, statusManagerOpen, setStatusManagerOpen } = dialogProps

    const epicKey = issue
        ? issue.fields.issuetype.name === 'Epic'
            ? issue.key
            : (parentChain[0] ?? null)
        : null

    // ── Loading / error ──────────────────────────────────────────────
    if (!issue) {
        return (
            <div
                className="detail-panel border-l border-gray-800 flex flex-col overflow-hidden shrink-0 relative items-center justify-center"
                style={{ width: panelWidth }}
            >
                <div
                    className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
                    onMouseDown={onResizeMouseDown}
                />
                {errorMessage ? (
                    <p className="text-red-400 text-sm px-4 text-center">{errorMessage}</p>
                ) : (
                    <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
                )}
            </div>
        )
    }

    // ── Full panel ───────────────────────────────────────────────────
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

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-gray-800 gap-2 shrink-0">
                <div className="min-w-0 flex-1">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-0.5 mb-1.5 flex-wrap">
                        {/* Parent chain (ancestors of root issue) */}
                        {parentChain
                            .filter((k) => !navHistory.includes(k) && k !== issue.key)
                            .map((k) => (
                                <span key={k} className="flex items-center gap-0.5">
                                    <button
                                        className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline"
                                        onClick={() => handleNavigateTo(k)}
                                    >
                                        {k}
                                    </button>
                                    <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                                </span>
                            ))}

                        {/* Root issue (if not current) */}
                        {navHistory.length > 0 && (
                            <span className="flex items-center gap-0.5">
                                <button
                                    className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline"
                                    onClick={handleBreadcrumbRoot}
                                >
                                    {issueKey}
                                </button>
                                <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                            </span>
                        )}

                        {/* Nav history intermediate items */}
                        {navHistory.slice(0, -1).map((k, i) => (
                            <span key={k} className="flex items-center gap-0.5">
                                <button
                                    className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline"
                                    onClick={() => handleBreadcrumbNav(i)}
                                >
                                    {k}
                                </button>
                                <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                            </span>
                        ))}

                        {/* Current issue indicator */}
                        <div className="flex items-center gap-1.5">
                            <img src={issue.fields.issuetype.iconUrl} alt="" className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-mono text-gray-400">{issue.key}</span>
                            <StatusBadge status={issue.fields.status} />
                        </div>
                    </div>

                    {/* Title — double-click to edit */}
                    {editingTitle ? (
                        <div>
                            <input
                                value={titleDraft}
                                onChange={(e) => onTitleChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onTitleSave()
                                    if (e.key === 'Escape') onTitleCancel()
                                }}
                                className="input text-sm w-full py-1.5"
                                autoFocus
                            />
                            <div className="flex gap-2 mt-1.5">
                                <button
                                    onClick={onTitleSave}
                                    disabled={titleSaving}
                                    className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1"
                                >
                                    {titleSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                    Uložit
                                </button>
                                <button onClick={onTitleCancel} disabled={titleSaving} className="btn-sm">
                                    Zrušit
                                </button>
                            </div>
                        </div>
                    ) : (
                        <h2
                            className="text-sm font-semibold text-gray-100 leading-snug cursor-text select-text"
                            onDoubleClick={onTitleDoubleClick}
                            title="Dvojklik pro úpravu názvu"
                        >
                            {issue.fields.summary}
                        </h2>
                    )}
                </div>

                {/* Action buttons */}
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
                    <button
                        onClick={refetch}
                        disabled={isLoading}
                        className="btn-icon"
                        title="Obnovit"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={onClose} className="btn-icon">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Scrollable sections ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto pt-3 pb-6">
                {/* 1. Přesunout do stavu */}
                <TransitionsSection
                    issue={issue}
                    transitions={transitions}
                    onManageStatuses={() => setStatusManagerOpen(true)}
                />

                {/* 2. Detail úkolu (no header) */}
                <IssueInfoSection
                    issue={issue}
                    assignableUsers={assignableUsers}
                    onNavigateTo={handleNavigateTo}
                />

                {/* 3. Čas */}
                <TimeSection
                    issue={issue}
                    onLogWork={() => setLogWorkOpen(true)}
                    onRefetch={refetch}
                />

                {/* 4. Popis */}
                <DescriptionSection issue={issue} />

                {/* 5. Komentáře */}
                <CommentsSection issue={issue} />
            </div>

            {/* ── Dialogs ─────────────────────────────────────────── */}
            {logWorkOpen && (
                <LogWorkDialog
                    issue={issue}
                    dailyWorkHours={prefs.dailyWorkHours}
                    onClose={() => setLogWorkOpen(false)}
                    onLogged={refetch}
                />
            )}
            {statusManagerOpen && (
                <StatusManagerDialog
                    project={issue.fields.project}
                    onClose={() => setStatusManagerOpen(false)}
                />
            )}
        </div>
    )
}

export default TaskDetailView
