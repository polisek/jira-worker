import { AdfImage } from './AdfImage'
import { adfToHtml } from '../utils/adf'
import type { ContentNode, JiraAttachment } from '../types/jira'

interface Props {
  node: ContentNode | null | undefined
  className?: string
  attachments?: JiraAttachment[]
}

type Part = { type: 'html'; html: string } | { type: 'media'; contentUrl: string }

export function AdfContent({ node, className, attachments = [] }: Props) {
  if (!node) return null

  const imageAttachments = attachments.filter(
    (a) => a.mimeType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.filename)
  )

  const parts = split(node, imageAttachments)

  return (
    <div className={className}>
      {parts.map((part, i) =>
        part.type === 'html'
          ? <div key={i} className="adf-content" dangerouslySetInnerHTML={{ __html: part.html }} />
          : <AdfImage key={i} contentUrl={part.contentUrl} />
      )}
    </div>
  )
}

function split(node: ContentNode, attachments: JiraAttachment[]): Part[] {
  if (!node?.content) return [{ type: 'html', html: adfToHtml(node) }]

  const parts: Part[] = []
  let buf: ContentNode[] = []

  const flush = () => {
    if (!buf.length) return
    parts.push({ type: 'html', html: adfToHtml({ type: 'doc', content: buf }) })
    buf = []
  }

  for (const child of node.content) {
    const url = mediaUrl(child, attachments)
    if (url) { flush(); parts.push({ type: 'media', contentUrl: url }) }
    else buf.push(child)
  }
  flush()
  return parts
}

function mediaUrl(node: ContentNode, attachments: JiraAttachment[]): string | null {
  // mediaSingle → media child
  if (node.type === 'mediaSingle' && node.content) {
    for (const c of node.content) {
      const u = mediaNodeUrl(c, attachments)
      if (u) return u
    }
  }
  return mediaNodeUrl(node, attachments)
}

function mediaNodeUrl(node: ContentNode, attachments: JiraAttachment[]): string | null {
  if (node.type !== 'media') return null
  const a = node.attrs as any
  if (!a) return null

  if (a.type === 'external' && a.url) return a.url

  // Match attachment by alt (= filename in Jira Cloud)
  const name = a.alt ?? a.__fileName ?? a.fileName
  if (name && attachments.length) {
    const match = attachments.find((att) => att.filename === name)
    if (match) return match.content
  }

  // Match by size
  if (a.__fileSize && attachments.length) {
    const match = attachments.find((att) => att.size === a.__fileSize)
    if (match) return match.content
  }

  return null
}
