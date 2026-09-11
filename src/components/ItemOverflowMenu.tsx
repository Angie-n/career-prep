import { useEffect, useRef, useState } from 'react'

export function ItemOverflowMenu({
  label = 'Options',
  deleteLabel = 'Delete',
  onDelete,
}: {
  label?: string
  deleteLabel?: string
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`apps-application-menu${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        className="apps-application-menu-trigger"
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        title={label}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="5" r="1.5" fill="currentColor" />
          <circle cx="8" cy="11" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className="apps-application-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="apps-application-menu-item"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onDelete()
            }}
          >
            {deleteLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
