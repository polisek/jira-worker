import { useState, useEffect } from 'react'
import { X, ExternalLink, Send, RefreshCw, Tag, Calendar, User, ChevronRight } from 'lucide-react'
import { jiraApi } from '../lib/jira-api'
import { adfToHtml, formatDate } from '../lib/adf-to-text'
import type { JiraIssue, JiraTransition } from '../types/jira'

interface Props {
  issue: JiraIssue
  onClose: () => void
  onUpdate: (updated: JiraIssue) => void
}

const statusCategoryClass: Record<string, string> = {
  new: 'badge-gray',
  indeterminate: 'badge-blue',
  done: 'badge-green'
}

export function TaskDetail({ issue, onClose, onUpdate }: Props) {
  const [detail, setDetail] = useState<JiraIssue>(issue)
  const [loading, setLoading] = useState(false)
  const [transitions, setTransitions] = useState<JiraTransition[]>([])
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = async () => {
    setLoading(true)
    try {
      const [issueData, transData] = await Promise.all([
        jiraApi.getIssue(issue.key),
        jiraApi.getTransitions(issue.key)
      ])
      setDetail(issueData)
      setTransitions(transData.transitions)
      onUpdate(issueData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDetail() }, [issue.key])

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

  const handleComment = async () => {
    if (!comment.trim()) return
    setSendingComment(true)
    setError(null)
    try {
      await jiraApi.addComment(detail.key, comment.trim())
      setComment('')
      await loadDetail()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSendingComment(false)
    }
  }

  const descHtml = detail.fields.description ? adfToHtml(detail.fields.description as any) : null
  const storyPoints = detail.fields.customfield_10016

  return (
    <div className="detail-panel w-[480px] border-l border-gray-800 flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-800 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <img src={detail.fields.issuetype.iconUrl} alt="" className="w-4 h-4 shrink-0" />
            <span className="text-xs font-mono text-gray-400">{detail.key}</span>
            <span className={`badge ${statusCategoryClass[detail.fields.status.statusCategory.key] ?? 'badge-gray'}`}>
              {detail.fields.status.name}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-gray-100 leading-snug">{detail.fields.summary}</h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={loadDetail} className="btn-icon" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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
                  {transitioning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="px-4 py-3 border-b border-gray-800 grid grid-cols-2 gap-3">
          <MetaItem label="Přiřazeno">
            {detail.fields.assignee ? (
              <div className="flex items-center gap-1.5">
                <img src={detail.fields.assignee.avatarUrls['48x48']} alt="" className="w-5 h-5 rounded-full" />
                <span className="text-xs text-gray-300">{detail.fields.assignee.displayName}</span>
              </div>
            ) : <span className="text-xs text-gray-500">Nikdo</span>}
          </MetaItem>

          <MetaItem label="Reporter">
            <div className="flex items-center gap-1.5">
              <img src={detail.fields.reporter.avatarUrls['48x48']} alt="" className="w-5 h-5 rounded-full" />
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
              <span className="text-xs text-blue-400 font-mono">{detail.fields.parent.key}</span>
            </MetaItem>
          )}
        </div>

        {/* Labels */}
        {detail.fields.labels?.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Štítky</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.fields.labels.map((l) => (
                <span key={l} className="badge badge-gray">{l}</span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {descHtml && (
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Popis</p>
            <div
              className="adf-content text-sm text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: descHtml }}
            />
          </div>
        )}

        {/* Subtasks */}
        {detail.fields.subtasks?.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Podúkoly ({detail.fields.subtasks.length})</p>
            <div className="flex flex-col gap-1">
              {detail.fields.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 py-1 px-2 rounded bg-gray-800/50">
                  <img src={s.fields.issuetype.iconUrl} alt="" className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono text-gray-500">{s.key}</span>
                  <span className="text-xs text-gray-300 truncate">{s.fields.summary}</span>
                  <span className={`ml-auto badge text-xs ${statusCategoryClass[s.fields.status.statusCategory.key] ?? 'badge-gray'}`}>
                    {s.fields.status.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="px-4 py-3">
          <p className="text-xs text-gray-500 mb-3">
            Komentáře ({detail.fields.comment?.total ?? 0})
          </p>
          <div className="flex flex-col gap-3 mb-4">
            {detail.fields.comment?.comments.slice(-10).map((c) => (
              <div key={c.id} className="flex gap-2">
                <img src={c.author.avatarUrls['48x48']} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-300">{c.author.displayName}</span>
                    <span className="text-xs text-gray-600">{formatDate(c.created)}</span>
                  </div>
                  <div
                    className="adf-content text-xs text-gray-400 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: adfToHtml(c.body as any) }}
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
                if (e.key === 'Enter' && e.ctrlKey) handleComment()
              }}
            />
            <button
              onClick={handleComment}
              disabled={sendingComment || !comment.trim()}
              className="btn-primary self-end px-3 py-2"
              title="Odeslat (Ctrl+Enter)"
            >
              {sendingComment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
