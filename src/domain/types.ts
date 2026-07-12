import type { UserRole } from '../auth/types'

export interface AuditEvent {
  id: string; timestamp: string; userId: string; userName: string; institution: string; role: UserRole
  action: string; resourceType: string; resourceReference: string; result: 'SUCCESS' | 'FAILED'; reason?: string
  previousValue?: unknown; newValue?: unknown
}

export interface DemoState {
  users: import('../auth/types').DemoUser[]
  institutions: Array<{ id: string; name: string; code: string; accessSide: import('../auth/types').AccessSide; status: string }>
  auditEvents: AuditEvent[]
  intelligence: Record<string, unknown>[]
  indicatorProposals: Record<string, unknown>[]
  disclosureDecisions: Record<string, unknown>[]
  reportSchedules: Record<string, unknown>[]
  apiKeys: Record<string, unknown>[]
  institutionApplications: Record<string, unknown>[]
  session: import('../auth/types').DemoSession | null
}
