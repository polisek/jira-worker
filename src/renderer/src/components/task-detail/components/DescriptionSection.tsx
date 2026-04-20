import { useState, useRef, useEffect } from 'react'
import { Save, RefreshCw, Pencil } from 'lucide-react'
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
    const editorRef = useRef<RichTextEditorRef>(null)
    const mutation = useUpdateIssueMutation(issue.key)

    // Exit edit mode when navigating to a different issue
    useEffect(() => {
        setEditing(false)
    }, [issue.key])

    const handleSave = async () => {
        if (!editorRef.current) return
        const adf = editorRef.current.getAdf()
        await mutation.mutateAsync({ description: adf })
        setEditing(false)
    }

    return (
        <DetailCard
            title="Popis"
            action={
                !editing ? (
                    <button
                        onClick={() => setEditing(true)}
                        className="btn-icon"
                        title="Upravit popis"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
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
    )
}
