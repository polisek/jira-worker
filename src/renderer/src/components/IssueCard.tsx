import type { JiraIssue } from '../types/jira'
import { formatDateShort } from '../lib/adf-to-text'
import { Calendar, MessageSquare, GripVertical } from 'lucide-react'
import { PriorityDot } from './IssueBadges'

interface Props {
  issue: JiraIssue
  onClick: () => void
  // Drag & drop
  dragging?: boolean
  transitioning?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}


export function IssueCard({ issue, onClick, dragging, transitioning, onDragStart, onDragEnd }: Props) {
  const { fields } = issue
  const commentCount = fields.comment?.total ?? 0
  const storyPoints = fields.customfield_10016

  return (
    <div
      className={`issue-card group relative transition-all ${
        dragging ? 'opacity-40 scale-95 rotate-1' : 'opacity-100'
      } ${
        transitioning ? 'opacity-60 pointer-events-none' : 'cursor-grab active:cursor-grabbing'
      }`}
      draggable={!transitioning}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={transitioning ? undefined : onClick}
    >
      {/* Grip handle — jen při hoveru */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Transitioning spinner */}
      {transitioning && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2 pl-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <img src={fields.issuetype.iconUrl} alt={fields.issuetype.name} className="w-4 h-4 shrink-0" />
          <span className="text-xs text-gray-500 font-mono shrink-0">{issue.key}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {storyPoints != null && (
            <span className="badge badge-blue">{storyPoints} SP</span>
          )}
          <PriorityDot priority={fields.priority} title={fields.priority?.name} />
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-100 leading-snug mb-2 line-clamp-2 group-hover:text-white pl-3">
        {fields.summary}
      </p>

      {/* Labels */}
      {fields.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 pl-3">
          {fields.labels.slice(0, 3).map((l) => (
            <span key={l} className="badge badge-gray">{l}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1 pl-3">
        <div className="flex items-center gap-2">
          {fields.duedate && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              {formatDateShort(fields.duedate)}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MessageSquare className="w-3 h-3" />
              {commentCount}
            </span>
          )}
        </div>

        {fields.assignee ? (
          <img
            src={fields.assignee.avatarUrls['48x48']}
            alt={fields.assignee.displayName}
            title={fields.assignee.displayName}
            className="w-5 h-5 rounded-full border border-gray-700"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
            <span className="text-gray-500 text-xs">?</span>
          </div>
        )}
      </div>
    </div>
  )
}
