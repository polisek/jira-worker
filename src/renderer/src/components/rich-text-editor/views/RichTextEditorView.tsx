import { EditorContent } from "@tiptap/react"
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
import type { RichTextEditorViewProps } from "../hooks/useRichTextEditor"

const COLORS = [
    { label: "Červená", value: "#ef4444" },
    { label: "Oranžová", value: "#f97316" },
    { label: "Žlutá", value: "#eab308" },
    { label: "Zelená", value: "#22c55e" },
    { label: "Tyrkys", value: "#14b8a6" },
    { label: "Modrá", value: "#3b82f6" },
    { label: "Indigo", value: "#6366f1" },
    { label: "Fialová", value: "#a855f7" },
    { label: "Růžová", value: "#ec4899" },
    { label: "Šedá", value: "#9ca3af" },
    { label: "Světlá", value: "#f1f5f9" },
]

export function RichTextEditorView({
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
}: RichTextEditorViewProps) {
    if (!editor) return null

    return (
        <div
            className={`rich-editor rounded-lg border border-gray-700 focus-within:border-blue-500/60 transition-colors${stickyToolbar ? "" : " overflow-hidden"}`}
        >
            {/* Toolbar */}
            <div
                className={`flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-700 flex-wrap${stickyToolbar ? " sticky top-0 z-10 rounded-t-lg" : ""}`}
                style={{ background: "var(--c-bg-card)" }}
            >
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
                        onMouseDown={() => setShowColorPicker(!showColorPicker)}
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

                <Divider />

                <span
                    className="text-[10px] px-1"
                    style={{ color: "var(--c-text-4)" }}
                    title="Napište @ pro zmínění uživatele"
                >
                    @
                </span>
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
                            if (e.key === "Enter") {
                                e.preventDefault()
                                handleLinkSubmit()
                            }
                            if (e.key === "Escape") setShowLinkInput(false)
                        }}
                        placeholder="https://..."
                        className="input flex-1 text-xs py-1 px-2"
                        style={{ userSelect: "text" }}
                    />
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault()
                            handleLinkSubmit()
                        }}
                        className="btn-primary text-xs px-2.5 py-1"
                    >
                        OK
                    </button>
                    <button
                        onMouseDown={(e) => {
                            e.preventDefault()
                            setShowLinkInput(false)
                        }}
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
            onMouseDown={(e) => {
                e.preventDefault()
                onMouseDown()
            }}
            title={title}
            className={`p-1.5 rounded transition-colors ${
                active ? "bg-blue-500/20 text-blue-400" : "hover:bg-gray-700/60 text-gray-400 hover:text-gray-200"
            }`}
        >
            {children}
        </button>
    )
}

function Divider() {
    return <div className="w-px h-4 bg-gray-700 mx-0.5" />
}
