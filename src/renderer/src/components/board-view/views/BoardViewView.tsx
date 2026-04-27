import { RefreshCw, Plus, Settings2 } from "lucide-react"
import { ErrorMessage } from "../../shared/ErrorMessage"
import CreateIssueModal from "../../create-issue-modal"
import { StatusManagerDialog } from "../../StatusManagerDialog"
import { BoardColumn } from "../components/BoardColumn"
import { SprintSelector } from "../components/SprintSelector"
import type { BoardViewProps } from "../hooks/useBoardView"

function BoardViewView({
    selectedProject,
    projects,
    onSelectIssue,
    dataProps,
    controllerProps,
    dialogProps,
    sprintProps,
}: BoardViewProps) {
    const { isLoading, error, total, refetch } = dataProps
    const { columns, draggingId, dragOverCol, draggingColId, dragOverColId, getColumnIssues } = controllerProps
    const { showCreate, setShowCreate, showStatusManager, setShowStatusManager } = dialogProps

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <h1 className="font-semibold text-gray-100 truncate">
                        {selectedProject ? selectedProject.name : "Všechny projekty"}
                    </h1>
                    {!isLoading && <span className="text-xs text-gray-500 shrink-0">{total} tasků</span>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <SprintSelector sprintProps={sprintProps} />

                    <button onClick={refetch} className="btn-icon" disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    {selectedProject && (
                        <button onClick={() => setShowStatusManager(true)} className="btn-icon" title="Spravovat stavy">
                            <Settings2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => setShowCreate(true)}
                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                    >
                        <Plus className="w-4 h-4" /> Nový task
                    </button>
                </div>
            </div>

            {showStatusManager && selectedProject && (
                <StatusManagerDialog project={selectedProject} onClose={() => setShowStatusManager(false)} />
            )}

            {showCreate && (
                <CreateIssueModal
                    projects={projects}
                    defaultProject={selectedProject}
                    onClose={() => setShowCreate(false)}
                    onCreated={(issue) => {
                        setShowCreate(false)
                        onSelectIssue(issue)
                        refetch()
                    }}
                />
            )}

            {error && <ErrorMessage message={error} />}

            {/* Board */}
            <div className="flex-1 flex gap-3 p-4 overflow-x-auto overflow-y-hidden">
                {/* Skeleton při prvním načtení */}
                {isLoading &&
                    columns.length === 0 &&
                    ["", "", ""].map((_, i) => (
                        <div key={i} className="board-column flex flex-col min-w-64 max-w-64">
                            <div className="h-5 bg-gray-800 rounded mb-3 w-28 animate-pulse" />
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="issue-card skeleton h-24 mb-2" />
                            ))}
                        </div>
                    ))}

                {columns.map((col) => (
                    <BoardColumn
                        key={col.id}
                        col={col}
                        colIssues={getColumnIssues(col.id)}
                        isCardOver={dragOverCol === col.id}
                        isColOver={dragOverColId === col.id && draggingColId !== col.id}
                        isDraggingCol={draggingColId === col.id}
                        isLoading={isLoading}
                        onSelectIssue={onSelectIssue}
                        controllerProps={{
                            draggingId,
                            transitioning: controllerProps.transitioning,
                            handleDragStart: controllerProps.handleDragStart,
                            handleDragEnd: controllerProps.handleDragEnd,
                            handleDragOver: controllerProps.handleDragOver,
                            handleDragLeave: controllerProps.handleDragLeave,
                            handleDrop: controllerProps.handleDrop,
                            handleColDragStart: controllerProps.handleColDragStart,
                            handleColDragEnd: controllerProps.handleColDragEnd,
                        }}
                    />
                ))}

                {!isLoading && columns.length === 0 && !error && (
                    <div className="flex-1 flex items-center justify-center text-gray-600">Žádné tasky</div>
                )}
            </div>
        </div>
    )
}

export default BoardViewView
