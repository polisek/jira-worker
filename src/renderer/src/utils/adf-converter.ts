// Bidirectional converter: ADF (Atlassian Document Format) ↔ TipTap JSON

export type AdfMark = { type: string; attrs?: Record<string, unknown> }

export type AdfNode = {
    type: string
    version?: number
    text?: string
    content?: AdfNode[]
    attrs?: Record<string, unknown>
    marks?: AdfMark[]
}

export type TiptapMark = { type: string; attrs?: Record<string, unknown> }

export type TiptapNode = {
    type: string
    text?: string
    content?: TiptapNode[]
    attrs?: Record<string, unknown>
    marks?: TiptapMark[]
}

// ── ADF → TipTap ──────────────────────────────────────────────────────────────

function convertMark(mark: AdfMark): TiptapMark | null {
    switch (mark.type) {
        case "strong":    return { type: "bold" }
        case "em":        return { type: "italic" }
        case "underline": return { type: "underline" }
        case "code":      return { type: "code" }
        case "strike":    return { type: "strike" }
        case "link":      return { type: "link", attrs: { href: mark.attrs?.href, target: "_blank" } }
        case "textColor": return { type: "textStyle", attrs: { color: mark.attrs?.color } }
        // Unknown marks are silently dropped — TipTap would reject them
        default:          return null
    }
}

function mapContent(nodes: AdfNode[] | undefined): TiptapNode[] {
    if (!nodes) return []
    return nodes.flatMap((n) => {
        const result = adfToTiptap(n)
        return result ? [result] : []
    })
}

export function adfToTiptap(node: AdfNode): TiptapNode | null {
    switch (node.type) {
        case "doc":
            return { type: "doc", content: mapContent(node.content) }

        case "paragraph":
            return { type: "paragraph", content: mapContent(node.content) }

        case "text": {
            const marks = node.marks?.map(convertMark).filter(Boolean) as TiptapMark[] | undefined
            return { type: "text", text: node.text, ...(marks?.length ? { marks } : {}) }
        }

        case "bulletList":
            return { type: "bulletList", content: mapContent(node.content) }

        case "orderedList":
            return {
                type: "orderedList",
                attrs: { start: (node.attrs?.order as number) ?? 1 },
                content: mapContent(node.content),
            }

        case "listItem":
            return { type: "listItem", content: mapContent(node.content) }

        case "taskList":
            return { type: "taskList", content: mapContent(node.content) }

        case "taskItem": {
            // ADF taskItem content is inline nodes; TipTap TaskItem requires a paragraph wrapper
            const inlineContent = mapContent(node.content)
            return {
                type: "taskItem",
                attrs: { checked: node.attrs?.state === "DONE" },
                content: [{ type: "paragraph", content: inlineContent }],
            }
        }

        case "heading":
            return {
                type: "heading",
                attrs: { level: (node.attrs?.level as number) ?? 2 },
                content: mapContent(node.content),
            }

        case "codeBlock":
            return {
                type: "codeBlock",
                attrs: { language: (node.attrs?.language as string) ?? null },
                content: mapContent(node.content),
            }

        case "blockquote":
            return { type: "blockquote", content: mapContent(node.content) }

        case "hardBreak":
            return { type: "hardBreak" }

        case "rule":
            return { type: "horizontalRule" }

        // ADF-specific inline nodes — convert to linked text
        case "inlineCard": {
            const url = (node.attrs?.url as string) ?? ""
            if (!url) return null
            return { type: "text", text: url, marks: [{ type: "link", attrs: { href: url, target: "_blank" } }] }
        }

        // ADF-specific block nodes — convert to paragraph with link
        case "blockCard": {
            const url = (node.attrs?.url as string) ?? ""
            if (!url) return null
            return {
                type: "paragraph",
                content: [{ type: "text", text: url, marks: [{ type: "link", attrs: { href: url, target: "_blank" } }] }],
            }
        }

        // Emoji → plain text
        case "emoji": {
            const text = (node.attrs?.text as string) ?? (node.attrs?.shortName as string) ?? ""
            return text ? { type: "text", text } : null
        }

        // Mention → @name text
        case "mention": {
            const name = (node.attrs?.text as string) ?? (node.attrs?.displayName as string) ?? ""
            return name ? { type: "text", text: `@${name}` } : null
        }

        // Media nodes — skip entirely (can't be represented in TipTap without media extension)
        case "mediaSingle":
        case "mediaGroup":
        case "media":
            return null

        // Unknown node type — skip gracefully
        default:
            return null
    }
}

// ── TipTap → ADF ──────────────────────────────────────────────────────────────

function genUuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
    })
}

function convertMarkToAdf(mark: TiptapMark): AdfMark | null {
    switch (mark.type) {
        case "bold":      return { type: "strong" }
        case "italic":    return { type: "em" }
        case "underline": return { type: "underline" }
        case "code":      return { type: "code" }
        case "strike":    return { type: "strike" }
        case "link":      return { type: "link", attrs: { href: mark.attrs?.href } }
        case "textStyle":
            if (mark.attrs?.color) return { type: "textColor", attrs: { color: mark.attrs.color } }
            return null // textStyle without color — skip
        default:          return { type: mark.type, attrs: mark.attrs }
    }
}

export function tiptapToAdf(node: TiptapNode): AdfNode {
    switch (node.type) {
        case "doc":
            return { type: "doc", version: 1, content: (node.content ?? []).map(tiptapToAdf) }

        case "paragraph": {
            const content = (node.content ?? []).map(tiptapToAdf)
            return { type: "paragraph", ...(content.length ? { content } : {}) }
        }

        case "text": {
            const marks = node.marks?.map(convertMarkToAdf).filter(Boolean) as AdfMark[] | undefined
            return { type: "text", text: node.text ?? "", ...(marks?.length ? { marks } : {}) }
        }

        case "bulletList":
            return { type: "bulletList", content: (node.content ?? []).map(tiptapToAdf) }

        case "orderedList":
            return { type: "orderedList", content: (node.content ?? []).map(tiptapToAdf) }

        case "listItem":
            return { type: "listItem", content: (node.content ?? []).map(tiptapToAdf) }

        case "taskList":
            return {
                type: "taskList",
                attrs: { localId: genUuid() },
                content: (node.content ?? []).map(tiptapToAdf),
            }

        case "taskItem": {
            // TipTap wraps taskItem content in a paragraph; ADF expects inline nodes directly
            const rawContent = node.content ?? []
            const adfContent = rawContent.flatMap((child) => {
                if (child.type === "paragraph") {
                    return (child.content ?? []).map(tiptapToAdf)
                }
                return [tiptapToAdf(child)]
            })
            return {
                type: "taskItem",
                attrs: { localId: genUuid(), state: node.attrs?.checked ? "DONE" : "TODO" },
                content: adfContent,
            }
        }

        case "heading":
            return {
                type: "heading",
                attrs: { level: (node.attrs?.level as number) ?? 2 },
                content: (node.content ?? []).map(tiptapToAdf),
            }

        case "codeBlock":
            return {
                type: "codeBlock",
                ...(node.attrs?.language ? { attrs: { language: node.attrs.language } } : {}),
                content: (node.content ?? []).map(tiptapToAdf),
            }

        case "blockquote":
            return { type: "blockquote", content: (node.content ?? []).map(tiptapToAdf) }

        case "hardBreak":
            return { type: "hardBreak" }

        case "horizontalRule":
            return { type: "rule" }

        default:
            if (node.content) {
                return {
                    type: node.type,
                    content: node.content.map(tiptapToAdf),
                    ...(node.attrs ? { attrs: node.attrs } : {}),
                }
            }
            return { type: node.type, ...(node.attrs ? { attrs: node.attrs } : {}) }
    }
}
