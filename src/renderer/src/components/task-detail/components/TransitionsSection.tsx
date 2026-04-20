import { RefreshCw, Settings2 } from 'lucide-react'
import { useDoTransitionMutation } from '../../../api/transitions/do-transition'
import { DetailCard } from './DetailCard'
import type { JiraIssue, JiraTransition } from '../../../types/jira'

interface Props {
    issue: JiraIssue
    transitions: JiraTransition[]
    onManageStatuses: () => void
}

function transitionBtnClass(categoryKey: string): string {
    if (categoryKey === 'done') return 'transition-btn transition-btn-done'
    if (categoryKey === 'indeterminate') return 'transition-btn transition-btn-progress'
    return 'transition-btn transition-btn-todo'
}

function statusDot(categoryKey: string): string {
    if (categoryKey === 'done') return 'bg-green-400'
    if (categoryKey === 'indeterminate') return 'bg-blue-400'
    return 'bg-gray-400'
}

export function TransitionsSection({ issue, transitions, onManageStatuses }: Props) {
    const mutation = useDoTransitionMutation(issue.key)

    if (transitions.length === 0) return null

    return (
        <DetailCard
            title="Přesunout do stavu"
            action={
                <button className="btn-icon" onClick={onManageStatuses} title="Spravovat stavy">
                    <Settings2 className="w-3.5 h-3.5" />
                </button>
            }
        >
            <div className="flex flex-wrap gap-2">
                {transitions.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => mutation.mutate(t.id)}
                        disabled={mutation.isPending}
                        className={transitionBtnClass(t.to.statusCategory.key)}
                        title={`Přejít do stavu „${t.to.name}"`}
                    >
                        {mutation.isPending ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(t.to.statusCategory.key)}`} />
                        )}
                        {t.to.name}
                    </button>
                ))}
            </div>
        </DetailCard>
    )
}
