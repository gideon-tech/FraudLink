import type { AuditEvent } from '../../domain/types'
export function AuditTimeline({ events }: { events: AuditEvent[] }) { return <div>{events.map(event => <div key={event.id} style={{ borderLeft: '2px solid #DA9133', padding: '0 0 14px 12px' }}><strong>{event.action}</strong><div style={{ fontSize: 12, color: '#555555' }}>{event.userName} · {new Date(event.timestamp).toLocaleString()}</div></div>)}</div> }

