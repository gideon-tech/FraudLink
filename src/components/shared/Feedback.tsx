import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function LoadingButton({ loading, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) { return <button {...props} disabled={loading || props.disabled}>{loading ? 'Working…' : children}</button> }
export function SuccessToast({ children }: { children: ReactNode }) { return <div role="status" style={{ padding: 10, background: '#FFEF97', color: '#5C2E0E', borderRadius: 6 }}>{children}</div> }
export function ErrorToast({ children }: { children: ReactNode }) { return <div role="alert" style={{ padding: 10, background: '#FFEF97', color: '#BC2626', borderRadius: 6 }}>{children}</div> }
export function EmptyState({ title, description }: { title: string; description: string }) { return <div style={{ padding: 28, textAlign: 'center', color: '#555555' }}><strong style={{ color: '#333333' }}>{title}</strong><p>{description}</p></div> }
export function FormError({ children }: { children: ReactNode }) { return <div role="alert" style={{ color: '#BC2626', fontSize: 12 }}>{children}</div> }
