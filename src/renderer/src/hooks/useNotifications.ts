import { useState, useEffect, useCallback, useRef } from 'react'
import { jiraApi } from '../lib/jira-api'
import type { JiraIssue, AppPrefs } from '../types/jira'

const SEEN_KEY = 'jw_seen_assignments'

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveSeenIds(ids: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
}

export interface NotificationState {
  recent: JiraIssue[]       // tasky za posledních 24h přiřazené na mě
  unreadCount: number       // nepřečtené (nové od posledního markAllRead)
  loading: boolean
  markAllRead: () => void
  refresh: () => void
}

export function useNotifications(prefs: AppPrefs): NotificationState {
  const [recent, setRecent] = useState<JiraIssue[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const seenIds = useRef<Set<string>>(getSeenIds())
  // Při prvním načtení označíme vše jako přečtené — notifikace jen pro nové
  const initializedRef = useRef(false)

  const poll = useCallback(async () => {
    setLoading(true)
    try {
      const jql = `assignee = currentUser() AND updated >= "-${prefs.notifWindowHours}h" ORDER BY updated DESC`
      const result = await jiraApi.searchIssues(jql, 20)
      const issues = result.issues ?? []
      setRecent(issues)

      if (!initializedRef.current) {
        // První načtení — vše označit jako viděné, bez notifikace
        issues.forEach((i) => seenIds.current.add(i.id))
        saveSeenIds(seenIds.current)
        initializedRef.current = true
        setUnreadCount(0)
        return
      }

      // Najdi nové (neviděné) tasky
      const newIssues = issues.filter((i) => !seenIds.current.has(i.id))
      if (newIssues.length > 0) {
        setUnreadCount((prev) => prev + newIssues.length)

        // Nativní notifikace
        if (newIssues.length === 1) {
          const i = newIssues[0]
          window.api.notify(
            `Nový task: ${i.key}`,
            i.fields.summary
          )
        } else {
          window.api.notify(
            `${newIssues.length} nové tasky`,
            newIssues.map((i) => i.key).join(', ')
          )
        }

        newIssues.forEach((i) => seenIds.current.add(i.id))
        saveSeenIds(seenIds.current)
      }
    } catch {
      // Tiše ignorujeme chyby pollingu (offline, přihlášení atd.)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    poll()
    const ms = prefs.pollIntervalMinutes * 60 * 1000
    const timer = setInterval(poll, ms)
    return () => clearInterval(timer)
  }, [poll, prefs.pollIntervalMinutes])

  const markAllRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  return { recent, unreadCount, loading, markAllRead, refresh: poll }
}
