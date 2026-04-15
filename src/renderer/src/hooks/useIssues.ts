import { useState, useEffect, useCallback } from 'react'
import { jiraApi } from '../lib/jira-api'
import type { JiraIssue, JiraProject } from '../types/jira'

interface Options {
  selectedProject: JiraProject | null
  filter: 'all' | 'mine' | 'unassigned'
  searchQuery: string
}

export function useIssues({ selectedProject, filter, searchQuery }: Options) {
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

    const where = parts.length > 0 ? parts.join(' AND ') + ' ' : ''
    return `${where}ORDER BY updated DESC`
  }, [selectedProject, filter, searchQuery])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const jql = buildJql()
      const result = await jiraApi.searchIssues(jql, 100)
      setIssues(result.issues)
      setTotal(result.total)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [buildJql])

  useEffect(() => {
    const timer = setTimeout(load, searchQuery ? 400 : 0)
    return () => clearTimeout(timer)
  }, [load, searchQuery])

  return { issues, loading, error, total, reload: load }
}
