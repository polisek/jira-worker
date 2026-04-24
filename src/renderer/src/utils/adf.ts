// ADF (Atlassian Document Format) utilities:
//   - ADF → HTML (for display via dangerouslySetInnerHTML)
//   - ADF ↔ TipTap JSON (for the rich-text editor)

import type { ContentNode } from "../types/jira"

// ── Types ─────────────────────────────────────────────────────────────────────

type AdfMark = { type: string; attrs?: Record<string, unknown> }

export type AdfNode = {
    type: string
    version?: number
    text?: string
    content?: AdfNode[]
    attrs?: Record<string, unknown>
    marks?: AdfMark[]
}

type TiptapMark = { type: string; attrs?: Record<string, unknown> }

export type TiptapNode = {
    type: string
    text?: string
    content?: TiptapNode[]
    attrs?: Record<string, unknown>
    marks?: TiptapMark[]
}

// ── ADF → HTML ────────────────────────────────────────────────────────────────

// Jira base URL for media — set during initialisation
let _jiraBaseUrl = ""
export function setAdfJiraBaseUrl(url: string) {
    _jiraBaseUrl = url.replace(/\/$/, "")
}

export function adfToHtml(node: ContentNode | null | undefined): string {
    if (!node) return ""

    switch (node.type) {
        case "doc":
            return node.content?.map(adfToHtml).join("") ?? ""
        case "paragraph":
            return `<p>${node.content?.map(adfToHtml).join("") ?? ""}</p>`
        case "text": {
            let text = node.text ?? ""
            if ((node as AdfNode).marks) {
                for (const mark of (node as AdfNode).marks!) {
                    if (mark.type === "strong") text = `<strong>${text}</strong>`
                    if (mark.type === "em") text = `<em>${text}</em>`
                    if (mark.type === "code") text = `<code>${text}</code>`
                    if (mark.type === "link") text = `<a href="${mark.attrs?.href}" target="_blank">${text}</a>`
                }
            }
            return text
        }
        case "bulletList":
            return `<ul>${node.content?.map(adfToHtml).join("") ?? ""}</ul>`
        case "orderedList":
            return `<ol>${node.content?.map(adfToHtml).join("") ?? ""}</ol>`
        case "listItem":
            return `<li>${node.content?.map(adfToHtml).join("") ?? ""}</li>`
        case "taskList":
            return `<ul data-type="taskList">${node.content?.map(adfToHtml).join("") ?? ""}</ul>`
        case "taskItem": {
            const checked = (node.attrs as AdfNode["attrs"])?.state === "DONE"
            const content = node.content?.map(adfToHtml).join("") ?? ""
            return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" ${checked ? "checked" : ""} disabled /></label><div>${content}</div></li>`
        }
        case "heading": {
            const level = node.attrs?.level ?? 2
            return `<h${level}>${node.content?.map(adfToHtml).join("") ?? ""}</h${level}>`
        }
        case "codeBlock":
            return `<pre><code>${node.content?.map(adfToHtml).join("") ?? ""}</code></pre>`
        case "blockquote":
            return `<blockquote>${node.content?.map(adfToHtml).join("") ?? ""}</blockquote>`
        case "hardBreak":
            return "<br/>"
        case "rule":
            return "<hr/>"

        // Media nodes are rendered by AdfContent via IPC proxy
        case "mediaSingle":
        case "mediaGroup":
        case "media":
            return ""
        case "inlineCard": {
            const url = node.attrs?.url
            if (url) return `<a href="${url}" target="_blank" class="adf-inline-card">${url}</a>`
            return ""
        }
        case "blockCard": {
            const url = node.attrs?.url
            if (url) return `<div class="adf-block-card"><a href="${url}" target="_blank">${url}</a></div>`
            return ""
        }
        case "emoji": {
            const text = node.attrs?.text ?? node.attrs?.shortName ?? ""
            return `<span class="adf-emoji">${text}</span>`
        }
        case "mention": {
            const name = node.attrs?.text ?? ""
            return `<span class="adf-mention">${name}</span>`
        }

        default:
            return node.content?.map(adfToHtml).join("") ?? ""
    }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("cs-CZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function formatDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString("cs-CZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
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

        case "inlineCard": {
            const url = (node.attrs?.url as string) ?? ""
            if (!url) return null
            return { type: "text", text: url, marks: [{ type: "link", attrs: { href: url, target: "_blank" } }] }
        }

        case "blockCard": {
            const url = (node.attrs?.url as string) ?? ""
            if (!url) return null
            return {
                type: "paragraph",
                content: [{ type: "text", text: url, marks: [{ type: "link", attrs: { href: url, target: "_blank" } }] }],
            }
        }

        case "emoji": {
            const text = (node.attrs?.text as string) ?? (node.attrs?.shortName as string) ?? ""
            return text ? { type: "text", text } : null
        }

        case "mention": {
            const id = (node.attrs?.id as string) ?? ""
            const label = (node.attrs?.text as string) ?? (node.attrs?.displayName as string) ?? id
            if (!id && !label) return null
            return {
                type: "mention",
                attrs: { id, label },
            }
        }

        case "mediaSingle":
        case "mediaGroup":
        case "media":
            return null

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
            return null
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

        case "mention":
            return {
                type: "mention",
                attrs: {
                    id: (node.attrs?.id as string) ?? "",
                    text: (node.attrs?.label as string) ?? (node.attrs?.id as string) ?? "",
                },
            }

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
