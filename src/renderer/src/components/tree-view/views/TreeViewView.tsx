import { Plus, Loader2, RefreshCw } from "lucide-react"
import { ErrorMessage } from "../../shared/ErrorMessage"
import CreateIssueModal from "../../create-issue-modal"
import { TreeNode } from "../components/TreeNode"
import { MoveToEpicDialog } from "../components/MoveToEpicDialog"
import type { TreeViewProps } from "../hooks/useTreeView"

function TreeViewView({ selectedProject, projects, onSelectIssue, dataProps, controllerProps }: TreeViewProps) {
    const { epics, epicsLoading, epicsError, nodeStates, loadEpics } = dataProps
    const {
        expanded,
        dragOverKey,
        createCtx,
        setCreateCtx,
        moveCtx,
        setMoveCtx,
        handleMoveConfirm,
        handleToggle,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        handleCreated,
    } = controllerProps

    const parentIssue = createCtx?.parentIssue ?? null
    const isParentEpic = parentIssue?.fields.issuetype.name.toLowerCase() === "epic"
    const createDefaultEpic = isParentEpic ? parentIssue : null
    const createDefaultParentKey = parentIssue && !isParentEpic ? parentIssue.key : undefined
    const createTypeName = createCtx?.createTypeName

    const nodeControllerProps = {
        handleToggle,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        setCreateCtx,
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--c-bg-board)" }}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ borderColor: "var(--c-border)" }}
            >
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-sm" style={{ color: "var(--c-text)" }}>
                        Strom
                    </h2>
                    {selectedProject && (
                        <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: "var(--c-bg-card)", color: "var(--c-text-4)" }}
                        >
                            {selectedProject.key}
                        </span>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-2 ml-2">
                        {[
                            { label: "Epic", dot: "bg-purple-500" },
                            { label: "Story", dot: "bg-blue-500" },
                            { label: "Task", dot: "bg-sky-500" },
                            { label: "Bug", dot: "bg-red-500" },
                            { label: "Subtask", dot: "bg-emerald-500" },
                        ].map(({ label, dot }) => (
                            <span
                                key={label}
                                className="flex items-center gap-1 text-xs"
                                style={{ color: "var(--c-text-4)" }}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button onClick={() => loadEpics()} className="btn-icon" title="Obnovit" disabled={epicsLoading}>
                        <RefreshCw className={`w-3.5 h-3.5 ${epicsLoading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setCreateCtx({ parentIssue: null, createTypeName: "Epic" })}
                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                        title="Přidat Epic"
                    >
                        <Plus className="w-3 h-3" /> Nový Epic
                    </button>
                </div>
            </div>

            {/* Tree body */}
            <div className="flex-1 overflow-y-auto p-2">
                {epicsLoading && (
                    <div className="flex items-center justify-center gap-2 py-16" style={{ color: "var(--c-text-4)" }}>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Načítám epicy…</span>
                    </div>
                )}

                {!epicsLoading && epicsError && (
                    <ErrorMessage
                        message={epicsError}
                        className="m-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                    />
                )}

                {!epicsLoading && !epicsError && epics.length === 0 && (
                    <div
                        className="flex flex-col items-center justify-center py-16 gap-2"
                        style={{ color: "var(--c-text-4)" }}
                    >
                        <p className="text-sm">Žádné epicy nenalezeny</p>
                        <p className="text-xs">Zkuste změnit projekt nebo filtr</p>
                    </div>
                )}

                {!epicsLoading &&
                    epics.map((epic, idx) => (
                        <TreeNode
                            key={epic.key}
                            issue={epic}
                            level={0}
                            parentKey={null}
                            rowIndex={idx}
                            nodeStates={nodeStates}
                            expanded={expanded}
                            dragOverKey={dragOverKey}
                            controllerProps={nodeControllerProps}
                            onSelectIssue={onSelectIssue}
                        />
                    ))}
            </div>

            {/* Create modal */}
            {createCtx !== null && (
                <CreateIssueModal
                    projects={projects}
                    defaultProject={selectedProject ?? projects[0] ?? null}
                    defaultEpic={createDefaultEpic}
                    defaultParentKey={createDefaultParentKey}
                    defaultIssueTypeName={createTypeName}
                    onClose={() => setCreateCtx(null)}
                    onCreated={handleCreated}
                />
            )}

            {/* Cross-epic move confirmation dialog */}
            <MoveToEpicDialog moveCtx={moveCtx} onConfirm={handleMoveConfirm} onCancel={() => setMoveCtx(null)} />
        </div>
    )
}

export default TreeViewView
