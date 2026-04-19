import type { JiraStatus, JiraPriority } from "../types/jira"

// ── Helper functions ────────────────────────────────────────────────

export function statusBadgeClass(categoryKey: string): string {
    return categoryKey === "done" ? "badge-green" : categoryKey === "indeterminate" ? "badge-blue" : "badge-gray"
}

export function priorityBadgeClass(priorityName?: string): string {
    if (!priorityName) return "badge-gray"
    if (priorityName === "Highest" || priorityName === "High") return "badge-priority-high"
    if (priorityName === "Low" || priorityName === "Lowest") return "badge-priority-low"
    return "badge-priority-medium"
}

export function priorityDotClass(priorityName?: string): string {
    if (!priorityName) return "bg-gray-400"
    if (priorityName === "Highest" || priorityName === "High") return "bg-red-500"
    if (priorityName === "Medium") return "bg-amber-500"
    if (priorityName === "Low") return "bg-blue-500"
    return "bg-gray-400"
}

export function statusDotClass(categoryKey: string): string {
    return categoryKey === "done" ? "bg-green-500" : categoryKey === "indeterminate" ? "bg-blue-500" : "bg-gray-400"
}

// ── Components ──────────────────────────────────────────────────────

interface StatusBadgeProps {
    status: JiraStatus
    className?: string
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
    return (
        <span className={`badge ${statusBadgeClass(status.statusCategory.key)} ${className}`}>
            {status.name}
        </span>
    )
}

interface PriorityBadgeProps {
    priority: JiraPriority
    className?: string
}

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
    return (
        <span className={`badge ${priorityBadgeClass(priority.name)} ${className}`}>
            {priority.name}
        </span>
    )
}

interface PriorityDotProps {
    priority?: JiraPriority
    className?: string
    title?: string
}

export function PriorityDot({ priority, className = "", title }: PriorityDotProps) {
    return (
        <span
            className={`w-2 h-2 rounded-full shrink-0 ${priorityDotClass(priority?.name)} ${className}`}
            title={title ?? priority?.name}
        />
    )
}
