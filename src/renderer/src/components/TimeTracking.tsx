import { useState, useEffect } from 'react'
import { Clock, Loader, Plus, Pencil, Check, X } from 'lucide-react'
import { jiraApi } from '../lib/jira-api'
import { fmtTime } from '../lib/time'
import type { JiraIssue } from '../types/jira'

interface TimeData {
  spent: number
  estimate: number
  original: number
}

// Cache: issueKey → time data (v paměti, vyčistí se při reloadu)
const timeCache = new Map<string, TimeData>()

interface Props {
  issue: JiraIssue
  onLogWork?: () => void
  onOriginalEdited?: () => void
}

export function TimeTracking({ issue, onLogWork, onOriginalEdited }: Props) {
  const [data, setData] = useState<TimeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingOriginal, setEditingOriginal] = useState(false)
  const [originalDraft, setOriginalDraft] = useState("")
  const [savingOriginal, setSavingOriginal] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const own: TimeData = {
      spent: issue.fields.timespent ?? 0,
      estimate: issue.fields.timeestimate ?? 0,
      original: issue.fields.timeoriginalestimate ?? 0,
    }

    const hasOwnTime = own.spent > 0 || own.estimate > 0 || own.original > 0
    const subtasks = issue.fields.subtasks ?? []

    if (!hasOwnTime && subtasks.length === 0) return

    if (subtasks.length === 0) {
      setData(own)
      return
    }

    const cacheKey = `${issue.key}:${issue.fields.timespent}:${subtasks.length}`
    if (timeCache.has(cacheKey)) {
      setData(timeCache.get(cacheKey)!)
      return
    }

    setData(own)
    setLoading(true)

    Promise.all(
      subtasks.map((s) =>
        jiraApi.getIssueTime(s.key).catch(() => ({ timespent: 0, timeestimate: 0, timeoriginalestimate: 0 }))
      )
    ).then((results) => {
      const aggregated: TimeData = { ...own }
      for (const r of results) {
        aggregated.spent += r.timespent ?? 0
        aggregated.estimate += r.timeestimate ?? 0
        aggregated.original += r.timeoriginalestimate ?? 0
      }
      timeCache.set(cacheKey, aggregated)
      setData(aggregated)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [issue.key, issue.fields.timespent])

  const startEditOriginal = () => {
    setOriginalDraft(issue.fields.timeoriginalestimate ? fmtTime(issue.fields.timeoriginalestimate) : "")
    setSaveError(null)
    setEditingOriginal(true)
  }

  const saveOriginal = async () => {
    if (!originalDraft.trim()) return
    setSavingOriginal(true)
    setSaveError(null)
    try {
      await jiraApi.updateIssue(issue.key, { timetracking: { originalEstimate: originalDraft.trim() } })
      onOriginalEdited?.()
      setEditingOriginal(false)
    } catch (e: any) {
      setSaveError(e?.message ?? "Chyba při ukládání")
    } finally {
      setSavingOriginal(false)
    }
  }

  if (!data && !onLogWork) return null

  const hasOriginal = data ? data.original > 0 : false
  const hasEstimate = data ? data.estimate > 0 : false
  const hasSpent = data ? data.spent > 0 : false
  const subtaskCount = (issue.fields.subtasks ?? []).length

  const total = data ? (hasOriginal ? data.original : hasEstimate ? data.estimate : 0) : 0
  const progress = data && total > 0 ? Math.min((data.spent / total) * 100, 100) : 0
  const isOver = data ? data.spent > total && total > 0 : false

  const ownOriginal = issue.fields.timeoriginalestimate

  return (
    <div className="px-4 py-3 border-b border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Čas
          {subtaskCount > 0 && (
            <span className="text-gray-600">
              {loading ? '(načítám podúkoly…)' : `(vč. ${subtaskCount} podúkolů)`}
            </span>
          )}
          {loading && <Loader className="w-3 h-3 animate-spin text-gray-600" />}
        </p>
        {onLogWork && (
          <button onClick={onLogWork} className="btn-sm flex items-center gap-1 text-xs">
            <Plus className="w-3 h-3" />
            Zaznamenat práci
          </button>
        )}
      </div>

      {data && (
        <>
          <div className="flex items-center gap-4 text-xs mb-2">
            {hasSpent && (
              <div>
                <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-blue-400'}`}>
                  {fmtTime(data.spent)}
                </span>
                <span className="text-gray-600 ml-1">odpracováno</span>
              </div>
            )}
            {(hasOriginal || hasEstimate) && (
              <div>
                <span className="font-semibold text-gray-300">
                  {fmtTime(hasOriginal ? data.original : data.estimate)}
                </span>
                <span className="text-gray-600 ml-1">{hasOriginal ? 'odhad' : 'zbývá'}</span>
              </div>
            )}
            {hasEstimate && hasOriginal && (
              <div>
                <span className="font-semibold text-gray-400">{fmtTime(data.estimate)}</span>
                <span className="text-gray-600 ml-1">zbývá</span>
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </>
      )}

      {/* Původní odhad — editovatelný */}
      <div className="pt-2 border-t border-gray-800/60">
        {!editingOriginal ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 shrink-0">Původní odhad:</span>
            <span className="text-xs font-semibold text-gray-300">
              {ownOriginal ? fmtTime(ownOriginal) : <span className="text-gray-600 font-normal">Nenastaveno</span>}
            </span>
            <button
              onClick={startEditOriginal}
              className="btn-icon !w-5 !h-5 ml-auto"
              title="Upravit původní odhad"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-600">Původní odhad:</span>
            <div className="flex items-center gap-1.5">
              <input
                className="input text-xs h-7 py-0 flex-1"
                value={originalDraft}
                onChange={e => setOriginalDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveOriginal()
                  if (e.key === "Escape") setEditingOriginal(false)
                }}
                placeholder="např. 2h 30m, 1d"
                disabled={savingOriginal}
                autoFocus
              />
              <button
                onClick={saveOriginal}
                disabled={savingOriginal || !originalDraft.trim()}
                className="btn-icon !w-7 !h-7 text-green-400 hover:text-green-300"
                title="Uložit"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingOriginal(false)}
                disabled={savingOriginal}
                className="btn-icon !w-7 !h-7"
                title="Zrušit"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {saveError && <p className="text-[10px] text-red-400">{saveError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
