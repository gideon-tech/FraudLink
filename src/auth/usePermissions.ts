import { useSyncExternalStore } from 'react'
import type { Permission } from './permissions'
import { roleHasPermission } from './rolePermissions'
import { demoRepository } from '../repositories/demoRepository'

export function useDemoState() {
  return useSyncExternalStore(demoRepository.subscribe, demoRepository.getSnapshot, demoRepository.getSnapshot)
}

export function useCurrentAccess() {
  const state = useDemoState()
  const user = state.users.find(candidate => candidate.id === state.session?.userId)
  const assignment = user?.roleAssignments.find(candidate => candidate.id === state.session?.assignmentId)
  const institution = state.institutions.find(candidate => candidate.id === assignment?.institutionId)
  return { state, session: state.session, user, assignment, institution }
}

export function usePermissions() {
  const { assignment } = useCurrentAccess()
  return {
    role: assignment?.role,
    can: (permission: Permission) => Boolean(assignment && assignment.status === 'ACTIVE' && roleHasPermission(assignment.role, permission)),
  }
}

