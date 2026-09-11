import type { AppsJobDoc, JdAnnotation } from './types'
import { emptyAppsJobDoc } from './types'

export type JdSegment = {
  start: number
  end: number
  text: string
  annotationIds: string[]
}

/** Split JD text into contiguous segments tagged with covering annotation ids. */
export function segmentJdText(text: string, annotations: JdAnnotation[]): JdSegment[] {
  if (!text) return []
  const active = annotations.filter((a) => a.start >= 0 && a.end > a.start && a.end <= text.length)
  if (!active.length) return [{ start: 0, end: text.length, text, annotationIds: [] }]

  const points = new Set<number>([0, text.length])
  for (const a of active) {
    points.add(a.start)
    points.add(a.end)
  }
  const sorted = [...points].sort((a, b) => a - b)
  const segments: JdSegment[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!
    const end = sorted[i + 1]!
    if (end <= start) continue
    const annotationIds = active
      .filter((a) => a.start <= start && a.end >= end)
      .map((a) => a.id)
    segments.push({ start, end, text: text.slice(start, end), annotationIds })
  }
  return segments
}

/** Map a DOM selection inside `root` to character offsets in `text`. */
export function selectionOffsetsIn(
  root: HTMLElement,
  text: string,
): { start: number; end: number; quote: string } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null

  const start = nodeOffset(root, range.startContainer, range.startOffset)
  const end = nodeOffset(root, range.endContainer, range.endOffset)
  if (start == null || end == null) return null
  const a = Math.max(0, Math.min(start, end))
  const b = Math.min(text.length, Math.max(start, end))
  if (b <= a) return null
  const quote = text.slice(a, b)
  if (!quote.trim()) return null
  return { start: a, end: b, quote }
}

function nodeOffset(root: HTMLElement, node: Node, offset: number): number | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let total = 0
  let current = walker.nextNode()
  while (current) {
    const len = current.textContent?.length ?? 0
    if (current === node) return total + Math.min(offset, len)
    total += len
    current = walker.nextNode()
  }
  // Selection sometimes lands on the element itself (offset = child index).
  if (node === root || root.contains(node)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      let before = 0
      for (let i = 0; i < offset && i < el.childNodes.length; i++) {
        before += textLength(el.childNodes[i]!)
      }
      // Sum text before this element within root.
      const prefix = textBefore(root, el)
      return prefix + before
    }
  }
  return null
}

function textLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0
  let n = 0
  node.childNodes.forEach((c) => {
    n += textLength(c)
  })
  return n
}

function textBefore(root: HTMLElement, target: Node): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let total = 0
  let current = walker.nextNode()
  while (current) {
    if (target === current || (target.nodeType === Node.ELEMENT_NODE && target.contains(current))) {
      return total
    }
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return total
}

/** After JD text changes, keep comments by exact range or by finding the quote. */
export function reanchorAnnotations(text: string, annotations: JdAnnotation[]): JdAnnotation[] {
  return annotations.map((a) => {
    if (a.start >= 0 && a.end <= text.length && text.slice(a.start, a.end) === a.quote) {
      return a
    }
    if (!a.quote) return { ...a, start: -1, end: -1 }
    const idx = text.indexOf(a.quote)
    if (idx >= 0) return { ...a, start: idx, end: idx + a.quote.length }
    return { ...a, start: -1, end: -1 }
  })
}

export function normalizeAppsJobDoc(raw: unknown): AppsJobDoc | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const text = typeof r.text === 'string' ? r.text : ''
  const annotations = Array.isArray(r.annotations)
    ? r.annotations
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map((a) => ({
          id: typeof a.id === 'string' ? a.id : crypto.randomUUID(),
          start: typeof a.start === 'number' ? a.start : -1,
          end: typeof a.end === 'number' ? a.end : -1,
          quote: typeof a.quote === 'string' ? a.quote : '',
          body: typeof a.body === 'string' ? a.body : '',
          createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
        }))
    : []
  if (!text && !annotations.length) return emptyAppsJobDoc()
  return { text, annotations }
}

export function sortAnnotations(annotations: JdAnnotation[]): JdAnnotation[] {
  return [...annotations].sort((a, b) => {
    const aOk = a.start >= 0 ? a.start : Number.MAX_SAFE_INTEGER
    const bOk = b.start >= 0 ? b.start : Number.MAX_SAFE_INTEGER
    if (aOk !== bOk) return aOk - bOk
    return a.createdAt.localeCompare(b.createdAt)
  })
}
