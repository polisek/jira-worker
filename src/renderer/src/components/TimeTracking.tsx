import { useState, useEffect } from 'react'
import { Clock, Loader, Plus } from 'lucide-react'
import { jiraApi } from '../lib/jira-api'
import type { JiraIssue } from '../types/jira'

interface TimeData {
  spent: number
  estimate: number
  original: number
}

function fmt(seconds: number): string {
  if (!seconds) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

// Cache: issueKey → time data (v paměti, vyčistí se při reloadu)
const timeCache = new Map<string, TimeData>()

interface Props {
  issue: JiraIssue
  onLogWork?: () => void
}

export function TimeTracking({ issue, onLogWork }: Props) {
  const [data, setData] = useState<TimeData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const own: TimeData = {
      spent: issue.fields.timespent ?? 0,
      estimate: issue.fields.timeestimate ?? 0,
      original: issue.fields.timeoriginalestimate ?? 0,
    }

    // Pokud nemáme žádná data a nemáme subtasky, nezobrazíme nic
    const hasOwnTime = own.spent > 0 || own.estimate > 0 || own.original > 0
    const subtasks = issue.fields.subtasks ?? []

    if (!hasOwnTime && subtasks.length === 0) return

    // Bez subtasků — zobrazíme vlastní data přímo
    if (subtasks.length === 0) {
      setData(own)
      return
    }

    // S podúkoly — zkusíme cache, jinak fetchneme
    const cacheKey = `${issue.key}:${issue.fields.timespent}:${subtasks.length}`
    if (timeCache.has(cacheKey)) {
      setData(timeCache.get(cacheKey)!)
      return
    }

    setData(own) // Zobrazíme vlastní data okamžitě
    setLoading(true)

    // Paralelně načteme čas ze všech podúkolů
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

  if (!data && !onLogWork) return null

  const hasOriginal = data ? data.original > 0 : false
  const hasEstimate = data ? data.estimate > 0 : false
  const hasSpent = data ? data.spent > 0 : false
  const subtaskCount = (issue.fields.subtasks ?? []).length

  // Progress: kolik z původního odhadu je odpracováno
  const total = data ? (hasOriginal ? data.original : hasEstimate ? data.estimate : 0) : 0
  const progress = data && total > 0 ? Math.min((data.spent / total) * 100, 100) : 0
  const isOver = data ? data.spent > total && total > 0 : false

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
          <button
            onClick={onLogWork}
            className="btn-sm flex items-center gap-1 text-xs"
          >
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
                  {fmt(data.spent)}
                </span>
                <span className="text-gray-600 ml-1">odpracováno</span>
              </div>
            )}
            {(hasOriginal || hasEstimate) && (
              <div>
                <span className="font-semibold text-gray-300">
                  {fmt(hasOriginal ? data.original : data.estimate)}
                </span>
                <span className="text-gray-600 ml-1">{hasOriginal ? 'odhad' : 'zbývá'}</span>
              </div>
            )}
            {hasEstimate && hasOriginal && (
              <div>
                <span className="font-semibold text-gray-400">{fmt(data.estimate)}</span>
                <span className="text-gray-600 ml-1">zbývá</span>
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
