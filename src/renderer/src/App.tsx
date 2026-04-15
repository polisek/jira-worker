import { useState, useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { BoardView } from './components/BoardView'
import { ListView } from './components/ListView'
import { SettingsView } from './components/SettingsView'
import { TaskDetail } from './components/TaskDetail'
import type { JiraSettings, JiraIssue, JiraProject, ViewMode } from './types/jira'

export default function App() {
  const [settings, setSettings] = useState<JiraSettings | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [view, setView] = useState<ViewMode>('board')
  const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null)
  const [projects, setProjects] = useState<JiraProject[]>([])
  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned'>('mine')

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSettings(s)
      setSettingsLoaded(true)
    })
  }, [])

  const handleSaveSettings = async (s: JiraSettings) => {
    await window.api.setSettings(s)
    setSettings(s)
    setView('board')
  }

  if (!settingsLoaded) {
    return (
      <div className="app-bg flex items-center justify-center h-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="app-bg flex flex-col h-screen">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center">
          <SettingsView onSave={handleSaveSettings} initial={null} />
        </div>
      </div>
    )
  }

  return (
    <div className="app-bg flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          view={view}
          setView={setView}
          projects={projects}
          setProjects={setProjects}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          filter={filter}
          setFilter={setFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <main className="flex-1 overflow-hidden flex">
          {view === 'settings' ? (
            <div className="flex-1 flex items-center justify-center overflow-y-auto">
              <SettingsView onSave={handleSaveSettings} initial={settings} />
            </div>
          ) : view === 'board' ? (
            <BoardView
              selectedProject={selectedProject}
              filter={filter}
              searchQuery={searchQuery}
              onSelectIssue={setSelectedIssue}
            />
          ) : (
            <ListView
              selectedProject={selectedProject}
              filter={filter}
              searchQuery={searchQuery}
              onSelectIssue={setSelectedIssue}
            />
          )}

          {selectedIssue && (
            <TaskDetail
              issue={selectedIssue}
              onClose={() => setSelectedIssue(null)}
              onUpdate={(updated) => setSelectedIssue(updated)}
            />
          )}
        </main>
      </div>
    </div>
  )
}
