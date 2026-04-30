import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCreateSprintMutation } from '../../../api/sprints/create-sprint'

interface Props {
    boardId: number
    onClose: () => void
    onCreated: () => void
}

export function CreateSprintModal({ boardId, onClose, onCreated }: Props) {
    const [name, setName] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [error, setError] = useState<string | null>(null)

    const mutation = useCreateSprintMutation()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        setError(null)
        try {
            await mutation.mutateAsync({
                boardId,
                name: name.trim(),
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            })
            onCreated()
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se vytvořit sprint')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative modal-panel rounded-xl shadow-2xl w-full max-w-sm p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-base" style={{ color: 'var(--c-text)' }}>
                        Nový sprint
                    </h2>
                    <button onClick={onClose} className="btn-icon">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--c-text-4)' }}>
                            Název sprintu <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            className="input w-full"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="např. Sprint 42"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--c-text-4)' }}>
                                Datum od
                            </label>
                            <input
                                type="date"
                                className="input w-full"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--c-text-4)' }}>
                                Datum do
                            </label>
                            <input
                                type="date"
                                className="input w-full"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-xs text-red-400">{error}</p>
                    )}

                    <div className="flex gap-2 justify-end pt-1">
                        <button type="button" onClick={onClose} className="btn-secondary">
                            Zrušit
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex items-center gap-1.5"
                            disabled={!name.trim() || mutation.isPending}
                        >
                            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Vytvořit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
