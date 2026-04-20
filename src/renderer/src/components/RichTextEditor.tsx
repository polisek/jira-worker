import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    CheckSquare,
    Link as LinkIcon,
    Code2,
    Palette,
    X,
} from "lucide-react"
import { adfToTiptap, tiptapToAdf, type AdfNode, type TiptapNode } from "../utils/adf-converter"

const COLORS = [
    { label: "Červená",   value: "#ef4444" },
    { label: "Oranžová",  value: "#f97316" },
    { label: "Žlutá",     value: "#eab308" },
    { label: "Zelená",    value: "#22c55e" },
    { label: "Tyrkys",    value: "#14b8a6" },
    { label: "Modrá",     value: "#3b82f6" },
    { label: "Indigo",    value: "#6366f1" },
    { label: "Fialová",   value: "#a855f7" },
    { label: "Růžová",    value: "#ec4899" },
    { label: "Šedá",      value: "#9ca3af" },
    { label: "Světlá",    value: "#f1f5f9" },
]

export interface RichTextEditorRef {
    getAdf: () => AdfNode
    isEmpty: () => boolean
    clear: () => void
    focus: () => void
}

interface Props {
    initialContent?: AdfNode | null
    placeholder?: string
    minHeight?: number
    autoFocus?: boolean
    onCtrlEnter?: () => void
}

export const RichTextEditor = forwardRef<RichTextEditorRef, Props>(
    ({ initialContent, placeholder = "Začněte psát...", minHeight = 120, autoFocus = false, onCtrlEnter }, ref) => {
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
            ],
            content: initialContent ? adfToTiptap(initialContent) : null,
            autofocus: autoFocus,
            editorProps: {
                attributes: {
                    class: "rich-editor-content adf-content outline-none",
                },
                handleKeyDown: (_view, event) => {
                    if (event.key === "Enter" && event.ctrlKey && onCtrlEnter) {
                        onCtrlEnter()
                        return true
                    }
                    return false
                },
            },
        })

        useImperativeHandle(ref, () => ({
            getAdf: () => tiptapToAdf((editor?.getJSON() ?? { type: "doc", content: [] }) as TiptapNode),
            isEmpty: () => editor?.isEmpty ?? true,
            clear: () => editor?.commands.clearContent(true),
            focus: () => editor?.commands.focus(),
        }))

        // Close color picker on outside click
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

        // Focus link input when shown
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

        if (!editor) return null

        return (
            <div className="rich-editor rounded-lg overflow-hidden border border-gray-700 focus-within:border-blue-500/60 transition-colors">
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-700 flex-wrap" style={{ background: "var(--c-bg-card)" }}>
                    <ToolbarBtn
                        onMouseDown={() => editor.chain().focus().toggleBold().run()}
                        active={editor.isActive("bold")}
                        title="Tučné (Ctrl+B)"
                    >
                        <Bold className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onMouseDown={() => editor.chain().focus().toggleItalic().run()}
                        active={editor.isActive("italic")}
                        title="Kurzíva (Ctrl+I)"
                    >
                        <Italic className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onMouseDown={() => editor.chain().focus().toggleUnderline().run()}
                        active={editor.isActive("underline")}
                        title="Podtržení (Ctrl+U)"
                    >
                        <UnderlineIcon className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <Divider />

                    <ToolbarBtn
                        onMouseDown={() => editor.chain().focus().toggleBulletList().run()}
                        active={editor.isActive("bulletList")}
                        title="Odrážkový seznam"
                    >
                        <List className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onMouseDown={() => editor.chain().focus().toggleOrderedList().run()}
                        active={editor.isActive("orderedList")}
                        title="Číslovaný seznam"
                    >
                        <ListOrdered className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onMouseDown={() => editor.chain().focus().toggleTaskList().run()}
                        active={editor.isActive("taskList")}
                        title="Seznam úloh"
                    >
                        <CheckSquare className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <Divider />

                    {/* Color picker */}
                    <div className="relative" ref={colorPickerRef}>
                        <ToolbarBtn
                            onMouseDown={() => setShowColorPicker((v) => !v)}
                            active={showColorPicker}
                            title="Barva textu"
                        >
                            <Palette className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                        {showColorPicker && (
                            <div
                                className="absolute top-full left-0 mt-1 z-50 p-2 rounded-lg border border-gray-700 shadow-xl"
                                style={{ background: "var(--c-bg-detail)", width: 160 }}
                            >
                                <div className="flex flex-wrap gap-1.5">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            title={c.label}
                                            className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0"
                                            style={{
                                                backgroundColor: c.value,
                                                borderColor: editor.isActive("textStyle", { color: c.value })
                                                    ? "#60a5fa"
                                                    : "rgba(255,255,255,0.15)",
                                            }}
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                editor.chain().focus().setColor(c.value).run()
                                                setShowColorPicker(false)
                                            }}
                                        />
                                    ))}
                                    <button
                                        title="Odebrat barvu"
                                        className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center hover:bg-gray-700 transition-colors flex-shrink-0"
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            editor.chain().focus().unsetColor().run()
                                            setShowColorPicker(false)
                                        }}
                                    >
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <Divider />

                    <ToolbarBtn
                        onMouseDown={() => editor.chain().focus().toggleCodeBlock().run()}
                        active={editor.isActive("codeBlock")}
                        title="Blok kódu"
                    >
                        <Code2 className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onMouseDown={handleLinkClick}
                        active={editor.isActive("link")}
                        title={editor.isActive("link") ? "Odebrat odkaz" : "Vložit odkaz"}
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                </div>

                {/* Link URL input */}
                {showLinkInput && (
                    <div
                        className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-700"
                        style={{ background: "var(--c-bg-card)" }}
                    >
                        <input
                            ref={linkInputRef}
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); handleLinkSubmit() }
                                if (e.key === "Escape") setShowLinkInput(false)
                            }}
                            placeholder="https://..."
                            className="input flex-1 text-xs py-1 px-2"
                            style={{ userSelect: "text" }}
                        />
                        <button
                            onMouseDown={(e) => { e.preventDefault(); handleLinkSubmit() }}
                            className="btn-primary text-xs px-2.5 py-1"
                        >
                            OK
                        </button>
                        <button
                            onMouseDown={(e) => { e.preventDefault(); setShowLinkInput(false) }}
                            className="btn-sm text-xs"
                        >
                            Zrušit
                        </button>
                    </div>
                )}

                {/* Editor area */}
                <div style={{ minHeight, userSelect: "text", cursor: "text" }}>
                    <EditorContent editor={editor} />
                </div>
            </div>
        )
    }
)

RichTextEditor.displayName = "RichTextEditor"

function ToolbarBtn({
    children,
    onMouseDown,
    active,
    title,
}: {
    children: React.ReactNode
    onMouseDown: () => void
    active?: boolean
    title?: string
}) {
    return (
        <button
            onMouseDown={(e) => { e.preventDefault(); onMouseDown() }}
            title={title}
            type="button"
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                active
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/60"
            }`}
        >
            {children}
        </button>
    )
}

function Divider() {
    return <div className="w-px h-4 bg-gray-700 mx-0.5 flex-shrink-0" />
}
