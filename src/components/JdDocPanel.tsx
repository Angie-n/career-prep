import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { uid } from '../lib/ids'
import {
  reanchorAnnotations,
  segmentJdText,
  selectionOffsetsIn,
  sortAnnotations,
} from '../lib/jdAnnotations'
import type { AppsJobDoc, JdAnnotation } from '../lib/types'

type PendingSelection = {
  start: number
  end: number
  quote: string
}

type ContextMenu = {
  x: number
  y: number
}

export function JdDocPanel({
  jobDoc,
  onChange,
  readOnly = false,
}: {
  jobDoc: AppsJobDoc
  onChange?: (next: AppsJobDoc) => void
  readOnly?: boolean
}) {
  const [editingText, setEditingText] = useState(!jobDoc.text.trim())
  const [draftText, setDraftText] = useState(jobDoc.text)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingSelection | null>(null)
  const [menu, setMenu] = useState<ContextMenu | null>(null)
  const [commentTops, setCommentTops] = useState<Record<string, number>>({})

  const docRef = useRef<HTMLDivElement>(null)
  const markRefs = useRef<Map<string, HTMLElement>>(new Map())
  const commentRefs = useRef<Map<string, HTMLElement>>(new Map())
  const railRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<PendingSelection | null>(null)
  pendingRef.current = pending

  const annotations = useMemo(() => sortAnnotations(jobDoc.annotations), [jobDoc.annotations])
  const anchored = useMemo(() => annotations.filter((a) => a.start >= 0), [annotations])
  const detached = useMemo(() => annotations.filter((a) => a.start < 0), [annotations])
  const segments = useMemo(
    () => segmentJdText(jobDoc.text, anchored),
    [jobDoc.text, anchored],
  )

  useEffect(() => {
    if (!jobDoc.text.trim()) setEditingText(true)
  }, [jobDoc.text])

  useLayoutEffect(() => {
    if (readOnly || editingText || !docRef.current) {
      setCommentTops({})
      return
    }
    const tops: Record<string, number> = {}
    let lastBottom = 0
    const gap = 8
    for (const a of anchored) {
      const mark = markRefs.current.get(a.id)
      const card = commentRefs.current.get(a.id)
      const natural = mark?.offsetTop ?? lastBottom
      const height = card?.offsetHeight ?? 52
      const top = Math.max(natural, lastBottom)
      tops[a.id] = top
      lastBottom = top + height + gap
    }
    setCommentTops(tops)
  }, [anchored, jobDoc.text, editingText, activeId, readOnly])

  useEffect(() => {
    if (!menu) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null)
    }
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current?.contains(e.target as Node)) return
      setMenu(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [menu])

  function commitDoc(next: AppsJobDoc) {
    onChange?.(next)
  }

  function applyText(nextText: string) {
    const annotationsNext = reanchorAnnotations(nextText, jobDoc.annotations)
    commitDoc({ text: nextText, annotations: annotationsNext })
    setDraftText(nextText)
    setEditingText(false)
    setPending(null)
    setMenu(null)
  }

  function captureSelection(): PendingSelection | null {
    if (readOnly || editingText || !docRef.current) return null
    return selectionOffsetsIn(docRef.current, jobDoc.text)
  }

  function onDocMouseUp() {
    const next = captureSelection()
    setPending(next)
    if (!next) setMenu(null)
  }

  function onDocContextMenu(e: React.MouseEvent) {
    if (readOnly || editingText) return
    e.preventDefault()
    const next = captureSelection() ?? pendingRef.current
    if (!next) {
      setMenu(null)
      return
    }
    setPending(next)
    setMenu({ x: e.clientX, y: e.clientY })
  }

  function addCommentFromPending() {
    const sel = pendingRef.current
    if (!sel || readOnly) return
    const annotation: JdAnnotation = {
      id: uid(),
      start: sel.start,
      end: sel.end,
      quote: sel.quote,
      body: '',
      createdAt: new Date().toISOString(),
    }
    commitDoc({
      ...jobDoc,
      annotations: [...jobDoc.annotations, annotation],
    })
    setActiveId(annotation.id)
    setPending(null)
    setMenu(null)
    window.getSelection()?.removeAllRanges()
    requestAnimationFrame(() => {
      commentRefs.current.get(annotation.id)?.querySelector('textarea')?.focus()
    })
  }

  function patchAnnotation(id: string, body: string) {
    commitDoc({
      ...jobDoc,
      annotations: jobDoc.annotations.map((a) => (a.id === id ? { ...a, body } : a)),
    })
  }

  function removeAnnotation(id: string) {
    commitDoc({
      ...jobDoc,
      annotations: jobDoc.annotations.filter((a) => a.id !== id),
    })
    if (activeId === id) setActiveId(null)
  }

  function focusAnnotation(id: string) {
    setActiveId(id)
    const mark = markRefs.current.get(id)
    mark?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const card = commentRefs.current.get(id)
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const showEditor = editingText && !readOnly
  const hasSavedText = Boolean(jobDoc.text.trim())

  if (!hasSavedText && readOnly) {
    return (
      <div className="apps-jd-workspace">
        <p className="muted">No job description was saved for this session.</p>
      </div>
    )
  }

  return (
    <div className="apps-jd-workspace">
      <div className="apps-session-columns">
        <div className="apps-session-col apps-session-doc-col">
          <div className="dsa-col-head apps-doc-head">
            <div>
              <h2 className="dsa-col-heading">Job description</h2>
              {readOnly ? (
                <p className="muted dsa-log-hint">Highlights and comments from this block.</p>
              ) : showEditor ? (
                <p className="muted dsa-log-hint">
                  {hasSavedText
                    ? 'Edit the posting text. Existing comments stay attached when the quote still matches.'
                    : 'Paste the posting, then highlight lines and leave comments in the margin.'}
                </p>
              ) : null}
            </div>
            {!readOnly ? (
              showEditor ? (
                <div className="row apps-paste-actions">
                  <button
                    className="btn"
                    type="button"
                    disabled={!draftText.trim()}
                    onClick={() => applyText(draftText)}
                  >
                    {hasSavedText ? 'Done' : 'Use this posting'}
                  </button>
                  {hasSavedText ? (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setDraftText(jobDoc.text)
                        setEditingText(false)
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setDraftText(jobDoc.text)
                    setEditingText(true)
                    setPending(null)
                    setMenu(null)
                  }}
                >
                  Edit posting
                </button>
              )
            ) : null}
          </div>
          <div className={`apps-doc-scroll${showEditor ? ' is-editing' : ''}`}>
            {showEditor ? (
              <textarea
                className="notes apps-jd-edit-area"
                placeholder="Paste the full job description here…"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                autoFocus
              />
            ) : (
              <div
                className="apps-jd-doc"
                ref={docRef}
                onMouseUp={onDocMouseUp}
                onContextMenu={onDocContextMenu}
                role="article"
              >
                {segments.map((seg, i) => {
                  if (i === 0) markRefs.current = new Map()
                  if (!seg.annotationIds.length) {
                    return <span key={`${seg.start}-${seg.end}`}>{seg.text}</span>
                  }
                  const primary = seg.annotationIds[0]!
                  const active = seg.annotationIds.includes(activeId ?? '')
                  return (
                    <mark
                      key={`${seg.start}-${seg.end}`}
                      className={`apps-jd-mark${active ? ' is-active' : ''}`}
                      data-annotation-ids={seg.annotationIds.join(' ')}
                      ref={(el) => {
                        if (!el) return
                        for (const id of seg.annotationIds) {
                          if (!markRefs.current.has(id)) markRefs.current.set(id, el)
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        focusAnnotation(primary)
                      }}
                    >
                      {seg.text}
                    </mark>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="apps-session-col apps-session-comments-col">
          <div className="dsa-col-head apps-comments-head">
            <div>
              <h2 className="dsa-col-heading">Comments</h2>
              {!readOnly ? (
                <>
                  <p className="muted dsa-log-hint">
                    Select text and right click to add comment
                  </p>
                  <p className="apps-comments-prompt">
                    What does this reveal about the motivation driving this hire? What
                    capabilities does the company need, want, or not need for this role?
                  </p>
                </>
              ) : null}
            </div>
          </div>
          <div className="apps-comments-scroll" ref={railRef}>
            {anchored.length || detached.length ? (
              readOnly || showEditor ? (
                <div className="apps-comments-list">
                  {[...anchored, ...detached].map((a) => (
                    <CommentCard
                      key={a.id}
                      annotation={a}
                      active={activeId === a.id}
                      readOnly={readOnly}
                      detached={a.start < 0}
                      cardRef={(el) => {
                        if (el) commentRefs.current.set(a.id, el)
                        else commentRefs.current.delete(a.id)
                      }}
                      onFocus={() => (showEditor ? setActiveId(a.id) : focusAnnotation(a.id))}
                      onBody={readOnly ? () => {} : (body) => patchAnnotation(a.id, body)}
                      onRemove={readOnly ? () => {} : () => removeAnnotation(a.id)}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {anchored.length ? (
                    <div
                      className="apps-comments-rail"
                      style={{ minHeight: lastRailHeight(commentTops, anchored) }}
                    >
                      {anchored.map((a) => (
                        <CommentCard
                          key={a.id}
                          annotation={a}
                          active={activeId === a.id}
                          top={commentTops[a.id]}
                          readOnly={false}
                          cardRef={(el) => {
                            if (el) commentRefs.current.set(a.id, el)
                            else commentRefs.current.delete(a.id)
                          }}
                          onFocus={() => focusAnnotation(a.id)}
                          onBody={(body) => patchAnnotation(a.id, body)}
                          onRemove={() => removeAnnotation(a.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                  {detached.length ? (
                    <div className="apps-detached">
                      <p className="kicker">Detached</p>
                      <p className="faint">
                        These quotes were not found after the posting was edited.
                      </p>
                      {detached.map((a) => (
                        <CommentCard
                          key={a.id}
                          annotation={a}
                          active={activeId === a.id}
                          readOnly={false}
                          detached
                          cardRef={(el) => {
                            if (el) commentRefs.current.set(a.id, el)
                            else commentRefs.current.delete(a.id)
                          }}
                          onFocus={() => setActiveId(a.id)}
                          onBody={(body) => patchAnnotation(a.id, body)}
                          onRemove={() => removeAnnotation(a.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              )
            ) : readOnly ? (
              <p className="muted apps-comments-empty">No comments on this posting.</p>
            ) : showEditor && !hasSavedText ? (
              <p className="muted apps-comments-empty">
                Comments will appear here after you paste the posting.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {menu && !showEditor ? (
        <div
          className="apps-ctx-menu"
          ref={menuRef}
          style={{ top: menu.y, left: menu.x }}
          role="menu"
        >
          <button type="button" role="menuitem" onClick={addCommentFromPending}>
            Add comment
          </button>
        </div>
      ) : null}
    </div>
  )
}

function lastRailHeight(tops: Record<string, number>, anchored: JdAnnotation[]): number {
  let max = 0
  for (const a of anchored) {
    const t = tops[a.id]
    if (typeof t === 'number') max = Math.max(max, t + 72)
  }
  return max
}

function CommentCard({
  annotation,
  active,
  top,
  readOnly,
  detached,
  cardRef,
  onFocus,
  onBody,
  onRemove,
}: {
  annotation: JdAnnotation
  active: boolean
  top?: number
  readOnly: boolean
  detached?: boolean
  cardRef: (el: HTMLElement | null) => void
  onFocus: () => void
  onBody: (body: string) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, 22)}px`
  }, [annotation.body])

  return (
    <article
      className={`apps-comment-card${active ? ' is-active' : ''}${detached ? ' is-detached' : ''}`}
      style={typeof top === 'number' ? { top } : undefined}
      ref={cardRef}
      onClick={onFocus}
    >
      <div className="apps-comment-meta">
        {annotation.quote ? (
          <blockquote className="apps-comment-quote">{annotation.quote}</blockquote>
        ) : (
          <span className="faint">Comment</span>
        )}
        {!readOnly ? (
          <button
            className="apps-comment-delete"
            type="button"
            aria-label="Delete comment"
            onClick={(e) => {
              e.stopPropagation()
              const hasBody = Boolean(annotation.body.trim())
              if (hasBody && !window.confirm('Delete this comment?')) return
              onRemove()
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {readOnly ? (
        <p className="apps-comment-body">
          {annotation.body.trim() ? annotation.body : <span className="muted">Empty comment</span>}
        </p>
      ) : (
        <textarea
          ref={inputRef}
          className="apps-comment-input"
          placeholder="Note…"
          value={annotation.body}
          onChange={(e) => onBody(e.target.value)}
          onFocus={onFocus}
          rows={1}
        />
      )}
    </article>
  )
}
