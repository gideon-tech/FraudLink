export type AccessSide = 'SERVICE_PROVIDER' | 'BANK_OF_UGANDA'

export type UserRole =
  | 'FRAUD_ANALYST'
  | 'FRAUD_SUPERVISOR'
  | 'INSTITUTION_ADMIN'
  | 'COMPLIANCE_AUDITOR'
  | 'BOU_OVERSIGHT_OFFICER'
  | 'BOU_ADMINISTRATOR'

export interface RoleAssignment {
  id: string
  userId: string
  accessSide: AccessSide
  institutionId: string
  role: UserRole
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
  assignedBy: string
  assignedAt: string
  reason?: string
}

export interface DemoUser {
  id: string
  fullName: string
  email: string
  phone?: string
  initials: string
  status: 'ACTIVE' | 'SUSPENDED'
  mfaEnabled: boolean
  roleAssignments: RoleAssignment[]
  lastLogin?: string
}

export interface DemoSession {
  userId: string
  assignmentId: string
  mfaVerified: boolean
  startedAt: string
}

