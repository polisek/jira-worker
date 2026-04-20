import { useRef } from 'react'
import { Send, RefreshCw } from 'lucide-react'
import { useAddCommentAdfMutation } from '../../../api/comments/add-comment-adf'
import { AdfContent } from '../../AdfContent'
import { RichTextEditor, type RichTextEditorRef } from '../../RichTextEditor'
import { DetailCard } from './DetailCard'
import { formatDate } from '../../../lib/adf-to-text'
import type { JiraIssue } from '../../../types/jira'

interface Props {
    issue: JiraIssue
}

export function CommentsSection({ issue }: Props) {
    const editorRef = useRef<RichTextEditorRef>(null)
    const mutation = useAddCommentAdfMutation(issue.key)

    const handleSend = async () => {
        if (!editorRef.current || editorRef.current.isEmpty()) return
        const adf = editorRef.current.getAdf()
        await mutation.mutateAsync(adf as Record<string, unknown>)
        editorRef.current.clear()
    }

    const comments = issue.fields.comment?.comments.slice(-10) ?? []
    const total = issue.fields.comment?.total ?? 0

    return (
        <DetailCard
            title={`Komentáře (${total})`}
            footer={
                <>
                    <p className="text-xs text-gray-600">Ctrl+Enter pro odeslání</p>
                    <button
                        onClick={handleSend}
                        disabled={mutation.isPending}
                        className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                    >
                        {mutation.isPending ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5" />
                        )}
                        Odeslat
                    </button>
                </>
            }
        >
            {/* Comment list */}
            {comments.length > 0 && (
                <div className="flex flex-col gap-3 mb-4">
                    {comments.map((c) => (
                        <div key={c.id} className="flex gap-2">
                            <img
                                src={c.author.avatarUrls['48x48']}
                                alt=""
                                className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-semibold text-gray-300">
                                        {c.author.displayName}
                                    </span>
                                    <span className="text-xs text-gray-600">{formatDate(c.created)}</span>
                                </div>
                                <AdfContent
                                    node={c.body as any}
                                    className="text-xs text-gray-400 leading-relaxed"
                                    attachments={issue.fields.attachment}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add comment */}
            {mutation.isError && (
                <p className="text-red-400 text-xs mb-2">{(mutation.error as Error)?.message}</p>
            )}
            <RichTextEditor
                ref={editorRef}
                placeholder="Přidat komentář..."
                minHeight={72}
                onCtrlEnter={handleSend}
            />
        </DetailCard>
    )
}
