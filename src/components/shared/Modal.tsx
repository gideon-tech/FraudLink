import { useEffect, useRef, type ReactNode } from 'react'

export function ConfirmationModal({ title, children, confirmLabel = 'Save', danger = false, loading = false, onConfirm, onClose }: { title: string; children: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
      if (event.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(item => !item.hasAttribute('disabled'))
        if (!items.length) return
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [loading, onClose])
  return <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget && !loading) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(77,36,18,.48)', display: 'grid', placeItems: 'center', padding: 24 }}><div ref={dialogRef} tabIndex={-1} className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 24px 60px rgba(77,36,18,.25)', outline: 'none' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}><h2 style={{ margin: 0, fontFamily: 'Manrope', fontSize: 18, color: '#333333' }}>{title}</h2><button type="button" aria-label="Close" disabled={loading} onClick={onClose} style={{ border: 0, background: 'none', color: '#555555', cursor: 'pointer', fontSize: 22 }}>×</button></div><div style={{ fontSize: 13, color: '#555555', lineHeight: 1.55 }}>{children}</div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}><button type="button" className="btn-secondary" disabled={loading} onClick={onClose}>Cancel</button><button type="button" className={danger ? 'btn-danger' : 'btn-primary'} disabled={loading} onClick={onConfirm}>{loading ? 'Working…' : confirmLabel}</button></div></div></div>
}

export const DestructiveActionModal = ConfirmationModal
export const FormModal = ConfirmationModal

