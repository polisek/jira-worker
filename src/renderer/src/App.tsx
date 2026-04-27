import { useState, useEffect, useRef } from "react"
import { TitleBar } from "./components/TitleBar"
import { Sidebar } from "./components/Sidebar"
import BoardView from "./components/board-view"
import { ListView } from "./components/ListView"
import { SettingsView } from "./components/SettingsView"
import { TaskDetail } from "./components/task-detail"
import { setAdfJiraBaseUrl } from "./utils/adf"
import { useNotifications } from "./hooks/useNotifications"
import { UpdateBanner } from "./components/UpdateBanner"
import { TimeTrackingView } from "./components/TimeTrackingView"
import { WorkLogView } from "./components/work-log-view"
import { ActivityView } from "./components/ActivityView"
import { TreeView } from "./components/TreeView"
import { GraphView } from "./components/graph-view"
import type { JiraSettings, JiraIssue, JiraProject, ViewMode, AppPrefs } from "./types/jira"
import { DEFAULT_PREFS as DEFAULTS } from "./types/jira"

export default function App() {
    const [settings, setSettings] = useState<JiraSettings | null>(null)
    const [settingsLoaded, setSettingsLoaded] = useState(false)
    const [prefs, setPrefs] = useState<AppPrefs>(DEFAULTS)
    const [view, setView] = useState<ViewMode>("board")
    const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null)
    const [projects, setProjects] = useState<JiraProject[]>([])
    const pendingProjectKey = useRef<string | null>(null)
    const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
    const [graphEpicKey, setGraphEpicKey] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "mine" | "unassigned">(DEFAULTS.defaultFilter)

    const notifications = useNotifications(prefs)

    useEffect(() => {
        Promise.all([window.api.getSettings(), window.api.getPrefs()]).then(([s, p]) => {
            setSettings(s)
            if (s?.baseUrl) setAdfJiraBaseUrl(s.baseUrl)
            const loadedPrefs = p as AppPrefs
            setPrefs(loadedPrefs)
            setFilter(loadedPrefs.defaultFilter)
            setView(loadedPrefs.defaultView as ViewMode)
            pendingProjectKey.current = loadedPrefs.selectedProjectKey ?? null
            setSettingsLoaded(true)
        })
    }, [])

    const handleSetProjects = (p: JiraProject[]) => {
        setProjects(p)
        if (pendingProjectKey.current) {
            const found = p.find((proj) => proj.key === pendingProjectKey.current) ?? null
            setSelectedProject(found)
            pendingProjectKey.current = null
        }
    }

    const handleSetSelectedProject = (p: JiraProject | null) => {
        setSelectedProject(p)
        window.api.setPrefs({ ...prefs, selectedProjectKey: p?.key ?? null })
    }

    const handleSaveJira = async (s: JiraSettings) => {
        await window.api.setSettings(s)
        setSettings(s)
        setAdfJiraBaseUrl(s.baseUrl)
    }

    const handleSavePrefs = (p: AppPrefs) => {
        setPrefs(p)
    }

    const handlePrefsChange = (partial: Partial<AppPrefs>) => {
        const updated = { ...prefs, ...partial }
        setPrefs(updated)
        window.api.setPrefs(updated)
    }

    const handleSaveHiddenProjects = (keys: string[]) => {
        const updated = { ...prefs, hiddenProjectKeys: keys }
        setPrefs(updated)
        window.api.setPrefs(updated)
        if (selectedProject && keys.includes(selectedProject.key)) {
            setSelectedProject(null)
        }
    }

    const applyTheme = (theme: AppPrefs["theme"]) => {
        const root = document.documentElement
        if (theme === "light") {
            root.classList.add("light")
        } else if (theme === "dark") {
            root.classList.remove("light")
        } else {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
            root.classList.toggle("light", !prefersDark)
        }
    }

    useEffect(() => {
        applyTheme(prefs.theme ?? "dark")

        if ((prefs.theme ?? "dark") === "auto") {
            const mq = window.matchMedia("(prefers-color-scheme: dark)")
            const handler = (e: MediaQueryListEvent) => document.documentElement.classList.toggle("light", !e.matches)
            mq.addEventListener("change", handler)
            return () => mq.removeEventListener("change", handler)
        }
        return undefined
    }, [prefs.theme])

    if (!settingsLoaded) {
        return (
            <div className="app-bg flex items-center justify-center h-screen">
                <div className="spinner" />
            </div>
        )
    }

    // První spuštění — nutná konfigurace Jiry
    if (!settings) {
        return (
            <div className="app-bg flex flex-col h-screen">
                <TitleBar />
                <div className="flex-1 flex items-center justify-center overflow-y-auto py-8">
                    <SettingsView
                        onSaveJira={(s) => {
                            handleSaveJira(s)
                            setSettings(s)
                        }}
                        onSavePrefs={handleSavePrefs}
                        initialJira={null}
                        prefs={prefs}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="app-bg flex flex-col h-screen overflow-hidden">
            <TitleBar />
            <UpdateBanner />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar
                    view={view}
                    setView={setView}
                    projects={projects}
                    setProjects={handleSetProjects}
                    selectedProject={selectedProject}
                    setSelectedProject={handleSetSelectedProject}
                    filter={filter}
                    setFilter={setFilter}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    notifications={notifications}
                    onSelectIssue={setSelectedIssue}
                    hiddenProjectKeys={prefs.hiddenProjectKeys ?? []}
                    onSaveHiddenProjects={handleSaveHiddenProjects}
                />

                <main className="flex-1 overflow-hidden flex">
                    {view === "time" ? (
                        <TimeTrackingView />
                    ) : view === "activity" ? (
                        <ActivityView
                            prefs={prefs}
                            selectedProject={selectedProject}
                            onSelectIssue={setSelectedIssue}
                        />
                    ) : view === "worklog" ? (
                        <WorkLogView prefs={prefs} selectedProject={selectedProject} />
                    ) : view === "settings" ? (
                        <div className="flex-1 overflow-y-auto flex justify-center px-6 py-2">
                            <SettingsView
                                onSaveJira={handleSaveJira}
                                onSavePrefs={handleSavePrefs}
                                initialJira={settings}
                                prefs={prefs}
                            />
                        </div>
                    ) : view === "board" ? (
                        <BoardView
                            selectedProject={selectedProject}
                            projects={projects}
                            filter={filter}
                            searchQuery={searchQuery}
                            onSelectIssue={setSelectedIssue}
                            prefs={prefs}
                        />
                    ) : view === "tree" ? (
                        <TreeView
                            selectedProject={selectedProject}
                            projects={projects}
                            searchQuery={searchQuery}
                            onSelectIssue={setSelectedIssue}
                            prefs={prefs}
                        />
                    ) : view === "graph" ? (
                        <GraphView
                            selectedProject={selectedProject}
                            prefs={prefs}
                            onPrefsChange={handlePrefsChange}
                            onIssueSelect={setSelectedIssue}
                            initialEpicKey={graphEpicKey}
                        />
                    ) : (
                        <ListView
                            selectedProject={selectedProject}
                            projects={projects}
                            filter={filter}
                            searchQuery={searchQuery}
                            onSelectIssue={setSelectedIssue}
                            prefs={prefs}
                        />
                    )}

                    {selectedIssue && (
                        <TaskDetail
                            issueKey={selectedIssue.key}
                            prefs={prefs}
                            baseUrl={settings?.baseUrl}
                            onClose={() => setSelectedIssue(null)}
                            onOpenGraph={(epicKey) => {
                                setGraphEpicKey(epicKey)
                                setView("graph")
                            }}
                        />
                    )}
                </main>
            </div>
        </div>
    )
}
