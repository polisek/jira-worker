import { Plus } from 'lucide-react'
import { TimeTracking, OriginalEstimateField } from './TimeTracking'
import { DetailCard } from './DetailCard'
import type { JiraIssue } from '../../../types/jira'

interface Props {
    issue: JiraIssue
    onLogWork: () => void
    onRefetch: () => void
}

export function TimeSection({ issue, onLogWork, onRefetch }: Props) {
    return (
        <DetailCard
            title="Čas"
            action={
                <button
                    onClick={onLogWork}
                    className="btn-sm flex items-center gap-1 text-xs"
                >
                    <Plus className="w-3 h-3" />
                    Zaznamenat práci
                </button>
            }
            footer={<OriginalEstimateField issue={issue} onEdited={onRefetch} />}
        >
            <TimeTracking issue={issue} compact onOriginalEdited={onRefetch} />
        </DetailCard>
    )
}
