import { useState } from "react"
import { RefreshCw, AlertCircle, Plus, SlidersHorizontal } from "lucide-react"
import { ErrorMessage } from "./shared/ErrorMessage"
import { StatusBadge, PriorityDot } from "./IssueBadges"
import { useIssues } from "../hooks/useIssues"
import { formatDateShort } from "../utils/adf"
import { CreateIssueModal } from "./CreateIssueModal"
import { FilterModal } from "./FilterModal"
import type { JiraIssue, JiraProject, AppPrefs, AdvancedFilter } from "../types/jira"
import { DEFAULT_ADVANCED_FILTER } from "../types/jira"

interface Props {
    selectedProject: JiraProject | null
    projects: JiraProject[]
    filter: "all" | "mine" | "unassigned"
    searchQuery: string
    onSelectIssue: (issue: JiraIssue) => void
    prefs: AppPrefs
}


export function ListView({ selectedProject, projects, filter, searchQuery, onSelectIssue, prefs }: Props) {
    const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter | undefined>(undefined)
    const [showFilter, setShowFilter] = useState(false)
    const { issues, loading, error, total, reload } = useIssues({
        selectedProject,
        filter: advancedFilter ? "all" : filter,
        searchQuery,
        prefs,
        advancedFilter,
    })
    const [showCreate, setShowCreate] = useState(false)

    const isFilterActive =
        advancedFilter &&
        (!!advancedFilter.summary || !!advancedFilter.assignee || !!advancedFilter.reporter || !!advancedFilter.status)

    return (
        <div className="flex-1 flex flex-col overflow-hidden" id="list-view">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="flex items-center gap-2" id="left-toolbar">
                    <h1 className="font-semibold text-gray-100">
                        {selectedProject ? selectedProject.name : "Všechny projekty"}
                    </h1>
                    {!loading && <span className="text-xs text-gray-500">{total} tasků celkem</span>}
                </div>
                <div className="flex items-center justify-between gap-4" id="right-toolbar">
                    <button onClick={reload} className="btn-icon" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setShowFilter(true)}
                        className={`btn-icon relative ${isFilterActive ? "text-blue-400" : ""}`}
                        title="Filtr"
                    >
                        <SlidersHorizontal className="w-4 h-4" />
                        {isFilterActive && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-400 rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5"
                    >
                        <Plus className="w-4 h-4" /> Nový task
                    </button>
                </div>
            </div>

            {showFilter && (
                <FilterModal
                    selectedProject={selectedProject}
                    initialValues={advancedFilter ?? DEFAULT_ADVANCED_FILTER}
                    onApply={setAdvancedFilter}
                    onClose={() => setShowFilter(false)}
                />
            )}

            {showCreate && (
                <CreateIssueModal
                    projects={projects}
                    defaultProject={selectedProject}
                    onClose={() => setShowCreate(false)}
                    onCreated={(issue) => {
                        setShowCreate(false)
                        onSelectIssue(issue)
                        reload()
                    }}
                />
            )}

            {error && <ErrorMessage message={error} />}

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 table-head">
                        <tr>
                            <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-28">Klíč</th>
                            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Název</th>
                            <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-36">Status</th>
                            <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-28">Priorita</th>
                            <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-36">Přiřazeno</th>
                            <th className="text-left px-4 py-2.5 text-gray-500 font-medium w-28">Termín</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                    Načítám...
                                </td>
                            </tr>
                        )}
                        {!loading && issues.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                    Žádné tasky
                                </td>
                            </tr>
                        )}
                        {issues.map((issue, i) => (
                            <tr
                                key={issue.id}
                                onClick={() => onSelectIssue(issue)}
                                className={`cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-800/20"}`}
                            >
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <img src={issue.fields.issuetype.iconUrl} alt="" className="w-4 h-4" />
                                        <span className="font-mono text-xs text-gray-400">{issue.key}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className="text-gray-200 line-clamp-1">{issue.fields.summary}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                    <StatusBadge status={issue.fields.status} />
                                </td>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <PriorityDot priority={issue.fields.priority} />
                                        <span className="text-gray-400 text-xs">{issue.fields.priority?.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2.5">
                                    {issue.fields.assignee ? (
                                        <div className="flex items-center gap-1.5">
                                            <img
                                                src={issue.fields.assignee.avatarUrls["48x48"]}
                                                alt=""
                                                className="w-5 h-5 rounded-full"
                                            />
                                            <span className="text-gray-400 text-xs truncate max-w-24">
                                                {issue.fields.assignee.displayName}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-600 text-xs">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5">
                                    {issue.fields.duedate ? (
                                        <span className="text-gray-400 text-xs">
                                            {formatDateShort(issue.fields.duedate)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-600 text-xs">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
