import type { ReactNode } from "react"

interface Props {
    title?: string
    action?: ReactNode
    footer?: ReactNode
    children: ReactNode
    className?: string
}

export function DetailCard({ title, action, footer, children, className = "" }: Props) {
    return (
        <div className={`detail-section-card ${className}`}>
            {title !== undefined && (
                <div className="detail-section-card-header">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
                    {action && <div className="flex items-center">{action}</div>}
                </div>
            )}
            <div className="detail-section-card-content">{children}</div>
            {footer !== undefined && <div className="detail-section-card-footer">{footer}</div>}
        </div>
    )
}
