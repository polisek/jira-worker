import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import { ReactRenderer } from "@tiptap/react"
import tippy, { type Instance as TippyInstance } from "tippy.js"
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion"
import { MentionList, type MentionListRef } from "../components/MentionList"
import { searchUsersRequest } from "../../../api/users/search-users"
import { adfToTiptap, tiptapToAdf, type AdfNode, type TiptapNode } from "../../../utils/adf"
import type { JiraUser } from "../../../types/jira"

// ── Mention suggestion config (module-scope — no component state dependency) ──

const mentionSuggestion = {
    items: async ({ query }: { query: string }): Promise<JiraUser[]> => {
        if (!query || query.length < 1) return []
        try {
            return await searchUsersRequest(query)
        } catch {
            return []
        }
    },

    render: () => {
        let reactRenderer: ReactRenderer<MentionListRef> | null = null
        let popup: TippyInstance[] | null = null

        return {
            onStart: (renderProps: SuggestionProps<JiraUser>) => {
                reactRenderer = new ReactRenderer(MentionList, {
                    props: {
                        ...renderProps,
                        items: renderProps.items ?? [],
                    },
                    editor: renderProps.editor,
                })

                if (!renderProps.clientRect) return

                popup = tippy("body", {
                    getReferenceClientRect: renderProps.clientRect as () => DOMRect,
                    appendTo: () => document.body,
                    content: reactRenderer.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "bottom-start",
                    zIndex: 9999,
                })
            },

            onUpdate: (renderProps: SuggestionProps<JiraUser>) => {
                reactRenderer?.updateProps({
                    ...renderProps,
                    items: renderProps.items ?? [],
                })
                if (renderProps.clientRect) {
                    popup?.[0]?.setProps({
                        getReferenceClientRect: renderProps.clientRect as () => DOMRect,
                    })
                }
            },

            onKeyDown: (renderProps: SuggestionKeyDownProps) => {
                if (renderProps.event.key === "Escape") {
                    popup?.[0]?.hide()
                    return true
                }
                return reactRenderer?.ref?.onKeyDown(renderProps) ?? false
            },

            onExit: () => {
                popup?.[0]?.destroy()
                reactRenderer?.destroy()
                popup = null
                reactRenderer = null
            },
        }
    },
}

// ── Public ref interface ──────────────────────────────────────────────────────────────

export interface RichTextEditorRef {
    getAdf: () => AdfNode
    isEmpty: () => boolean
    clear: () => void
    focus: () => void
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface RichTextEditorProps {
    initialContent?: AdfNode | null
    placeholder?: string
    minHeight?: number
    autoFocus?: boolean
    stickyToolbar?: boolean
    onCtrlEnter?: () => void
}

// ── Hook output (passed to View) ───────────────────────────────────────────────

export interface RichTextEditorViewProps {
    editor: ReturnType<typeof useEditor>
    showColorPicker: boolean
    setShowColorPicker: (v: boolean) => void
    showLinkInput: boolean
    setShowLinkInput: (v: boolean) => void
    linkUrl: string
    setLinkUrl: (v: string) => void
    colorPickerRef: React.RefObject<HTMLDivElement>
    linkInputRef: React.RefObject<HTMLInputElement>
    handleLinkClick: () => void
    handleLinkSubmit: () => void
    minHeight: number
    stickyToolbar: boolean
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRichTextEditorHook(
    props: RichTextEditorProps,
    ref: React.ForwardedRef<RichTextEditorRef>
): RichTextEditorViewProps {
    const {
        initialContent,
        placeholder = "Začněte psát...",
        minHeight = 120,
        autoFocus = false,
        stickyToolbar = false,
        onCtrlEnter,
    } = props

    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkUrl, setLinkUrl] = useState("")
    const colorPickerRef = useRef<HTMLDivElement>(null)
    const linkInputRef = useRef<HTMLInputElement>(null)

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TaskList,
            TaskItem.configure({ nested: false }),
            TextStyle,
            Color,
            Link.configure({ openOnClick: false }),
            Placeholder.configure({ placeholder }),
            Mention.configure({
                HTMLAttributes: { class: "mention" },
                renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
                suggestion: mentionSuggestion,
            }),
        ],
        content: initialContent ? adfToTiptap(initialContent) : null,
        autofocus: autoFocus,
        editorProps: {
            attributes: { class: "rich-editor-content adf-content outline-none" },
            handleKeyDown: (_view, event) => {
                if (event.key === "Enter" && event.ctrlKey && onCtrlEnter) {
                    onCtrlEnter()
                    return true
                }
                return false
            },
        },
    })

    // Expose imperative ref ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
        getAdf: () => tiptapToAdf((editor?.getJSON() ?? { type: "doc", content: [] }) as TiptapNode),
        isEmpty: () => editor?.isEmpty ?? true,
        clear: () => editor?.commands.clearContent(true),
        focus: () => editor?.commands.focus(),
    }))

    // Close color picker on outside click ─────────────────────────────────────
    useEffect(() => {
        if (!showColorPicker) return
        const handler = (e: MouseEvent) => {
            if (!colorPickerRef.current?.contains(e.target as Node)) {
                setShowColorPicker(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [showColorPicker])

    // Focus link input when shown ──────────────────────────────────────────────
    useEffect(() => {
        if (showLinkInput) {
            setTimeout(() => linkInputRef.current?.focus(), 0)
        }
    }, [showLinkInput])

    const handleLinkClick = useCallback(() => {
        if (!editor) return
        if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run()
        } else {
            setLinkUrl("")
            setShowLinkInput(true)
        }
    }, [editor])

    const handleLinkSubmit = useCallback(() => {
        if (!editor) return
        const url = linkUrl.trim()
        if (url) {
            const href = url.startsWith("http") ? url : `https://${url}`
            editor.chain().focus().setLink({ href }).run()
        }
        setLinkUrl("")
        setShowLinkInput(false)
    }, [editor, linkUrl])

    return {
        editor,
        showColorPicker,
        setShowColorPicker,
        showLinkInput,
        setShowLinkInput,
        linkUrl,
        setLinkUrl,
        colorPickerRef,
        linkInputRef,
        handleLinkClick,
        handleLinkSubmit,
        minHeight,
        stickyToolbar,
    }
}

// ── Factory for forwardRef wrapping ───────────────────────────────────────────

export function createRichTextEditorHook(props: RichTextEditorProps) {
    return (ref: React.ForwardedRef<RichTextEditorRef>) => useRichTextEditorHook(props, ref)
}
