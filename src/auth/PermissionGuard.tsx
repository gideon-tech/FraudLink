import type { ReactNode } from 'react'
import type { Permission } from './permissions'
import { usePermissions } from './usePermissions'

export function PermissionGuard({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { can } = usePermissions()
  return can(permission) ? children : fallback
}

