import { Handle, Position } from "@xyflow/react"
import type { NodeProps } from "@xyflow/react"
import type { JiraIssue } from "../types/jira"
import { StatusBadge, PriorityBadge } from "./IssueBadges"

interface IssueNodeData {
    issue: JiraIssue
    isEpic: boolean
    onSelect: (issue: JiraIssue) => void
    [key: string]: unknown
}

const H = "!w-3 !h-3 !rounded-full !border-2"

export function IssueNode({ data }: NodeProps) {
    const { issue, isEpic, onSelect } = data as IssueNodeData
    const sp = issue.fields.customfield_10016
    const sprint = issue.fields.customfield_10020?.find(s => s.state === "active") ?? issue.fields.customfield_10020?.[0]
    const isSubtask = issue.fields.issuetype.subtask === true

    const ringClass = isEpic
        ? "ring-2 ring-purple-500/40"
        : isSubtask
        ? "ring-2 ring-teal-500/35"
        : "ring-2 ring-blue-500/30"

    const keyColor = isEpic ? "text-purple-400" : isSubtask ? "text-teal-400" : "text-blue-400"

    const card = (
        <div
            className={`issue-card w-52 cursor-pointer select-none transition-all hover:brightness-110 ${ringClass}`}
            onClick={() => onSelect(issue)}
        >
            <div className="flex items-center gap-2 mb-2">
                {isSubtask ? (
                    <div className="w-4 h-4 rounded p-px bg-teal-500/25 ring-1 ring-teal-500/40 shrink-0">
                        <img src={issue.fields.issuetype.iconUrl} alt={issue.fields.issuetype.name} className="w-full h-full" />
                    </div>
                ) : (
                    <img src={issue.fields.issuetype.iconUrl} alt={issue.fields.issuetype.name} className="w-4 h-4 shrink-0" />
                )}
                <span className={`${keyColor} font-mono text-[10px] font-medium`}>{issue.key}</span>
                <StatusBadge status={issue.fields.status} className="ml-auto !text-[9px] !px-1.5 !py-0.5 !rounded-full uppercase tracking-wide" />
            </div>

            <p className="text-xs font-medium leading-snug line-clamp-2 mb-2" style={{ color: "var(--c-text)" }}>
                {issue.fields.summary}
            </p>

            <div className="flex items-center gap-1.5">
                {sp != null && (
                    <span className="text-[9px] bg-purple-500/15 text-purple-600 border border-purple-500/30 px-1.5 py-0.5 rounded">
                        {sp} SP
                    </span>
                )}
                {issue.fields.priority && (
                    <PriorityBadge priority={issue.fields.priority} className="!text-[9px] !px-1.5 !py-0.5 !rounded" />
                )}
                <div className="flex items-center gap-1.5 ml-auto">
                    {sprint && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border max-w-[64px] truncate shrink-0 ${
                            sprint.state === "active"
                                ? "bg-green-500/15 text-green-500 border-green-500/30"
                                : "bg-gray-500/15 text-gray-400 border-gray-500/30"
                        }`} title={sprint.name}>
                            {sprint.name}
                        </span>
                    )}
                    {issue.fields.assignee && (
                        <div
                            className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 text-[8px] font-bold flex items-center justify-center shrink-0"
                            title={issue.fields.assignee.displayName}
                        >
                            {issue.fields.assignee.displayName.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    if (isEpic) {
        return (
            <>
                <Handle type="target" position={Position.Top}    id="top"    className={`${H} !bg-purple-500 !border-purple-400`} title="Přidat úkol" />
                <Handle type="target" position={Position.Left}   id="left"   className={`${H} !bg-purple-500 !border-purple-400`} title="Přidat úkol" />
                <Handle type="source" position={Position.Right}  id="right"  className={`${H} !bg-purple-500 !border-purple-400`} title="Přidat úkol" />
                <Handle type="source" position={Position.Bottom} id="bottom" className={`${H} !bg-purple-500 !border-purple-400`} title="Přidat úkol" />
                {/* Ghost handles for RTL programmatic edges */}
                <Handle type="source" position={Position.Left}  id="left-src"  connectable={false} style={{ opacity: 0, width: 1, height: 1 }} />
                <Handle type="target" position={Position.Right} id="right-tgt" connectable={false} style={{ opacity: 0, width: 1, height: 1 }} />
                {card}
            </>
        )
    }

    return (
        <>
            {/* Top/Bottom — parent-child (purple) */}
            <Handle type="target" position={Position.Top} id="top" className={`${H} !bg-purple-500 !border-purple-400`} />
            {!isSubtask && (
                <Handle type="source" position={Position.Bottom} id="bottom" className={`${H} !bg-purple-500 !border-purple-400`} />
            )}

            {/* Left — target handles (visible) + source ghosts for RTL routing */}
            <Handle type="target" position={Position.Left} id="left-relates" style={{ top: "33%" }}
                className={`${H} !bg-blue-500 !border-blue-400`} title="Přijmout vazbu Souvisí" />
            <Handle type="target" position={Position.Left} id="left-blocks"  style={{ top: "67%" }}
                className={`${H} !bg-red-500 !border-red-400`}  title="Přijmout vazbu Blokuje" />
            <Handle type="source" position={Position.Left} id="left-relates-src" style={{ top: "33%" }} connectable={false} className="!opacity-0 !w-px !h-px" />
            <Handle type="source" position={Position.Left} id="left-blocks-src"  style={{ top: "67%" }} connectable={false} className="!opacity-0 !w-px !h-px" />

            {/* Right — source handles (visible) + target ghosts for RTL routing */}
            <Handle type="source" position={Position.Right} id="right-relates" style={{ top: "33%" }}
                className={`${H} !bg-blue-500 !border-blue-400`} title="Táhni: Souvisí" />
            <Handle type="source" position={Position.Right} id="right-blocks"  style={{ top: "67%" }}
                className={`${H} !bg-red-500 !border-red-400`}  title="Táhni: Blokuje" />
            <Handle type="target" position={Position.Right} id="right-relates-tgt" style={{ top: "33%" }} connectable={false} className="!opacity-0 !w-px !h-px" />
            <Handle type="target" position={Position.Right} id="right-blocks-tgt"  style={{ top: "67%" }} connectable={false} className="!opacity-0 !w-px !h-px" />

            {card}
        </>
    )
}
