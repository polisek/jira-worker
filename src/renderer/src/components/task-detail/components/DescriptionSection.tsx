import { useState, useRef, useEffect } from 'react'
import { Save, RefreshCw, Pencil, Maximize2, X } from 'lucide-react'
import { useUpdateIssueMutation } from '../../../api/issues/update-issue'
import { AdfContent } from '../../AdfContent'
import { RichTextEditor, type RichTextEditorRef } from '../../RichTextEditor'
import { DetailCard } from './DetailCard'
import type { JiraIssue } from '../../../types/jira'

interface Props {
    issue: JiraIssue
}

export function DescriptionSection({ issue }: Props) {
    const [editing, setEditing] = useState(false)
    const [fullscreenOpen, setFullscreenOpen] = useState(false)
    const editorRef = useRef<RichTextEditorRef>(null)
    const fullscreenEditorRef = useRef<RichTextEditorRef>(null)
    const mutation = useUpdateIssueMutation(issue.key)

    // Exit edit mode when navigating to a different issue
    useEffect(() => {
        setEditing(false)
        setFullscreenOpen(false)
    }, [issue.key])

    const handleSave = async () => {
        if (!editorRef.current) return
        const adf = editorRef.current.getAdf()
        await mutation.mutateAsync({ description: adf })
        setEditing(false)
    }

    const handleFullscreenSave = async () => {
        if (!fullscreenEditorRef.current) return
        const adf = fullscreenEditorRef.current.getAdf()
        await mutation.mutateAsync({ description: adf })
        setFullscreenOpen(false)
    }

    return (
        <>
        <DetailCard
            title="Popis"
            action={
                !editing ? (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setFullscreenOpen(true)}
                            className="btn-icon"
                            title="Otevřít popis ve fullscreen editoru"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setEditing(true)}
                            className="btn-icon"
                            title="Upravit popis"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : null
            }
        >
            {editing ? (
                <>
                    <RichTextEditor
                        ref={editorRef}
                        initialContent={issue.fields.description as any}
                        minHeight={180}
                        autoFocus
                    />
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleSave}
                            disabled={mutation.isPending}
                            className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                        >
                            {mutation.isPending ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            Uložit
                        </button>
                        <button
                            onClick={() => setEditing(false)}
                            disabled={mutation.isPending}
                            className="btn-sm"
                        >
                            Zrušit
                        </button>
                    </div>
                </>
            ) : (
                <div
                    className="text-sm text-gray-300 leading-relaxed cursor-text min-h-[2rem]"
                    onDoubleClick={() => setEditing(true)}
                    title="Dvojklik pro úpravu"
                >
                    {issue.fields.description ? (
                        <AdfContent
                            node={issue.fields.description as any}
                            attachments={issue.fields.attachment}
                        />
                    ) : (
                        <span className="text-gray-600 italic">Žádný popis — dvojklikem přidejte</span>
                    )}
                </div>
            )}
        </DetailCard>

        {/* Fullscreen description editor dialog */}
        {fullscreenOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
                <div
                    className="flex flex-col m-6 rounded-xl border border-gray-700 overflow-hidden flex-1"
                    style={{ background: 'var(--c-bg-detail)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Dialog header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 shrink-0">
                        <span className="text-sm font-semibold text-gray-200">Popis — {issue.key}</span>
                        <button
                            onClick={() => setFullscreenOpen(false)}
                            className="btn-icon"
                            title="Zavřít"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable editor area */}
                    <div className="flex-1 overflow-y-auto p-5">
                        <RichTextEditor
                            ref={fullscreenEditorRef}
                            initialContent={issue.fields.description as any}
                            minHeight={400}
                            autoFocus
                            stickyToolbar
                        />
                    </div>

                    {/* Dialog footer */}
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-700 shrink-0">
                        <button
                            onClick={handleFullscreenSave}
                            disabled={mutation.isPending}
                            className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                        >
                            {mutation.isPending ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            Uložit
                        </button>
                        <button
                            onClick={() => setFullscreenOpen(false)}
                            disabled={mutation.isPending}
                            className="btn-sm"
                        >
                            Zavřít
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
