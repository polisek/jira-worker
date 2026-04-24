import { forwardRef } from "react"
import { useRichTextEditorHook } from "./hooks/useRichTextEditor"
import { RichTextEditorView } from "./views/RichTextEditorView"
import type { RichTextEditorRef, RichTextEditorProps } from "./hooks/useRichTextEditor"

export type { RichTextEditorRef, RichTextEditorProps }

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>((props, ref) => {
    const viewProps = useRichTextEditorHook(props, ref)
    return <RichTextEditorView {...viewProps} />
})

RichTextEditor.displayName = "RichTextEditor"
