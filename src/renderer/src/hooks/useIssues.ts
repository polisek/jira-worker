import { useState, useEffect, useCallback } from 'react'
import { jiraApi } from '../lib/jira-api'
import type { JiraIssue, JiraProject, AppPrefs } from '../types/jira'

interface Options {
  selectedProject: JiraProject | null
  filter: 'all' | 'mine' | 'unassigned'
  searchQuery: string
  prefs: AppPrefs
}

export function useIssues({ selectedProject, filter, searchQuery, prefs }: Options) {
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const buildJql = useCallback(() => {
    const parts: string[] = []

    if (selectedProject) {
      parts.push(`project = "${selectedProject.key}"`)
    }

    if (filter === 'mine') {
      parts.push('assignee = currentUser()')
    } else if (filter === 'unassigned') {
      parts.push('assignee is EMPTY')
    }

    if (searchQuery.trim()) {
      parts.push(`(summary ~ "${searchQuery.trim()}" OR description ~ "${searchQuery.trim()}")`)
    }

    // Filtr dokončených tasků podle stáří
    if (prefs.doneMaxAgeDays === 0) {
      // Nezobrazovat hotové vůbec
      parts.push('statusCategory != Done')
    } else if (prefs.doneMaxAgeDays > 0) {
      // Zobrazit hotové jen pokud jsou novější než X dní
      parts.push(`(statusCategory != Done OR updated >= "-${prefs.doneMaxAgeDays}d")`)
    }
    // doneMaxAgeDays === -1 → zobrazit vše, žádný filtr

    const where = parts.length > 0 ? parts.join(' AND ') + ' ' : ''
    return `${where}ORDER BY updated DESC`
  }, [selectedProject, filter, searchQuery, prefs.doneMaxAgeDays])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const jql = buildJql()
      const result = await jiraApi.searchIssues(jql, prefs.maxResults)
      setIssues(result.issues)
      setTotal(result.total)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [buildJql, prefs.maxResults])

  useEffect(() => {
    const timer = setTimeout(load, searchQuery ? 400 : 0)
    return () => clearTimeout(timer)
  }, [load, searchQuery])

  return { issues, setIssues, loading, error, total, reload: load }
}
