import { useCallback, useEffect, useState } from "react"
import {
    Kanban,
    List,
    Settings,
    RefreshCw,
    Search,
    User,
    Users,
    Inbox,
    Timer,
    CalendarDays,
    Activity,
    Star,
    Check,
    GitBranch,
    Network,
    Map,
} from "lucide-react"
import { jiraApi } from "../utils/jira-api"
import { RecentAssignments } from "./RecentAssignments"
import type { NotificationState } from "../hooks/useNotifications"
import type { JiraIssue, JiraProject, ViewMode } from "../types/jira"

interface Props {
    view: ViewMode
    setView: (v: ViewMode) => void
    projects: JiraProject[]
    setProjects: (p: JiraProject[]) => void
    selectedProject: JiraProject | null
    setSelectedProject: (p: JiraProject | null) => void
    filter: "all" | "mine" | "unassigned"
    setFilter: (f: "all" | "mine" | "unassigned") => void
    searchQuery: string
    setSearchQuery: (q: string) => void
    notifications: NotificationState
    onSelectIssue: (issue: JiraIssue) => void
    hiddenProjectKeys: string[]
    onSaveHiddenProjects: (keys: string[]) => void
}

export function Sidebar({
    view,
    setView,
    projects,
    setProjects,
    selectedProject,
    setSelectedProject,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    notifications,
    onSelectIssue,
    hiddenProjectKeys,
    onSaveHiddenProjects,
}: Props) {
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [projectsError, setProjectsError] = useState<string | null>(null)
    const [notifCollapsed, setNotifCollapsed] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [localHidden, setLocalHidden] = useState<Set<string>>(new Set())

    const loadProjects = useCallback(async () => {
        setProjectsLoading(true)
        setProjectsError(null)
        try {
            const data = await jiraApi.getProjects()
            setProjects(data)
        } catch (e) {
            setProjectsError((e as Error).message)
        } finally {
            setProjectsLoading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        loadProjects()
    }, [])

    const handleToggleEditMode = () => {
        if (editMode) {
            onSaveHiddenProjects([...localHidden])
            setEditMode(false)
        } else {
            setLocalHidden(new Set(hiddenProjectKeys))
            setEditMode(true)
        }
    }

    const toggleProjectHidden = (key: string) => {
        setLocalHidden((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const visibleProjects = projects.filter((p) => !hiddenProjectKeys.includes(p.key))

    return (
        <aside className="sidebar w-64 flex flex-col gap-2 p-3 overflow-y-auto shrink-0">
            {/* Search */}
            <div className="relative mb-1">
                <Search
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "var(--c-text-4)" }}
                />
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
                <button onClick={() => setView("board")} className={`sidebar-item ${view === "board" ? "active" : ""}`}>
                    <Kanban className="w-4 h-4" /> Board
                </button>
                <button onClick={() => setView("list")} className={`sidebar-item ${view === "list" ? "active" : ""}`}>
                    <List className="w-4 h-4" /> Seznam
                </button>
                <button onClick={() => setView("tree")} className={`sidebar-item ${view === "tree" ? "active" : ""}`}>
                    <GitBranch className="w-4 h-4" /> Strom
                </button>
                <button onClick={() => setView("graph")} className={`sidebar-item ${view === "graph" ? "active" : ""}`}>
                    <Network className="w-4 h-4" /> Graf
                </button>
                <button onClick={() => setView("roadmap")} className={`sidebar-item ${view === "roadmap" ? "active" : ""}`}>
                    <Map className="w-4 h-4" /> Roadmap
                </button>
                <button onClick={() => setView("time")} className={`sidebar-item ${view === "time" ? "active" : ""}`}>
                    <Timer className="w-4 h-4" /> Měření času
                </button>
                <button
                    onClick={() => setView("worklog")}
                    className={`sidebar-item ${view === "worklog" ? "active" : ""}`}
                >
                    <CalendarDays className="w-4 h-4" /> Worklog
                </button>
                <button
                    onClick={() => setView("activity")}
                    className={`sidebar-item ${view === "activity" ? "active" : ""}`}
                >
                    <Activity className="w-4 h-4" /> Aktivita
                </button>

                <button
                    onClick={() => setView("settings")}
                    className={`sidebar-item ${view === "settings" ? "active" : ""}`}
                >
                    <Settings className="w-4 h-4" /> Nastavení
                </button>
            </div>

            {/* Notifications */}
            <div className="border-t border-gray-800/60 pt-2">
                <RecentAssignments
                    state={notifications}
                    onSelectIssue={onSelectIssue}
                    collapsed={notifCollapsed}
                    onToggle={() => setNotifCollapsed((v) => !v)}
                />
            </div>

            {/* Filters */}
            <div className="border-t border-gray-800/60 pt-2">
                <p className="sidebar-label">Filtr</p>
                <button
                    onClick={() => setFilter("mine")}
                    className={`sidebar-item ${filter === "mine" ? "active" : ""}`}
                >
                    <User className="w-4 h-4" /> Moje tasky
                </button>
                <button onClick={() => setFilter("all")} className={`sidebar-item ${filter === "all" ? "active" : ""}`}>
                    <Users className="w-4 h-4" /> Všechny tasky
                </button>
                <button
                    onClick={() => setFilter("unassigned")}
                    className={`sidebar-item ${filter === "unassigned" ? "active" : ""}`}
                >
                    <Inbox className="w-4 h-4" /> Nepřiřazené
                </button>
            </div>

            {/* Projects */}
            <div className="flex-1 border-t border-gray-800/60 pt-2">
                <div className="flex items-center justify-between mb-1">
                    <p className="sidebar-label">Projekty</p>
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={handleToggleEditMode}
                            className="p-0.5 rounded transition-colors"
                            style={{ color: editMode ? "#60a5fa" : "var(--c-text-4)" }}
                            title={editMode ? "Uložit výběr" : "Oblíbené projekty"}
                        >
                            {editMode ? <Check className="w-3.5 h-3.5" /> : <Star className="w-3 h-3" />}
                        </button>
                        <button
                            onClick={loadProjects}
                            className="p-0.5 rounded transition-colors"
                            style={{ color: "var(--c-text-4)" }}
                            title="Obnovit projekty"
                            disabled={editMode}
                        >
                            <RefreshCw className={`w-3 h-3 ${projectsLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {projectsError && (
                    <p
                        className="text-red-400 text-xs px-2 py-1 cursor-pointer"
                        onClick={() => navigator.clipboard.writeText(projectsError)}
                        title="Klikni pro zkopírování"
                    >
                        {projectsError}
                    </p>
                )}

                {!editMode && (
                    <button
                        onClick={() => setSelectedProject(null)}
                        className={`sidebar-item ${!selectedProject ? "active" : ""}`}
                    >
                        <span className="w-5 h-5 rounded text-xs flex items-center justify-center bg-gray-600 font-bold shrink-0">
                            *
                        </span>
                        Všechny projekty
                    </button>
                )}

                {editMode ? (
                    <>
                        <p className="text-xs px-2 pb-1.5" style={{ color: "var(--c-text-4)" }}>
                            Zrušte zaškrtnutí pro skrytí projektu
                        </p>
                        {projects.map((p) => {
                            const checked = !localHidden.has(p.key)
                            return (
                                <button key={p.id} onClick={() => toggleProjectHidden(p.key)} className="sidebar-item">
                                    <img src={p.avatarUrls["48x48"]} alt="" className="w-5 h-5 rounded shrink-0" />
                                    <span className="truncate flex-1 text-left">{p.name}</span>
                                    <span
                                        className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                                        style={{
                                            background: checked ? "#3b82f6" : "transparent",
                                            borderColor: checked ? "#3b82f6" : "var(--c-border)",
                                        }}
                                    >
                                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                    </span>
                                </button>
                            )
                        })}
                    </>
                ) : (
                    visibleProjects.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedProject(p)}
                            className={`sidebar-item ${selectedProject?.id === p.id ? "active" : ""}`}
                        >
                            <img src={p.avatarUrls["48x48"]} alt="" className="w-5 h-5 rounded shrink-0" />
                            <span className="truncate">{p.name}</span>
                        </button>
                    ))
                )}
            </div>
        </aside>
    )
}
