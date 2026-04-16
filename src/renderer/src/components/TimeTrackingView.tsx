import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Search, Trash2, Upload, Clock, X, Pencil, Check } from 'lucide-react'
import { jiraApi } from '../lib/jira-api'
import type { TimeEntry, JiraIssue } from '../types/jira'

// Parsuje "1h 30m" nebo "1:30:00" nebo "90" (minuty) na sekundy
function parseDuration(input: string): number | null {
  const trimmed = input.trim()

  // Formát HH:MM nebo HH:MM:SS
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1])
    const m = parseInt(colonMatch[2])
    const s = parseInt(colonMatch[3] ?? '0')
    return h * 3600 + m * 60 + s
  }

  // Formát "1h 30m", "2h", "45m", "30s"
  let total = 0
  const hMatch = trimmed.match(/(\d+)\s*h/)
  const mMatch = trimmed.match(/(\d+)\s*m/)
  const sMatch = trimmed.match(/(\d+)\s*s/)
  if (hMatch) total += parseInt(hMatch[1]) * 3600
  if (mMatch) total += parseInt(mMatch[1]) * 60
  if (sMatch) total += parseInt(sMatch[1])
  if (total > 0) return total

  // Samotné číslo = minuty
  const num = parseInt(trimmed)
  if (!isNaN(num) && num > 0) return num * 60

  return null
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${seconds % 60}s`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export function TimeTrackingView() {
  // Timer state
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0) // sekundy
  const [startTime, setStartTime] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Task search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<JiraIssue[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
  const [notes, setNotes] = useState('')

  // History
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [logging, setLogging] = useState<string | null>(null)
  const [logMsg, setLogMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Editace záznamu
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDuration, setEditDuration] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editIssue, setEditIssue] = useState<JiraIssue | null>(null)
  const [editQuery, setEditQuery] = useState('')
  const [editResults, setEditResults] = useState<JiraIssue[]>([])
  const [editSearching, setEditSearching] = useState(false)

  // Načteme historii
  useEffect(() => {
    window.api.getTimeEntries().then((e) => setEntries(e as TimeEntry[]))
  }, [])

  // Timer tick
  useEffect(() => {
    if (running && !paused) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, paused])

  // Vyhledávání tasků
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await jiraApi.searchIssues(
          `summary ~ "${query.trim()}" OR key = "${query.trim()}" ORDER BY updated DESC`,
          10
        )
        setSearchResults(res.issues)
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  // Vyhledávání tasků v edit módu
  useEffect(() => {
    if (!editQuery.trim()) { setEditResults([]); return }
    const timer = setTimeout(async () => {
      setEditSearching(true)
      try {
        const res = await jiraApi.searchIssues(
          `summary ~ "${editQuery.trim()}" OR key = "${editQuery.trim()}" ORDER BY updated DESC`, 10
        )
        setEditResults(res.issues)
      } catch { setEditResults([]) }
      finally { setEditSearching(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [editQuery])

  const reloadEntries = async () => {
    const fresh = await window.api.getTimeEntries()
    setEntries(fresh as TimeEntry[])
  }

  const handleStart = () => {
    setRunning(true)
    setPaused(false)
    setElapsed(0)
    setStartTime(new Date().toISOString())
  }

  const handlePause = () => setPaused((p) => !p)

  const handleStop = async () => {
    if (!running || elapsed < 1 || saving) return
    setSaving(true)

    const entry: TimeEntry = {
      id: Date.now().toString(),
      startTime: startTime!,
      endTime: new Date().toISOString(),
      duration: elapsed,
      issueKey: selectedIssue?.key,
      issueSummary: selectedIssue?.fields.summary,
      notes: notes.trim() || undefined,
      loggedToJira: false
    }

    await window.api.saveTimeEntry(entry)
    await reloadEntries()

    // Reset
    setRunning(false)
    setPaused(false)
    setElapsed(0)
    setStartTime(null)
    setSelectedIssue(null)
    setNotes('')
    setQuery('')
    setSaving(false)
  }

  const handleLogToJira = async (entry: TimeEntry) => {
    if (!entry.issueKey) return

    // Jira vyžaduje minimum 60 sekund
    const timeToLog = Math.max(60, entry.duration)

    setLogging(entry.id)
    setLogMsg(null)
    try {
      await jiraApi.logWork(entry.issueKey, timeToLog, entry.notes)
      // Označíme jako zalogováno
      const updated = { ...entry, loggedToJira: true }
      await window.api.saveTimeEntry(updated)
      await reloadEntries()
      const rounded = timeToLog > entry.duration ? ' (zaokrouhleno na 1m)' : ''
      setLogMsg({ id: entry.id, ok: true, text: `Zalogováno!${rounded}` })
    } catch (e: any) {
      setLogMsg({ id: entry.id, ok: false, text: e.message })
    } finally {
      setLogging(null)
    }
  }

  const handleDelete = async (id: string) => {
    await window.api.deleteTimeEntry(id)
    await reloadEntries()
  }

  const startEdit = (entry: TimeEntry) => {
    setEditingId(entry.id)
    setEditDuration(formatDurationShort(entry.duration))
    setEditNotes(entry.notes ?? '')
    setEditIssue(entry.issueKey ? { key: entry.issueKey, fields: { summary: entry.issueSummary ?? '' } } as any : null)
    setEditQuery('')
    setEditResults([])
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQuery('')
    setEditResults([])
    setEditError(null)
  }

  const saveEdit = async (entry: TimeEntry) => {
    const newDuration = parseDuration(editDuration)
    if (newDuration === null || newDuration <= 0) {
      setEditError('Neplatný formát. Použij: 1h 30m, 1:30, nebo 90')
      return
    }
    const updated: TimeEntry = {
      ...entry,
      duration: newDuration,
      notes: editNotes.trim() || undefined,
      issueKey: editIssue?.key,
      issueSummary: editIssue?.fields.summary,
      loggedToJira: false
    }
    await window.api.saveTimeEntry(updated)
    await reloadEntries()
    setEditingId(null)
    setEditQuery('')
    setEditResults([])
    setEditError(null)
  }

  const totalToday = entries
    .filter((e) => new Date(e.startTime).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + e.duration, 0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h1 className="font-semibold text-gray-100">Měření času</h1>
        </div>
        <span className="text-xs text-gray-500">Dnes celkem: <span className="text-gray-300 font-medium">{formatDurationShort(totalToday)}</span></span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Timer panel */}
        <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-6">
          {/* Čas */}
          <div className="text-center mb-6">
            <div className={`text-6xl font-mono font-bold tracking-widest transition-colors ${
              running && !paused ? 'text-blue-300' : paused ? 'text-yellow-400' : 'text-gray-500'
            }`}>
              {formatDuration(elapsed)}
            </div>
            {running && (
              <p className="text-xs text-gray-600 mt-1">
                {paused ? 'Pozastaveno' : `Spuštěno ${startTime ? formatDateTime(startTime) : ''}`}
              </p>
            )}
          </div>

          {/* Ovládání */}
          <div className="flex justify-center gap-3 mb-6">
            {!running ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                <Play className="w-4 h-4" /> Spustit
              </button>
            ) : (
              <>
                <button
                  onClick={handlePause}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    paused
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-yellow-600/80 hover:bg-yellow-500 text-white'
                  }`}
                >
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {paused ? 'Pokračovat' : 'Pauza'}
                </button>
                <button
                  onClick={handleStop}
                  disabled={saving}
                  className="flex items-center gap-2 bg-red-600/80 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Square className="w-4 h-4" />
                  }
                  Uložit
                </button>
              </>
            )}
          </div>

          {/* Task + poznámka */}
          <div className="flex flex-col gap-3">
            {/* Task vyhledávání */}
            <div className="relative">
              <div className="flex items-center gap-2 input">
                {searching
                  ? <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin shrink-0" />
                  : <Search className="w-4 h-4 text-gray-500 shrink-0" />
                }
                {selectedIssue ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-mono text-blue-400 shrink-0">{selectedIssue.key}</span>
                    <span className="text-sm text-gray-200 truncate">{selectedIssue.fields.summary}</span>
                    <button onClick={() => { setSelectedIssue(null); setQuery('') }} className="text-gray-500 hover:text-gray-300 shrink-0 ml-auto">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Přiřadit k tasku (hledat klíč nebo název)..."
                    className="flex-1 bg-transparent outline-none text-sm text-gray-200 placeholder-gray-600"
                  />
                )}
              </div>

              {/* Dropdown výsledků */}
              {!selectedIssue && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {searchResults.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => { setSelectedIssue(issue); setQuery(''); setSearchResults([]) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800 transition-colors text-left"
                    >
                      <img src={issue.fields.issuetype.iconUrl} alt="" className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-mono text-gray-500 shrink-0">{issue.key}</span>
                      <span className="text-sm text-gray-200 truncate">{issue.fields.summary}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Poznámka */}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Poznámka (volitelné)..."
              className="input text-sm"
            />
          </div>
        </div>

        {/* Historie */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Historie</h2>

          {entries.length === 0 && (
            <p className="text-gray-600 text-sm text-center py-8">Žádné záznamy</p>
          )}

          <div className="flex flex-col gap-2">
            {entries.map((entry) => {
              const isEditing = editingId === entry.id
              return (
                <div key={entry.id} className={`bg-gray-800/40 border rounded-lg px-4 py-3 flex flex-col gap-2 transition-colors ${isEditing ? 'border-blue-500/50' : 'border-gray-700/50'}`}>
                  <div className="flex items-center gap-3">
                    {/* Čas */}
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="input font-mono text-lg w-28 py-1 text-center"
                        placeholder="1h 30m"
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(entry); if (e.key === 'Escape') cancelEdit() }}
                      />
                    ) : (
                      <div className="text-2xl font-mono font-semibold text-gray-300 w-24 shrink-0 tabular-nums">
                        {formatDurationShort(entry.duration)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {entry.issueKey && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-mono text-blue-400">{entry.issueKey}</span>
                          <span className="text-xs text-gray-400 truncate">{entry.issueSummary}</span>
                        </div>
                      )}
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          {/* Task picker */}
                          <div className="relative">
                            {editIssue ? (
                              <div className="input text-xs py-1 flex items-center gap-1.5">
                                <span className="font-mono text-blue-400 shrink-0">{editIssue.key}</span>
                                <span className="text-gray-300 truncate">{editIssue.fields.summary}</span>
                                <button onClick={() => { setEditIssue(null); setEditQuery('') }} className="ml-auto text-gray-500 hover:text-gray-300 shrink-0">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="input text-xs py-1 flex items-center gap-1.5">
                                {editSearching
                                  ? <div className="w-3 h-3 border border-gray-600 border-t-blue-400 rounded-full animate-spin shrink-0" />
                                  : <Search className="w-3 h-3 text-gray-500 shrink-0" />
                                }
                                <input
                                  value={editQuery}
                                  onChange={(e) => setEditQuery(e.target.value)}
                                  placeholder="Přiřadit task (hledat)..."
                                  className="flex-1 bg-transparent outline-none text-gray-200 placeholder-gray-600"
                                />
                              </div>
                            )}
                            {!editIssue && editResults.length > 0 && (
                              <div className="absolute top-full mt-0.5 left-0 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 max-h-36 overflow-y-auto">
                                {editResults.map((issue) => (
                                  <button
                                    key={issue.id}
                                    onClick={() => { setEditIssue(issue); setEditQuery(''); setEditResults([]) }}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800 text-left text-xs"
                                  >
                                    <img src={issue.fields.issuetype.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
                                    <span className="font-mono text-gray-500 shrink-0">{issue.key}</span>
                                    <span className="text-gray-300 truncate">{issue.fields.summary}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <input
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="input text-xs py-1 w-full"
                            placeholder="Poznámka..."
                            onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit() }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">{formatDateTime(entry.startTime)}</span>
                          {entry.notes && <span className="text-xs text-gray-500 truncate">· {entry.notes}</span>}
                          {entry.loggedToJira && <span className="badge badge-green text-xs">Zalogováno</span>}
                        </div>
                      )}
                    </div>

                    {/* Akce */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {logMsg?.id === entry.id && !isEditing && (
                        <span className={`text-xs ${logMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                          {logMsg.text}
                        </span>
                      )}

                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(entry)} className="btn-sm text-green-400 border-green-700/50" title="Uložit (Enter)">
                            <Check className="w-3 h-3" /> Uložit
                          </button>
                          <button onClick={cancelEdit} className="btn-icon text-gray-500 hover:text-gray-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {entry.issueKey && !entry.loggedToJira && (
                            <button
                              onClick={() => handleLogToJira(entry)}
                              disabled={logging === entry.id}
                              className="btn-sm"
                              title="Zalogovat do Jiry"
                            >
                              {logging === entry.id
                                ? <div className="w-3 h-3 border border-gray-500 border-t-blue-400 rounded-full animate-spin" />
                                : <Upload className="w-3 h-3" />
                              }
                              Log
                            </button>
                          )}
                          <button onClick={() => startEdit(entry)} className="btn-icon text-gray-600 hover:text-gray-300" title="Upravit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(entry.id)} className="btn-icon text-gray-600 hover:text-red-400" title="Smazat">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Edit error */}
                  {isEditing && editError && (
                    <p className="text-xs text-red-400 pl-1">{editError}</p>
                  )}
                  {isEditing && (
                    <p className="text-xs text-gray-600 pl-1">Formáty: <span className="text-gray-500">1h 30m · 1:30 · 90 (minut)</span> · Enter uloží · Esc zruší</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
