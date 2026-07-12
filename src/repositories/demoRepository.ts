import { DEMO_INSTITUTIONS, DEMO_USERS } from '../data/demoUsers'
import type { DemoState, AuditEvent } from '../domain/types'

const STORAGE_KEY = 'fraudlink_team4_demo_v2'
const listeners = new Set<() => void>()

const cloneSeed = (): DemoState => ({
  users: structuredClone(DEMO_USERS), institutions: structuredClone(DEMO_INSTITUTIONS), auditEvents: [],
  intelligence: [], indicatorProposals: [], disclosureDecisions: [], reportSchedules: [], apiKeys: [], institutionApplications: [], session: null,
})

let memoryState: DemoState = cloneSeed()

function load(): DemoState {
  if (typeof window === 'undefined') return memoryState
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) memoryState = { ...cloneSeed(), ...JSON.parse(saved) }
  } catch { /* Corrupt or unavailable storage falls back to safe synthetic seed data. */ }
  return memoryState
}

load()

function persist(next: DemoState) {
  memoryState = next
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  listeners.forEach(listener => listener())
}

export const demoRepository = {
  getSnapshot: () => memoryState,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
  update(mutator: (state: DemoState) => DemoState) { persist(mutator(structuredClone(memoryState))) },
  reset() { persist(cloneSeed()) },
  addAudit(event: Omit<AuditEvent, 'id' | 'timestamp'>) {
    const record: AuditEvent = { ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() }
    this.update(state => ({ ...state, auditEvents: [record, ...state.auditEvents] }))
    return record
  },
}

