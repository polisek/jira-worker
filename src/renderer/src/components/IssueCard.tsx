import type { JiraIssue } from '../types/jira'
import { formatDateShort } from '../lib/adf-to-text'
import { Calendar, MessageSquare, Tag } from 'lucide-react'

interface Props {
  issue: JiraIssue
  onClick: () => void
}

const priorityColors: Record<string, string> = {
  Highest: 'text-red-400',
  High: 'text-orange-400',
  Medium: 'text-yellow-400',
  Low: 'text-blue-400',
  Lowest: 'text-gray-400'
}

const priorityDot: Record<string, string> = {
  Highest: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-blue-500',
  Lowest: 'bg-gray-500'
}

export function IssueCard({ issue, onClick }: Props) {
  const { fields } = issue
  const commentCount = fields.comment?.total ?? 0
  const storyPoints = fields.customfield_10016

  return (
    <div className="issue-card group cursor-pointer" onClick={onClick}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <img src={fields.issuetype.iconUrl} alt={fields.issuetype.name} className="w-4 h-4 shrink-0" />
          <span className="text-xs text-gray-500 font-mono shrink-0">{issue.key}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {storyPoints != null && (
            <span className="badge badge-blue">{storyPoints} SP</span>
          )}
          <span className={`w-2 h-2 rounded-full ${priorityDot[fields.priority?.name] ?? 'bg-gray-500'}`} title={fields.priority?.name} />
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-100 leading-snug mb-2 line-clamp-2 group-hover:text-white">
        {fields.summary}
      </p>

      {/* Labels */}
      {fields.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {fields.labels.slice(0, 3).map((l) => (
            <span key={l} className="badge badge-gray">{l}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
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
