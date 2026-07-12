import type { DemoUser, RoleAssignment } from '../auth/types'
import { demoRepository } from './demoRepository'

export const userRepository = {
  list: () => demoRepository.getSnapshot().users,
  save(user: DemoUser) {
    demoRepository.update(state => ({ ...state, users: state.users.some(item => item.id === user.id) ? state.users.map(item => item.id === user.id ? user : item) : [...state.users, user] }))
  },
  assignRole(userId: string, assignment: RoleAssignment) {
    demoRepository.update(state => ({ ...state, users: state.users.map(user => user.id === userId ? { ...user, roleAssignments: [...user.roleAssignments, assignment] } : user) }))
  },
}

