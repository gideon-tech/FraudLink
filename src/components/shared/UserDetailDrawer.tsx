import type { DemoUser } from '../../auth/types'
export function UserDetailDrawer({ user, onClose }: { user: DemoUser; onClose: () => void }) { return <aside aria-label={`${user.fullName} details`} style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, background: '#fff', zIndex: 900, padding: 24, boxShadow: '-8px 0 30px rgba(77,36,18,.15)' }}><button onClick={onClose} aria-label="Close user details">×</button><h2>{user.fullName}</h2><p>{user.email}</p><p>{user.roleAssignments.length} role assignment(s)</p></aside> }

