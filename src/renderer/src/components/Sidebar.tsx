import { useEffect, useState } from 'react'
import { Kanban, List, Settings, RefreshCw, Search, User, Users, Inbox } from 'lucide-react'
import { jiraApi } from '../lib/jira-api'
import type { JiraProject, ViewMode } from '../types/jira'

interface Props {
  view: ViewMode
  setView: (v: ViewMode) => void
  projects: JiraProject[]
  setProjects: (p: JiraProject[]) => void
  selectedProject: JiraProject | null
  setSelectedProject: (p: JiraProject | null) => void
  filter: 'all' | 'mine' | 'unassigned'
  setFilter: (f: 'all' | 'mine' | 'unassigned') => void
  searchQuery: string
  setSearchQuery: (q: string) => void
}

export function Sidebar({
  view, setView, projects, setProjects,
  selectedProject, setSelectedProject,
  filter, setFilter,
  searchQuery, setSearchQuery
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await jiraApi.getProjects()
      setProjects(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjects() }, [])

  return (
    <aside className="sidebar w-64 flex flex-col gap-2 p-3 overflow-y-auto shrink-0">
      {/* Search */}
      <div className="relative mb-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input
          type="text"
          placeholder="Hledat tasky..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full pl-8 py-1.5 text-sm"
        />
      </div>

      {/* Views */}
      <div>
        <p className="sidebar-label">Zobrazení</p>
        <button
          onClick={() => setView('board')}
          className={`sidebar-item ${view === 'board' ? 'active' : ''}`}
        >
          <Kanban className="w-4 h-4" /> Board
        </button>
        <button
          onClick={() => setView('list')}
          className={`sidebar-item ${view === 'list' ? 'active' : ''}`}
        >
          <List className="w-4 h-4" /> Seznam
        </button>
      </div>

      {/* Filters */}
      <div>
        <p className="sidebar-label">Filtr</p>
        <button
          onClick={() => setFilter('mine')}
          className={`sidebar-item ${filter === 'mine' ? 'active' : ''}`}
        >
          <User className="w-4 h-4" /> Moje tasky
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`sidebar-item ${filter === 'all' ? 'active' : ''}`}
        >
          <Users className="w-4 h-4" /> Všechny tasky
        </button>
        <button
          onClick={() => setFilter('unassigned')}
          className={`sidebar-item ${filter === 'unassigned' ? 'active' : ''}`}
        >
          <Inbox className="w-4 h-4" /> Nepřiřazené
        </button>
      </div>

      {/* Projects */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className="sidebar-label">Projekty</p>
          <button onClick={loadProjects} className="text-gray-500 hover:text-gray-300 p-0.5 rounded">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <p className="text-red-400 text-xs px-2 py-1">{error}</p>}

        <button
          onClick={() => setSelectedProject(null)}
          className={`sidebar-item ${!selectedProject ? 'active' : ''}`}
        >
          <span className="w-5 h-5 rounded text-xs flex items-center justify-center bg-gray-600 font-bold shrink-0">*</span>
          Všechny projekty
        </button>

        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProject(p)}
            className={`sidebar-item ${selectedProject?.id === p.id ? 'active' : ''}`}
          >
            <img src={p.avatarUrls['48x48']} alt="" className="w-5 h-5 rounded shrink-0" />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-800 pt-2">
        <button
          onClick={() => setView('settings')}
          className={`sidebar-item ${view === 'settings' ? 'active' : ''}`}
        >
          <Settings className="w-4 h-4" /> Nastavení
        </button>
      </div>
    </aside>
  )
}
