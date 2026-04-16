import type { ContentNode } from "../types/jira"

// Convert Atlassian Document Format to plain text
export function adfToText(node: ContentNode | null | undefined): string {
    if (!node) return ""
    if (node.text) return node.text
    if (!node.content) return ""
    return node.content.map(adfToText).join(node.type === "paragraph" ? "\n" : "")
}

// Jira base URL pro media — nastavuje se při inicializaci
let _jiraBaseUrl = ""
export function setAdfJiraBaseUrl(url: string) {
    _jiraBaseUrl = url.replace(/\/$/, "")
}

// Convert ADF to simple HTML for display
export function adfToHtml(node: ContentNode | null | undefined): string {
    if (!node) return ""

    switch (node.type) {
        case "doc":
            return node.content?.map(adfToHtml).join("") ?? ""
        case "paragraph":
            return `<p>${node.content?.map(adfToHtml).join("") ?? ""}</p>`
        case "text": {
            let text = node.text ?? ""
            if ((node as any).marks) {
                for (const mark of (node as any).marks) {
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
        case "heading": {
            const level = (node.attrs as any)?.level ?? 2
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

        // Media nody renderuje AdfContent komponenta přes IPC proxy
        case "mediaSingle":
        case "mediaGroup":
        case "media":
            return ""
        case "inlineCard": {
            const url = (node.attrs as any)?.url
            if (url) return `<a href="${url}" target="_blank" class="adf-inline-card">${url}</a>`
            return ""
        }
        case "blockCard": {
            const url = (node.attrs as any)?.url
            if (url) return `<div class="adf-block-card"><a href="${url}" target="_blank">${url}</a></div>`
            return ""
        }
        case "emoji": {
            const text = (node.attrs as any)?.text ?? (node.attrs as any)?.shortName ?? ""
            return `<span class="adf-emoji">${text}</span>`
        }
        case "mention": {
            const name = (node.attrs as any)?.text ?? ""
            return `<span class="adf-mention">${name}</span>`
        }

        default:
            return node.content?.map(adfToHtml).join("") ?? ""
    }
}

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
