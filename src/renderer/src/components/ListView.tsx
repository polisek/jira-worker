import { RefreshCw, AlertCircle, ArrowUpDown } from 'lucide-react'
import { useIssues } from '../hooks/useIssues'
import { formatDateShort } from '../lib/adf-to-text'
import type { JiraIssue, JiraProject } from '../types/jira'

interface Props {
  selectedProject: JiraProject | null
  filter: 'all' | 'mine' | 'unassigned'
  searchQuery: string
  onSelectIssue: (issue: JiraIssue) => void
}

const statusColors: Record<string, string> = {
  new: 'badge-gray',
  indeterminate: 'badge-blue',
  done: 'badge-green'
}

const priorityDot: Record<string, string> = {
  Highest: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-blue-500',
  Lowest: 'bg-gray-500'
}

export function ListView({ selectedProject, filter, searchQuery, onSelectIssue }: Props) {
  const { issues, loading, error, total, reload } = useIssues({ selectedProject, filter, searchQuery })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-gray-100">
            {selectedProject ? selectedProject.name : 'Všechny projekty'}
          </h1>
          {!loading && <span className="text-xs text-gray-500">{total} tasků celkem</span>}
        </div>
        <button onClick={reload} className="btn-icon" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
            <tr>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-28">Klíč</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Název</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-36">Status</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-28">Priorita</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-36">Přiřazeno</th>
              <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-28">Termín</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Načítám...</td></tr>
            )}
            {!loading && issues.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Žádné tasky</td></tr>
            )}
            {issues.map((issue, i) => (
              <tr
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className={`cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-800/20'}`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <img src={issue.fields.issuetype.iconUrl} alt="" className="w-4 h-4" />
                    <span className="font-mono text-xs text-gray-400">{issue.key}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-gray-200 line-clamp-1">{issue.fields.summary}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`badge ${statusColors[issue.fields.status.statusCategory.key] ?? 'badge-gray'}`}>
                    {issue.fields.status.name}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${priorityDot[issue.fields.priority?.name] ?? 'bg-gray-500'}`} />
                    <span className="text-gray-400 text-xs">{issue.fields.priority?.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {issue.fields.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <img src={issue.fields.assignee.avatarUrls['48x48']} alt="" className="w-5 h-5 rounded-full" />
                      <span className="text-gray-400 text-xs truncate max-w-24">{issue.fields.assignee.displayName}</span>
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {issue.fields.duedate ? (
                    <span className="text-gray-400 text-xs">{formatDateShort(issue.fields.duedate)}</span>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
