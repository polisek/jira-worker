import { ChevronDown } from 'lucide-react'
import type { BoardViewSprintProps } from '../hooks/useBoardView'

interface Props {
    sprintProps: BoardViewSprintProps
}

export function SprintSelector({ sprintProps }: Props) {
    const { selectedSprint, setSelectedSprint, sprintOpen, setSprintOpen, sprintLabel, sprints } = sprintProps

    return (
        <div className="relative">
            <button
                onClick={() => setSprintOpen(!sprintOpen)}
                className="flex items-center gap-1.5 text-sm text-gray-300 bg-gray-800/60 border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-lg transition-colors"
            >
                <span className="max-w-40 truncate">{sprintLabel}</span>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-500 transition-transform ${sprintOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {sprintOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                    {[
                        { value: 'active', label: 'Aktivní sprint', sub: 'JQL: sprint in openSprints()' },
                        { value: 'all', label: 'Všechny sprinty', sub: 'Bez filtru sprintu' },
                        { value: 'none', label: 'Bez sprintu', sub: 'Tasky mimo sprint' },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                setSelectedSprint(opt.value)
                                setSprintOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                                selectedSprint === opt.value ? 'text-blue-300 bg-blue-500/10' : 'text-gray-300'
                            }`}
                        >
                            <div>{opt.label}</div>
                            <div className="text-xs text-gray-600">{opt.sub}</div>
                        </button>
                    ))}

                    {sprints.length > 0 && (
                        <>
                            <div className="border-t border-gray-800 my-1" />
                            <p className="px-3 py-1 text-xs text-gray-600 uppercase tracking-wider">
                                Konkrétní sprint
                            </p>
                            {sprints.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => {
                                        setSelectedSprint(String(s.id))
                                        setSprintOpen(false)
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
                                        selectedSprint === String(s.id)
                                            ? 'text-blue-300 bg-blue-500/10'
                                            : 'text-gray-300'
                                    }`}
                                >
                                    <div className="truncate">{s.name}</div>
                                    <div
                                        className={`text-xs mt-0.5 ${
                                            s.state === 'active'
                                                ? 'text-green-500'
                                                : s.state === 'future'
                                                  ? 'text-blue-400'
                                                  : 'text-gray-600'
                                        }`}
                                    >
                                        {s.state === 'active'
                                            ? 'Aktivní'
                                            : s.state === 'future'
                                              ? 'Nadcházející'
                                              : 'Uzavřený'}
                                    </div>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
