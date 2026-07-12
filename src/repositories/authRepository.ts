import type { AccessSide, DemoSession } from '../auth/types'
import { DEMO_PASSWORD } from '../data/demoUsers'
import { demoRepository } from './demoRepository'

export const authRepository = {
  login(userId: string, assignmentId: string, password: string, accessSide: AccessSide): DemoSession {
    const user = demoRepository.getSnapshot().users.find(candidate => candidate.id === userId)
    if (!user || user.status === 'SUSPENDED') throw new Error('This demonstration user is suspended.')
    const assignment = user.roleAssignments.find(candidate => candidate.id === assignmentId && candidate.accessSide === accessSide && candidate.status === 'ACTIVE')
    if (!assignment) throw new Error('No active role is assigned for this access mode.')
    if (password !== DEMO_PASSWORD) throw new Error('Email or password is incorrect.')
    const session = { userId, assignmentId, mfaVerified: false, startedAt: new Date().toISOString() }
    demoRepository.update(state => ({ ...state, session }))
    return session
  },
  verifyMfa(code: string) {
    if (code !== '123456') throw new Error('Incorrect verification code.')
    demoRepository.update(state => state.session ? ({ ...state, session: { ...state.session, mfaVerified: true } }) : state)
  },
  switchRole(assignmentId: string) {
    demoRepository.update(state => {
      if (!state.session) return state
      const user = state.users.find(candidate => candidate.id === state.session?.userId)
      if (!user?.roleAssignments.some(role => role.id === assignmentId && role.status === 'ACTIVE')) throw new Error('That role is not assigned to this user.')
      return { ...state, session: { ...state.session, assignmentId } }
    })
  },
  logout() { demoRepository.update(state => ({ ...state, session: null })) },
}

