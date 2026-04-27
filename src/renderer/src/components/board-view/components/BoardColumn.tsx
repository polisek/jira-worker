import { GripVertical } from 'lucide-react'
import { statusDotClass } from '../../IssueBadges'
import { IssueCard } from './IssueCard'
import type { JiraIssue } from '../../../types/jira'
import type { ColumnDef, BoardViewControllerProps } from '../hooks/useBoardView.controller'

const CATEGORY_RING: Record<string, string> = {
    new: 'ring-gray-500/40',
    indeterminate: 'ring-blue-500/40',
    done: 'ring-green-500/40',
}

interface Props {
    col: ColumnDef
    colIssues: JiraIssue[]
    isCardOver: boolean
    isColOver: boolean
    isDraggingCol: boolean
    isLoading: boolean
    onSelectIssue: (issue: JiraIssue) => void
    controllerProps: Pick<
        BoardViewControllerProps,
        | 'draggingId'
        | 'transitioning'
        | 'handleDragStart'
        | 'handleDragEnd'
        | 'handleDragOver'
        | 'handleDragLeave'
        | 'handleDrop'
        | 'handleColDragStart'
        | 'handleColDragEnd'
    >
}

export function BoardColumn({
    col,
    colIssues,
    isCardOver,
    isColOver,
    isDraggingCol,
    isLoading,
    onSelectIssue,
    controllerProps,
}: Props) {
    const {
        draggingId,
        transitioning,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleColDragStart,
        handleColDragEnd,
    } = controllerProps

    return (
        <div
            className={`board-column flex flex-col min-w-64 max-w-64 transition-all ${
                isColOver
                    ? 'ring-2 ring-amber-500/40 bg-amber-500/5'
                    : isCardOver
                      ? `ring-2 ${CATEGORY_RING[col.categoryKey] ?? 'ring-blue-500/40'} bg-blue-500/5`
                      : ''
            } ${isDraggingCol ? 'opacity-40' : ''}`}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id, col.categoryKey)}
        >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div
                    className="flex items-center gap-2 min-w-0 cursor-grab active:cursor-grabbing select-none"
                    draggable
                    onDragStart={(e) => handleColDragStart(e, col.id)}
                    onDragEnd={handleColDragEnd}
                >
                    <GripVertical className="w-3.5 h-3.5 text-gray-700 shrink-0" />
                    <div className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(col.categoryKey)}`} />
                    <span className="text-sm font-semibold text-gray-300 truncate" title={col.name}>
                        {col.name}
                    </span>
                </div>
                <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5 shrink-0 ml-1">
                    {isLoading ? '...' : colIssues.length}
                </span>
            </div>

            {isCardOver && (
                <div
                    className={`mx-1 mb-2 h-0.5 rounded-full animate-pulse ${
                        col.categoryKey === 'done'
                            ? 'bg-green-500/60'
                            : col.categoryKey === 'indeterminate'
                              ? 'bg-blue-500/60'
                              : 'bg-gray-500/60'
                    }`}
                />
            )}

            {/* Cards */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                {colIssues.map((issue) => (
                    <IssueCard
                        key={issue.id}
                        issue={issue}
                        onClick={() => onSelectIssue(issue)}
                        dragging={draggingId === issue.id}
                        transitioning={transitioning.has(issue.id)}
                        onDragStart={(e) => handleDragStart(e, issue.id)}
                        onDragEnd={handleDragEnd}
                    />
                ))}

                {!isLoading && colIssues.length === 0 && (
                    <div
                        className={`flex items-center justify-center h-16 text-sm rounded-lg border border-dashed transition-colors ${
                            isCardOver
                                ? 'border-blue-500/50 text-blue-400/60'
                                : 'border-gray-800 text-gray-700'
                        }`}
                    >
                        {isCardOver ? 'Pustit sem' : 'Prázdné'}
                    </div>
                )}
            </div>
        </div>
    )
}
