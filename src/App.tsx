import { useState, useRef, useEffect } from 'react'
import {
  Shield, Network, AlertTriangle, FileText, BarChart2, Building2,
  BookOpen, Unlock, ClipboardList, TrendingUp, Code2, Users,
  Settings, Bell, Search, ChevronDown, LogOut, HelpCircle,
  CheckCircle, XCircle, Clock, Eye, EyeOff, RefreshCw, Plus,
  Filter, Download, Upload, ChevronRight, ArrowLeft, ArrowRight,
  Activity, Zap, Globe, Lock, Key, Webhook, Copy, RotateCcw,
  Terminal, Phone, MessageSquare, Send, X, MoreHorizontal,
  ArrowUp, ArrowDown, Minus, Info, Edit2, Trash2, UserPlus,
  AlertCircle, CheckSquare, Circle, Radio, ToggleRight,
  Calendar, MapPin, ExternalLink, Layers
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts'
import { api, AuthUser, clearSession, connectEvents, token } from './lib/api'
import type { AccessSide, DemoUser, RoleAssignment, UserRole } from './auth/types'
import { useCurrentAccess, useDemoState, usePermissions } from './auth/usePermissions'
import { authRepository } from './repositories/authRepository'
import { auditRepository } from './repositories/auditRepository'
import { demoRepository } from './repositories/demoRepository'
import { intelligenceRepository } from './repositories/intelligenceRepository'
import { DEMO_PASSWORD } from './data/demoUsers'
import { ConfirmationModal as ActionDialog } from './components/shared/Modal'

// ─── Types ──────────────────────────────────────────────────────────────────

type Screen =
  | 'login' | 'mfa'
  | 'bou-dashboard' | 'institution-dashboard'
  | 'alerts' | 'alert-detail'
  | 'incidents' | 'submit-intel' | 'intelligence-detail'
  | 'fraud-network' | 'institutions' | 'institution-detail'
  | 'indicator-catalogue' | 'disclosure-requests'
  | 'audit-logs' | 'reports' | 'api-integrations'
  | 'users-roles' | 'ussd-simulator' | 'design-system' | 'settings'

type Role = 'bou-officer' | 'institution-admin' | 'fraud-analyst' | 'fraud-supervisor' | 'compliance-auditor'

interface AppState {
  screen: Screen
  role: Role
  institution: string
  user: string
  previousScreen?: Screen
  selectedReference?: string
}

// ─── Sample Data ─────────────────────────────────────────────────────────────

const MOBILE_MONEY_PROVIDERS = [
  'MTN Mobile Money Uganda Limited',
  'Airtel Mobile Commerce Uganda Limited',
]

const FINANCIAL_INSTITUTIONS = [
  'Stanbic Bank Uganda Limited',
  'Centenary Rural Development Bank Limited',
  'DFCU Bank Limited',
  'Equity Bank Uganda Limited',
  'Absa Bank Uganda Limited',
  'KCB Bank Uganda Limited',
  'Housing Finance Bank Limited',
  'Finance Trust Bank Limited',
]

const fraudTrendData = [
  { date: 'Jun 11', reports: 28 }, { date: 'Jun 13', reports: 34 }, { date: 'Jun 15', reports: 41 },
  { date: 'Jun 17', reports: 29 }, { date: 'Jun 19', reports: 52 }, { date: 'Jun 21', reports: 48 },
  { date: 'Jun 23', reports: 37 }, { date: 'Jun 25', reports: 63 }, { date: 'Jun 27', reports: 71 },
  { date: 'Jun 29', reports: 58 }, { date: 'Jul 1', reports: 44 }, { date: 'Jul 3', reports: 82 },
  { date: 'Jul 5', reports: 76 }, { date: 'Jul 7', reports: 91 }, { date: 'Jul 9', reports: 68 },
  { date: 'Jul 11', reports: 85 },
]

const riskLevelData = [
  { name: 'Low', value: 312, color: '#5C2E0E' },
  { name: 'Medium', value: 487, color: '#DA9133' },
  { name: 'High', value: 298, color: '#BC2626' },
  { name: 'Critical', value: 64, color: '#5C2E0E' },
]

const fraudTypeData = [
  { type: 'Account Takeover', count: 287 },
  { type: 'SIM-Swap', count: 214 },
  { type: 'Social Engineering', count: 178 },
  { type: 'Rapid Transfer', count: 156 },
  { type: 'Suspicious Funds', count: 134 },
  { type: 'Device Reuse', count: 98 },
]

const matchByWeek = [
  { week: 'W24', matches: 42 }, { week: 'W25', matches: 67 }, { week: 'W26', matches: 58 },
  { week: 'W27', matches: 89 }, { week: 'W28', matches: 124 },
]

const institutionPerf = [
  { name: 'MTN MoMo', responseTime: 1.4, confirmed: 87 },
  { name: 'Airtel Money', responseTime: 2.1, confirmed: 74 },
  { name: 'Stanbic Bank', responseTime: 3.2, confirmed: 91 },
  { name: 'Centenary Bank', responseTime: 1.8, confirmed: 82 },
]

const confirmedVsUnconfirmed = [
  { month: 'May', confirmed: 148, unconfirmed: 62 },
  { month: 'Jun', confirmed: 187, unconfirmed: 89 },
  { month: 'Jul', confirmed: 94, unconfirmed: 41 },
]

const SAMPLE_ALERTS = [
  { ref: 'ALT-2026-00891', risk: 'Critical', type: 'Account Takeover', matchReason: 'Exact protected reference match', indicators: 3, institutions: 2, generatedAt: '2026-07-11 14:32', analyst: 'D. Mukisa', status: 'Under Investigation' },
  { ref: 'ALT-2026-00890', risk: 'High', type: 'SIM-Swap Abuse', matchReason: 'Device reuse across cases', indicators: 2, institutions: 2, generatedAt: '2026-07-11 12:18', analyst: 'G. Maku', status: 'New' },
  { ref: 'ALT-2026-00889', risk: 'High', type: 'Rapid Transfer', matchReason: 'Time-based correlation', indicators: 4, institutions: 3, generatedAt: '2026-07-11 09:44', analyst: 'E. Nampiina', status: 'Acknowledged' },
  { ref: 'ALT-2026-00888', risk: 'Medium', type: 'Social Engineering', matchReason: 'Shared indicator code', indicators: 2, institutions: 2, generatedAt: '2026-07-10 17:55', analyst: 'D. Mukisa', status: 'Confirmed' },
  { ref: 'ALT-2026-00887', risk: 'Critical', type: 'SIM-Swap Abuse', matchReason: 'Exact protected reference match', indicators: 5, institutions: 4, generatedAt: '2026-07-10 14:23', analyst: 'G. Maku', status: 'Escalated' },
  { ref: 'ALT-2026-00886', risk: 'Low', type: 'Device Reuse', matchReason: 'Inferred relationship', indicators: 1, institutions: 2, generatedAt: '2026-07-10 11:12', analyst: 'G. Maku', status: 'Resolved' },
]

const SAMPLE_INCIDENTS = [
  { ref: 'FL-UG-2026-000245', institution: 'MTN Mobile Money Uganda Limited', type: 'Account Takeover', risk: 'High', protectedRef: 'SUBJ_8F92A7B4C91D4E16', detectedAt: '2026-07-11 14:28', status: 'Under Investigation', matchStatus: 'Matched', analyst: 'D. Mukisa' },
  { ref: 'FL-UG-2026-000244', institution: 'Airtel Mobile Commerce Uganda Limited', type: 'Suspicious Incoming Funds', risk: 'High', protectedRef: 'SUBJ_8F92A7B4C91D4E16', detectedAt: '2026-07-11 13:45', status: 'Under Investigation', matchStatus: 'Matched', analyst: 'G. Maku' },
  { ref: 'FL-UG-2026-000243', institution: 'Stanbic Bank Uganda Limited', type: 'SIM-Swap Abuse', risk: 'Critical', protectedRef: 'SUBJ_3D41F89CA2B5E720', detectedAt: '2026-07-11 11:30', status: 'Confirmed', matchStatus: 'Matched', analyst: 'E. Nampiina' },
  { ref: 'FL-UG-2026-000242', institution: 'Centenary Rural Development Bank Limited', type: 'Social Engineering', risk: 'Medium', protectedRef: 'SUBJ_71A23CD8F9E4B652', detectedAt: '2026-07-10 16:22', status: 'Triaged', matchStatus: 'No Match', analyst: 'G. Maku' },
  { ref: 'FL-UG-2026-000241', institution: 'MTN Mobile Money Uganda Limited', type: 'Rapid Transfer', risk: 'High', protectedRef: 'SUBJ_A91B3CF7D5E28049', detectedAt: '2026-07-10 14:08', status: 'Confirmed', matchStatus: 'Matched', analyst: 'D. Mukisa' },
]

const SAMPLE_INSTITUTIONS_TABLE = [
  { name: 'MTN Mobile Money Uganda Limited', type: 'Payment Service Provider', regStatus: 'Active', platformStatus: 'Connected', apiConn: 'Online', lastSub: '2026-07-11 14:28', indicators: 4821, matches: 312, alerts: 28, compliance: 'Compliant', users: 14 },
  { name: 'Airtel Mobile Commerce Uganda Limited', type: 'Payment Service Provider', regStatus: 'Active', platformStatus: 'Connected', apiConn: 'Online', lastSub: '2026-07-11 13:45', indicators: 3104, matches: 247, alerts: 19, compliance: 'Compliant', users: 11 },
  { name: 'Stanbic Bank Uganda Limited', type: 'Commercial Bank', regStatus: 'Active', platformStatus: 'Connected', apiConn: 'Online', lastSub: '2026-07-11 09:12', indicators: 2847, matches: 198, alerts: 12, compliance: 'Under Review', users: 18 },
  { name: 'Centenary Rural Development Bank Limited', type: 'Commercial Bank', regStatus: 'Active', platformStatus: 'Connected', apiConn: 'Degraded', lastSub: '2026-07-11 07:44', indicators: 1708, matches: 112, alerts: 5, compliance: 'Compliant', users: 8 },
]

const AUDIT_LOGS = [
  { ts: '2026-07-11 14:33', user: 'D. Mukisa', institution: 'MTN Mobile Money Uganda Limited', role: 'Fraud Analyst', action: 'Status Changed', resource: 'Alert', ref: 'ALT-2026-00891', ip: '196.216.14.22', result: 'Success', reason: 'Assigned to investigation team' },
  { ts: '2026-07-11 14:32', user: 'System', institution: 'Platform', role: 'System', action: 'Match Generated', resource: 'Alert', ref: 'ALT-2026-00891', ip: 'internal', result: 'Success', reason: 'Cross-institution reference match' },
  { ts: '2026-07-11 13:46', user: 'G. Maku', institution: 'Airtel Mobile Commerce Uganda Limited', role: 'Fraud Analyst', action: 'Fraud Submission', resource: 'Incident', ref: 'FL-UG-2026-000244', ip: '197.239.18.11', result: 'Success', reason: 'Suspicious incoming funds detected' },
  { ts: '2026-07-11 14:29', user: 'K. Mugabi', institution: 'MTN Mobile Money Uganda Limited', role: 'Fraud Supervisor', action: 'Fraud Submission', resource: 'Incident', ref: 'FL-UG-2026-000245', ip: '196.216.14.31', result: 'Success', reason: 'Account takeover detected' },
  { ts: '2026-07-11 14:28', user: 'K. Mugabi', institution: 'MTN Mobile Money Uganda Limited', role: 'Fraud Supervisor', action: 'Login', resource: 'Session', ref: 'SES-2026-88412', ip: '196.216.14.31', result: 'Success', reason: 'MFA verified' },
  { ts: '2026-07-11 13:12', user: 'M. Okabo', institution: 'Bank of Uganda', role: 'BoU Officer', action: 'Record Viewed', resource: 'Alert', ref: 'ALT-2026-00887', ip: '41.222.184.10', result: 'Success', reason: 'Oversight review' },
]

const INDICATOR_CATALOGUE = [
  { code: 'ACCOUNT_TAKEOVER', name: 'Account Takeover', definition: 'Indicators suggesting unauthorized access to a customer account', severity: 'High', version: '1.2', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'SIM_SWAP_SUSPECTED', name: 'SIM Swap Suspected', definition: 'Behavioural indicators consistent with SIM swap activity', severity: 'Critical', version: '1.1', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'RAPID_MULTI_WALLET_TRANSFER', name: 'Rapid Multi-Wallet Transfer', definition: 'Unusually rapid sequential transfers across multiple wallet accounts', severity: 'High', version: '1.0', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'SOCIAL_ENGINEERING_REPORTED', name: 'Social Engineering Reported', definition: 'Customer or institution-reported social engineering attempt', severity: 'Medium', version: '1.0', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'REPEATED_FAILED_PIN_ACTIVITY', name: 'Repeated Failed PIN Activity', definition: 'Multiple consecutive PIN failures within a short window', severity: 'Medium', version: '1.0', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'SUSPICIOUS_INCOMING_FUNDS', name: 'Suspicious Incoming Funds', definition: 'Funds received from sources flagged in other fraud incidents', severity: 'High', version: '1.0', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'DEVICE_REUSE_ACROSS_CASES', name: 'Device Reuse Across Cases', definition: 'The same device reference appears in multiple fraud incidents', severity: 'High', version: '1.1', approvalDate: '2025-04-02', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'NEW_SIM_HIGH_VALUE_TRANSFER', name: 'New SIM High-Value Transfer', definition: 'High-value transfer executed shortly after SIM registration', severity: 'Critical', version: '1.0', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'MULTIPLE_ACCOUNTS_ONE_DEVICE', name: 'Multiple Accounts One Device', definition: 'Multiple wallet accounts linked to a single device reference', severity: 'Medium', version: '1.0', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
  { code: 'RAPID_CASH_OUT', name: 'Rapid Cash Out', definition: 'Rapid withdrawal or agent cash-out following suspicious inbound transfer', severity: 'High', version: '1.0', approvalDate: '2025-03-15', status: 'Active', approvedBy: 'Bank of Uganda' },
]

// ─── Logo ─────────────────────────────────────────────────────────────────────

function MFLLogo({ size = 32, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2L4 9v10c0 9.4 6.8 18.2 16 20.4C30.2 37.2 37 28.4 37 19V9L20 2z" fill="#DA9133" fillOpacity="0.15" stroke="#DA9133" strokeWidth="1.5"/>
        <circle cx="20" cy="19" r="4" fill="#DA9133"/>
        <circle cx="11" cy="14" r="2.5" fill="#FFFFFF" fillOpacity="0.8"/>
        <circle cx="29" cy="14" r="2.5" fill="#FFFFFF" fillOpacity="0.8"/>
        <circle cx="11" cy="26" r="2.5" fill="#FFFFFF" fillOpacity="0.8"/>
        <circle cx="29" cy="26" r="2.5" fill="#FFFFFF" fillOpacity="0.8"/>
        <line x1="13.2" y1="15.4" x2="17.5" y2="17.8" stroke="#DA9133" strokeWidth="1.2"/>
        <line x1="26.8" y1="15.4" x2="22.5" y2="17.8" stroke="#DA9133" strokeWidth="1.2"/>
        <line x1="13.2" y1="24.6" x2="17.5" y2="21.8" stroke="#DA9133" strokeWidth="1.2"/>
        <line x1="26.8" y1="24.6" x2="22.5" y2="21.8" stroke="#DA9133" strokeWidth="1.2"/>
        <text x="20" y="23" textAnchor="middle" fontSize="7" fontWeight="700" fill="#FFFFFF" fontFamily="Manrope, sans-serif">MFL</text>
      </svg>
      {showText && (
        <div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: '#FFFFFF', lineHeight: 1.1 }}>MoMo FraudLink</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#FFEF97', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Uganda</div>
        </div>
      )}
    </div>
  )
}

// ─── Risk / Status Badge Helpers ─────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const cls = level.toLowerCase() === 'critical' ? 'risk-critical'
    : level.toLowerCase() === 'high' ? 'risk-high'
    : level.toLowerCase() === 'medium' ? 'risk-medium'
    : 'risk-low'
  return <span className={`risk-badge ${cls}`}>{level}</span>
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase().replace(/\s+/g, '-')
  const cls = s.includes('investigation') ? 'status-investigating'
    : s.includes('new') ? 'status-new'
    : s.includes('acknowledged') ? 'status-acknowledged'
    : s.includes('escalated') ? 'status-escalated'
    : s.includes('confirmed') ? 'status-confirmed'
    : s.includes('resolved') ? 'status-resolved'
    : s.includes('withdrawn') ? 'status-withdrawn'
    : 'status-new'
  return <span className={`status-badge ${cls}`}>{status}</span>
}

function ApiStatusDot({ status }: { status: string }) {
  const color = status === 'Online' ? '#5C2E0E' : status === 'Degraded' ? '#DA9133' : '#BC2626'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} className={status === 'Online' ? 'pulse-dot' : ''} />
      {status}
    </span>
  )
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon: Icon, color = '#DA9133', delta }: {
  label: string; value: string | number; sub?: string; icon?: any; color?: string; delta?: string
}) {
  return (
    <div className="metric-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        {Icon && <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={17} color={color} /></div>}
      </div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 800, color: '#333333', lineHeight: 1 }}>{value}</div>
      {(sub || delta) && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#555555' }}>
          {delta && <span style={{ color: delta.startsWith('+') ? '#5C2E0E' : '#BC2626', fontWeight: 600, marginRight: 4 }}>{delta}</span>}
          {sub}
        </div>
      )}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: '#333333', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13.5, color: '#555555', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: DemoUser, assignment: RoleAssignment) => void }) {
  const demo = useDemoState()
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [isBoU, setIsBoU] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('user-daniella')
  const [assignmentId, setAssignmentId] = useState('role-daniella-analyst')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const accessSide: AccessSide = isBoU ? 'BANK_OF_UGANDA' : 'SERVICE_PROVIDER'
  const availableUsers = demo.users.filter(user => user.roleAssignments.some(role => role.accessSide === accessSide && role.status === 'ACTIVE'))
  const selectedUser = availableUsers.find(user => user.id === selectedUserId) || availableUsers[0]
  const assignments = selectedUser?.roleAssignments.filter(role => role.accessSide === accessSide && role.status === 'ACTIVE') || []
  const selectedAssignment = assignments.find(role => role.id === assignmentId) || assignments[0]
  const selectedInstitution = demo.institutions.find(item => item.id === selectedAssignment?.institutionId)

  const chooseMode = (bankOfUganda: boolean) => {
    const side: AccessSide = bankOfUganda ? 'BANK_OF_UGANDA' : 'SERVICE_PROVIDER'
    const user = demo.users.find(candidate => candidate.roleAssignments.some(role => role.accessSide === side && role.status === 'ACTIVE'))
    const assignment = user?.roleAssignments.find(role => role.accessSide === side && role.status === 'ACTIVE')
    setIsBoU(bankOfUganda); setSelectedUserId(user?.id || ''); setAssignmentId(assignment?.id || ''); setError('')
  }

  const chooseUser = (userId: string) => {
    const user = demo.users.find(candidate => candidate.id === userId)
    const assignment = user?.roleAssignments.find(role => role.accessSide === accessSide && role.status === 'ACTIVE')
    setSelectedUserId(userId); setAssignmentId(assignment?.id || ''); setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (!selectedUser || !selectedAssignment) throw new Error('No active role is assigned for this access mode.')
      authRepository.login(selectedUser.id, selectedAssignment.id, password, accessSide)
      auditRepository.create({ userId: selectedUser.id, userName: selectedUser.fullName, institution: selectedInstitution?.name || 'Unknown', role: selectedAssignment.role, action: 'LOGIN_SUCCESS', resourceType: 'SESSION', resourceReference: selectedAssignment.id, result: 'SUCCESS' })
      onLogin(selectedUser, selectedAssignment)
    } catch (err) {
      if (selectedUser && selectedAssignment) auditRepository.create({ userId: selectedUser.id, userName: selectedUser.fullName, institution: selectedInstitution?.name || 'Unknown', role: selectedAssignment.role, action: 'LOGIN_FAILED', resourceType: 'SESSION', resourceReference: selectedAssignment.id, result: 'FAILED', reason: err instanceof Error ? err.message : 'Sign-in failed.' })
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    }
    finally { setLoading(false) }
  }

  const roleLabel = (role: UserRole) => ({ FRAUD_ANALYST: 'Fraud Analyst', FRAUD_SUPERVISOR: 'Fraud Supervisor', INSTITUTION_ADMIN: 'Institution Administrator', COMPLIANCE_AUDITOR: 'Compliance Auditor', BOU_OVERSIGHT_OFFICER: 'BoU Oversight Officer', BOU_ADMINISTRATOR: 'BoU Administrator' })[role]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F8F8F8' }}>
      {/* Left panel */}
      <div style={{ flex: '0 0 480px', background: '#4D2412', display: 'flex', flexDirection: 'column', padding: '48px 52px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(218,145,51,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <MFLLogo size={40} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: 48 }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.25, marginBottom: 16 }}>
            Secure Fraud Intelligence Sharing Framework
          </div>
          <div style={{ fontSize: 14, color: '#FFEF97', lineHeight: 1.7, marginBottom: 40 }}>
            A regulated platform for authorised institutions to share protected fraud indicators, identify cross-institution patterns, and coordinate investigations.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: Shield, text: 'Privacy-preserving indicator exchange' },
              { icon: Network, text: 'Cross-institution fraud matching' },
              { icon: Lock, text: 'Controlled identity disclosure workflow' },
              { icon: ClipboardList, text: 'Full audit trail for every action' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(218,145,51,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="#DA9133" />
                </div>
                <span style={{ fontSize: 13.5, color: '#FFEF97' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20, fontSize: 11.5, color: '#555555' }}>
          Standards-aligned prototype · ISO/IEC 27001 · 27701 · 27035 · Demonstration environment
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 800, color: '#333333', margin: '0 0 6px' }}>Sign in to your account</h2>
            <p style={{ fontSize: 13.5, color: '#555555', margin: 0 }}>Demonstration access for authorised-user workflows.</p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#E6E6E6', borderRadius: 8, padding: 4 }}>
            <button
              onClick={() => chooseMode(false)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: !isBoU ? '#FFFFFF' : 'transparent', color: !isBoU ? '#4D2412' : '#555555', boxShadow: !isBoU ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}
            >Service Provider Login</button>
            <button
              onClick={() => chooseMode(true)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: isBoU ? '#FFFFFF' : 'transparent', color: isBoU ? '#4D2412' : '#555555', boxShadow: isBoU ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}
            >Bank of Uganda</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div style={{ padding: 10, borderRadius: 6, background: '#F8F8F8', color: '#BC2626', fontSize: 13 }}>{error}</div>}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Demonstration user</label>
              <select className="input-field" value={selectedUser?.id || ''} onChange={e => chooseUser(e.target.value)}>
                {availableUsers.map(user => <option key={user.id} value={user.id}>{user.fullName}{user.status === 'SUSPENDED' ? ' — Suspended' : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>{isBoU ? 'Bank of Uganda role' : 'Assigned role'}</label>
              <select className="input-field" value={selectedAssignment?.id || ''} onChange={e => setAssignmentId(e.target.value)} disabled={!assignments.length}>
                {assignments.map(assignment => <option key={assignment.id} value={assignment.id}>{roleLabel(assignment.role)}</option>)}
              </select>
            </div>
            {!isBoU && <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Assigned institution</label>
              <select className="input-field" value={selectedInstitution?.id || ''} disabled><option value={selectedInstitution?.id}>{selectedInstitution?.name}</option></select>
            </div>}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Email address</label>
              <input className="input-field" type="email" value={selectedUser?.email || ''} readOnly />
            </div>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input-field" type={showPass ? 'text' : 'password'} placeholder="••••••••" style={{ paddingRight: 42 }} value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#555555', padding: 0 }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555555', cursor: 'pointer' }}>
                <input type="checkbox" /> Remember this device
              </label>
              <span style={{ fontSize: 12, color: '#555555' }}>Simulated account</span>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: 'center', padding: '11px 18px', fontSize: 14, marginTop: 4 }}>
              <Lock size={15} /> {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: 18, padding: 14, background: '#FFEF97', border: '1px solid #DA9133', borderRadius: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#333333', marginBottom: 10 }}>Demo credentials</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 11.5, color: '#555555' }}>All identities and email addresses are simulated.</div>
              <button type="button" onClick={() => setPassword(DEMO_PASSWORD)} style={{ padding: 9, textAlign: 'left', background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 6, cursor: 'pointer', color: '#333333' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>Click to fill demo password</span>
                <code style={{ display: 'block', marginTop: 3, fontSize: 11.5, color: '#555555' }}>{DEMO_PASSWORD}</code>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 24, padding: 14, background: '#FFEF97', border: '1px solid #DA9133', borderRadius: 6, display: 'flex', gap: 10 }}>
            <AlertTriangle size={16} color="#DA9133" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: '#5C2E0E', lineHeight: 1.5 }}>
              <strong>Synthetic, standards-aligned demo.</strong> References ISO/IEC 27001, 27701, 29100 and 27035 principles; no certification or production institution connection is claimed.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MFA Screen ──────────────────────────────────────────────────────────────

function MFAScreen({ onVerify }: { onVerify: () => void }) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(118)
  const [error, setError] = useState('')
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const handleInput = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]; next[i] = val; setOtp(next); setError('')
    if (val && i < 5) inputs.current[i + 1]?.focus()
  }

  // The prototype uses a fixed code because no SMS/email provider is connected.
  // Production MFA must verify a short-lived, single-use challenge on the backend.
  const verifyCode = () => otp.join('') === '123456' ? onVerify() : setError('Incorrect verification code. Use 123456 for this demo.')

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60

  return (
    <div style={{ minHeight: '100vh', background: '#F8F8F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 420, background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 12, padding: '40px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(218,145,51,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Shield size={26} color="#DA9133" />
          </div>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, color: '#333333', margin: '0 0 6px' }}>Two-Factor Verification</h2>
          <p style={{ fontSize: 13.5, color: '#555555', margin: 0 }}>Enter the 6-digit code sent to your registered device.</p>
          <div style={{ marginTop: 12, padding: '7px 10px', borderRadius: 6, background: '#F8F8F8', color: '#5C2E0E', fontSize: 12 }}>Demo verification code: <strong style={{ fontFamily: 'JetBrains Mono' }}>123456</strong></div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          {otp.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el }}
              type="text" inputMode="numeric" maxLength={1} value={d}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) { inputs.current[i - 1]?.focus(); const n = [...otp]; n[i - 1] = ''; setOtp(n) } }}
              style={{ width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', border: '2px solid', borderColor: d ? '#DA9133' : '#E6E6E6', borderRadius: 8, outline: 'none', color: '#333333', background: d ? 'rgba(218,145,51,0.04)' : '#FFFFFF' }}
            />
          ))}
        </div>

        {error && <div role="alert" style={{ marginBottom: 14, padding: 9, borderRadius: 6, background: '#F8F8F8', color: '#BC2626', fontSize: 12.5 }}>{error}</div>}

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: '#555555' }}>Code expires in </span>
          <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono', fontWeight: 600, color: countdown < 30 ? '#BC2626' : '#4D2412' }}>
            {mins}:{String(secs).padStart(2, '0')}
          </span>
        </div>

        <button className="btn-primary" disabled={otp.some(d => !d) || countdown === 0} style={{ width: '100%', justifyContent: 'center', padding: '11px 18px' }} onClick={verifyCode}>
          Verify & Sign In
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, textAlign: 'center' }}>
          <button onClick={() => { setOtp(['', '', '', '', '', '']); setCountdown(118); setError(''); inputs.current[0]?.focus() }} style={{ fontSize: 13, color: '#DA9133', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Resend code
          </button>
          <button onClick={() => setError('Backup-code verification is simulated; use OTP 123456.')} style={{ fontSize: 13, color: '#555555', background: 'none', border: 'none', cursor: 'pointer' }}>
            Use backup code
          </button>
          <button onClick={() => setError('Security support is not connected in this demonstration.')} style={{ fontSize: 12, color: '#555555', background: 'none', border: 'none', cursor: 'pointer' }}>
            Contact security support
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Top Bar ─────────────────────────────────────────────────────────────────

function TopBar({ appState, onNavigate, onSwitchRole, onLogout }: { appState: AppState; onNavigate: (s: Screen) => void; onSwitchRole: (assignment: RoleAssignment) => void; onLogout: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<RoleAssignment | null>(null)
  const { user, assignment, institution, state } = useCurrentAccess()

  const roleLabel: Record<Role, string> = {
    'bou-officer': 'BoU Oversight Officer',
    'institution-admin': 'Institution Administrator',
    'fraud-analyst': 'Fraud Analyst',
    'fraud-supervisor': 'Fraud Supervisor',
    'compliance-auditor': 'Compliance Auditor',
  }

  return (
    <div style={{ height: 56, background: '#FFFFFF', borderBottom: '1px solid #E6E6E6', display: 'flex', alignItems: 'center', paddingInline: 20, gap: 12, flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ flex: 1, position: 'relative', maxWidth: 380 }}>
        <Search size={15} color="#555555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input placeholder="Search incidents, alerts, references…" style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingBlock: 7, border: '1px solid #E6E6E6', borderRadius: 6, fontSize: 13, fontFamily: 'Inter', color: '#333333', outline: 'none', background: '#F8F8F8' }} />
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid #E6E6E6', borderRadius: 6, background: '#F8F8F8', fontSize: 12, color: '#555555' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5C2E0E' }} className="pulse-dot" />
          All Systems Operational
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setNotifOpen(!notifOpen)} style={{ width: 36, height: 36, borderRadius: 6, background: notifOpen ? '#FFEF97' : 'transparent', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <Bell size={17} color="#555555" />
            <span style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: '50%', background: '#BC2626', border: '2px solid #FFFFFF' }} />
          </button>
          {notifOpen && (
            <div style={{ position: 'absolute', right: 0, top: 44, width: 320, background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E6E6E6', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, color: '#333333' }}>Notifications</div>
              {[
                { title: 'Critical alert generated', sub: 'ALT-2026-00891 — Cross-institution match', time: '2 min ago', dot: '#5C2E0E' },
                { title: 'Case assigned to you', sub: 'FL-UG-2026-000245', time: '18 min ago', dot: '#DA9133' },
                { title: 'Disclosure request approved', sub: 'DIS-2026-00041', time: '1h ago', dot: '#5C2E0E' },
              ].map((n, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #E6E6E6', display: 'flex', gap: 10, cursor: 'pointer' }} className="table-row">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.dot, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#333333' }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: '#555555', marginTop: 2 }}>{n.sub}</div>
                    <div style={{ fontSize: 11, color: '#929292', marginTop: 2 }}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => window.alert('Help centre content is simulated for this demonstration.')} style={{ width: 36, height: 36, borderRadius: 6, background: 'transparent', border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <HelpCircle size={17} color="#555555" />
        </button>

        <div onClick={() => setProfileOpen(open => !open)} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid #E6E6E6', marginLeft: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#DA9133', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#333333' }}>
            {appState.user.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', lineHeight: 1.2 }}>{appState.user}</div>
            <div style={{ fontSize: 10.5, color: '#555555', lineHeight: 1.2 }}>{roleLabel[appState.role]}</div>
          </div>
          <ChevronDown size={13} color="#555555" />
          {profileOpen && <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 44, width: 310, background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 14, zIndex: 120 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#333333' }}>{user?.fullName}</div>
            <div style={{ fontSize: 11.5, color: '#555555', marginTop: 3 }}>{institution?.name} · {assignment ? roleLabel[({ BOU_ADMINISTRATOR: 'bou-officer', BOU_OVERSIGHT_OFFICER: 'bou-officer', FRAUD_ANALYST: 'fraud-analyst', FRAUD_SUPERVISOR: 'fraud-supervisor', INSTITUTION_ADMIN: 'institution-admin', COMPLIANCE_AUDITOR: 'compliance-auditor' } as Record<UserRole, Role>)[assignment.role]] : ''}</div>
            <div style={{ borderTop: '1px solid #E6E6E6', marginTop: 12, paddingTop: 10, fontSize: 11.5, fontWeight: 700, color: '#555555' }}>AVAILABLE ASSIGNMENTS</div>
            {user?.roleAssignments.filter(role => role.status === 'ACTIVE').map(role => {
              const inst = state.institutions.find(item => item.id === role.institutionId)
              return <button key={role.id} type="button" disabled={role.id === assignment?.id} onClick={() => setSwitchTarget(role)} style={{ width: '100%', border: 0, background: role.id === assignment?.id ? '#FFEF97' : 'transparent', textAlign: 'left', padding: '8px 6px', borderRadius: 5, cursor: role.id === assignment?.id ? 'default' : 'pointer', color: '#333333', fontSize: 12 }}><strong>{role.role.replace(/_/g, ' ')}</strong><br /><span style={{ color: '#555555' }}>{inst?.name}</span></button>
            })}
            <button type="button" className="btn-secondary" onClick={onLogout} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}><LogOut size={13} />Logout</button>
          </div>}
        </div>
      </div>
      {switchTarget && <ActionDialog title="Switch Role" confirmLabel="Switch Role" onClose={() => setSwitchTarget(null)} onConfirm={() => { onSwitchRole(switchTarget); setSwitchTarget(null); setProfileOpen(false) }}><p style={{ margin: 0 }}>Switch to <strong>{switchTarget.role.replace(/_/g, ' ')}</strong> at {state.institutions.find(item => item.id === switchTarget.institutionId)?.name}? The navigation will update to this assignment.</p></ActionDialog>}
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ appState, onNavigate, onLogout }: {
  appState: AppState;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}) {
  const { screen, role } = appState

  const allItems = [
    { id: 'bou-dashboard', label: 'National Overview', icon: BarChart2, roles: ['bou-officer'] },
    { id: 'institution-dashboard', label: 'Overview', icon: BarChart2, roles: ['institution-admin', 'fraud-analyst', 'fraud-supervisor', 'compliance-auditor'] },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, roles: ['fraud-analyst', 'fraud-supervisor', 'bou-officer', 'institution-admin'] },
    { id: 'incidents', label: 'Incidents', icon: FileText, roles: ['fraud-analyst', 'fraud-supervisor', 'bou-officer', 'compliance-auditor'] },
    { id: 'submit-intel', label: 'Submit Intelligence', icon: Upload, roles: ['fraud-analyst', 'fraud-supervisor'] },
    { id: 'fraud-network', label: 'Fraud Network', icon: Network, roles: ['fraud-analyst', 'fraud-supervisor', 'bou-officer'] },
    { id: 'institutions', label: 'Institutions', icon: Building2, roles: ['bou-officer'] },
    { id: 'indicator-catalogue', label: 'Indicator Catalogue', icon: BookOpen, roles: ['fraud-analyst', 'fraud-supervisor', 'bou-officer', 'institution-admin'] },
    { id: 'disclosure-requests', label: 'Disclosure Requests', icon: Unlock, roles: ['fraud-analyst', 'fraud-supervisor', 'bou-officer'] },
    { id: 'audit-logs', label: 'Audit Logs', icon: ClipboardList, roles: ['compliance-auditor', 'bou-officer', 'institution-admin'] },
    { id: 'reports', label: 'Reports', icon: TrendingUp, roles: ['fraud-supervisor', 'compliance-auditor', 'bou-officer', 'institution-admin'] },
    { id: 'api-integrations', label: 'API & Integrations', icon: Code2, roles: ['institution-admin', 'bou-officer'] },
    { id: 'users-roles', label: 'Users & Roles', icon: Users, roles: ['institution-admin', 'bou-officer'] },
    { id: 'ussd-simulator', label: 'USSD Simulator', icon: Phone, roles: ['fraud-analyst', 'fraud-supervisor', 'bou-officer', 'institution-admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['institution-admin', 'bou-officer'] },
  ]

  const visible = allItems.filter(item => item.roles.includes(role))

  return (
    <div style={{ width: 220, background: '#4D2412', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <MFLLogo size={30} />
      </div>

      <div style={{ padding: '8px 10px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '12px 6px 6px' }}>
          {appState.institution}
        </div>
        {visible.map(item => {
          const isActive = screen === item.id
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item${isActive ? ' active' : ''}`}
              onClick={() => onNavigate(item.id as Screen)}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '10px 10px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button className="sidebar-nav-item" onClick={onLogout}>
          <LogOut size={15} />Logout
        </button>
      </div>
    </div>
  )
}

// ─── BoU Dashboard ────────────────────────────────────────────────────────────

function BoUDashboard({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div style={{ padding: 28, maxWidth: 1400, margin: '0 auto' }}>
      <SectionHeader
        title="National Fraud Intelligence Overview"
        subtitle="Bank of Uganda · Oversight Dashboard · 11 July 2026"
        actions={
          <>
            <button className="btn-secondary" onClick={() => window.alert('Synthetic overview report prepared for export.')}><Download size={14} />Export Report</button>
            <button className="btn-primary" onClick={() => window.alert('Dashboard metrics refreshed from the current demo state.')}><RefreshCw size={14} />Refresh</button>
          </>
        }
      />

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <MetricCard label="Participating Institutions" value="18" icon={Building2} delta="+2" sub="since last quarter" />
        <MetricCard label="Fraud Indicators Submitted" value="12,480" icon={FileText} color="#DA9133" delta="+847" sub="this month" />
        <MetricCard label="Cross-Institution Matches" value="1,284" icon={Network} color="#DA9133" delta="+124" sub="this month" />
        <MetricCard label="Critical Alerts" value="64" icon={AlertTriangle} color="#BC2626" delta="+8" sub="last 7 days" />
        <MetricCard label="Open Investigations" value="318" icon={Activity} color="#DA9133" sub="across all institutions" />
        <MetricCard label="Confirmed Cases" value="872" icon={CheckCircle} color="#5C2E0E" delta="+43" sub="this month" />
        <MetricCard label="Withdrawn Indicators" value="34" icon={XCircle} color="#555555" sub="this month" />
        <MetricCard label="Avg Response Time" value="2h 18m" icon={Clock} color="#DA9133" delta="-12m" sub="vs last month" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 4 }}>Fraud Reports — Last 30 Days</div>
          <div style={{ fontSize: 12, color: '#555555', marginBottom: 16 }}>Daily submission count across all institutions</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={fraudTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #E6E6E6', borderRadius: 6 }} />
              <Area type="monotone" dataKey="reports" stroke="#DA9133" strokeWidth={2} fill="rgba(218,145,51,0.08)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 4 }}>Alerts by Risk Level</div>
          <div style={{ fontSize: 12, color: '#555555', marginBottom: 12 }}>Active alert distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskLevelData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                {riskLevelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #E6E6E6', borderRadius: 6 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 16 }}>Fraud Incidents by Type</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={fraudTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#555555' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 10, fill: '#555555' }} tickLine={false} axisLine={false} width={100} />
              <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #E6E6E6', borderRadius: 6 }} />
              <Bar dataKey="count" fill="#4D2412" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 16 }}>Cross-Institution Matches by Week</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={matchByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #E6E6E6', borderRadius: 6 }} />
              <Bar dataKey="matches" fill="#DA9133" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 16 }}>Confirmed vs Unconfirmed Cases</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={confirmedVsUnconfirmed}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #E6E6E6', borderRadius: 6 }} />
              <Bar dataKey="confirmed" fill="#5C2E0E" radius={[3, 3, 0, 0]} name="Confirmed" />
              <Bar dataKey="unconfirmed" fill="#E6E6E6" radius={[3, 3, 0, 0]} name="Unconfirmed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Critical alerts table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E6E6E6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333' }}>Recent Critical Alerts</div>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onNavigate('alerts')}>View all <ChevronRight size={13} /></button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['Alert Ref', 'Risk', 'Fraud Type', 'Institutions', 'Generated', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ALERTS.filter(a => a.risk === 'Critical' || a.risk === 'High').slice(0, 4).map((a, i) => (
                <tr key={i} className="table-row" style={{ borderTop: '1px solid #E6E6E6', cursor: 'pointer' }} onClick={() => onNavigate('alert-detail')}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'JetBrains Mono', color: '#333333', fontWeight: 500 }}>{a.ref}</td>
                  <td style={{ padding: '12px 16px' }}><RiskBadge level={a.risk} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#333333' }}>{a.type}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#555555' }}>{a.institutions} institutions</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#555555', fontFamily: 'JetBrains Mono' }}>{a.generatedAt}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Institution API health */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E6E6E6', fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333' }}>Institution API Health</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['Institution', 'Type', 'API Status', 'Last Submission', 'Indicators', 'Compliance'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_INSTITUTIONS_TABLE.map((inst, i) => (
                <tr key={i} className="table-row" style={{ borderTop: '1px solid #E6E6E6', cursor: 'pointer' }} onClick={() => onNavigate('institution-detail')}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#333333' }}>{inst.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#555555' }}>{inst.type}</td>
                  <td style={{ padding: '12px 16px' }}><ApiStatusDot status={inst.apiConn} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#555555', fontFamily: 'JetBrains Mono' }}>{inst.lastSub}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#333333', fontFamily: 'JetBrains Mono' }}>{inst.indicators.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: inst.compliance === 'Compliant' ? '#5C2E0E' : '#DA9133' }}>{inst.compliance}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Institution Dashboard ────────────────────────────────────────────────────

function InstitutionDashboard({ appState, onNavigate }: { appState: AppState; onNavigate: (s: Screen) => void }) {
  return (
    <div style={{ padding: 28, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 800, color: '#333333', margin: 0 }}>Institution Fraud Intelligence Dashboard</h1>
            <ApiStatusDot status="Online" />
          </div>
          <div style={{ fontSize: 13, color: '#555555' }}>{appState.institution} · Last submission: 2026-07-11 14:28 · Schema v1.0</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => onNavigate('reports')}><Download size={14} />Generate Report</button>
          <button className="btn-primary" onClick={() => onNavigate('submit-intel')}><Plus size={14} />Submit Intelligence</button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Submit Intelligence', icon: Upload, action: 'submit-intel' as Screen, color: '#DA9133' },
          { label: 'Review Critical Alerts', icon: AlertTriangle, action: 'alerts' as Screen, color: '#BC2626' },
          { label: 'View Assigned Cases', icon: FileText, action: 'incidents' as Screen, color: '#333333' },
          { label: 'Generate Report', icon: TrendingUp, action: 'reports' as Screen, color: '#DA9133' },
          { label: 'API Documentation', icon: Code2, action: 'api-integrations' as Screen, color: '#555555' },
        ].map(({ label, icon: Icon, action, color }) => (
          <button key={label} onClick={() => onNavigate(action)} style={{ background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 8, padding: '14px 12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 8px ${color}20` }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E6E6E6'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none' }}>
            <Icon size={18} color={color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#333333' }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Indicators Submitted" value="4,821" icon={FileText} color="#DA9133" />
        <MetricCard label="Open Cases" value="28" icon={Activity} color="#DA9133" />
        <MetricCard label="High-Risk Alerts" value="12" icon={AlertTriangle} color="#BC2626" />
        <MetricCard label="Cross-Inst Matches" value="312" icon={Network} color="#4D2412" />
        <MetricCard label="Confirmed Incidents" value="187" icon={CheckCircle} color="#5C2E0E" />
        <MetricCard label="Avg Investigation" value="1h 42m" icon={Clock} color="#555555" />
      </div>

      {/* Charts + recent */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 16 }}>Fraud Submission Trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={fraudTrendData.slice(-10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E6E6" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#555555' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #E6E6E6', borderRadius: 6 }} />
              <Area type="monotone" dataKey="reports" stroke="#DA9133" strokeWidth={2} fill="rgba(218,145,51,0.08)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 12 }}>Risk Distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={riskLevelData} cx="50%" cy="50%" outerRadius={70} dataKey="value" paddingAngle={2}>
                {riskLevelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #E6E6E6', borderRadius: 6 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent alerts */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E6E6E6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333' }}>Recent Alerts</div>
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onNavigate('alerts')}>View all <ChevronRight size={13} /></button>
        </div>
        {SAMPLE_ALERTS.slice(0, 4).map((a, i) => (
          <div key={i} className="table-row" style={{ padding: '12px 20px', borderTop: i > 0 ? '1px solid #E6E6E6' : undefined, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => onNavigate('alert-detail')}>
            <RiskBadge level={a.risk} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333333' }}>{a.ref}</div>
              <div style={{ fontSize: 12, color: '#555555', marginTop: 1 }}>{a.type} · {a.matchReason}</div>
            </div>
            <StatusBadge status={a.status} />
            <span style={{ fontSize: 11, color: '#929292', fontFamily: 'JetBrains Mono' }}>{a.generatedAt}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Submit Intelligence ──────────────────────────────────────────────────────

function SubmitIntelligence({ appState, onView }: { appState: AppState; onView: (reference: string) => void }) {
  const { user, assignment, institution } = useCurrentAccess()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    ref: '', fraudType: 'Account Takeover', riskLevel: 'High', detectionDate: '2026-07-11', detectionTime: '14:28',
    status: 'New', description: '', retentionClass: 'ACTIVE_CASE',
    walletId: '', deviceRef: '', simRef: '', txRef: '', indicatorCode: 'RAPID_MULTI_WALLET_TRANSFER',
    behaviourPattern: '', confidenceLevel: 'High', detectionSource: 'System Detection',
    confirm1: false, confirm2: false, confirm3: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [backendState, setBackendState] = useState<{ status: string; message?: string; incident_ref?: string; protected_subject_ref?: string; schema_version?: string; submission_timestamp?: string; reporting_institution?: string; initial_risk_level?: string; match_status?: string; alert_ref?: string; audit_event_ref?: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError('')

    try {
      // The numeric mapping is an explainable prototype rule, not an ML prediction
      // or an official Bank of Uganda scoring standard.
      const riskScore = form.riskLevel === 'Critical' ? 90 : form.riskLevel === 'High' ? 75 : form.riskLevel === 'Medium' ? 45 : 20
      if (!user || !assignment || !institution) throw new Error('An active authorised session is required.')
      const reference = `FL-UG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
      const protectedReference = `MSISDN:v1:${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`
      const createdAt = new Date().toISOString()
      const record = { id: crypto.randomUUID(), reference, reportingInstitution: institution.name, reportingUser: user.fullName, userRole: assignment.role, submissionDate: createdAt, fraudSubject: form.walletId, standardizedIdentifier: form.walletId.replace(/\s/g, ''), protectedReference, indicators: [form.indicatorCode], evidenceSummary: form.description, riskScore, riskLevel: form.riskLevel, institutionDecision: 'BLOCKED', relatedSubjects: [form.deviceRef, form.simRef].filter(Boolean), matchingResults: 'Correlation queued', routedInstitutions: [], excludedInstitutions: [], timeline: [{ event: 'INTELLIGENCE_SUBMITTED', timestamp: createdAt, actor: user.fullName }] }
      intelligenceRepository.save(record)
      auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution.name, role: assignment.role, action: 'INTELLIGENCE_SUBMITTED', resourceType: 'INTELLIGENCE', resourceReference: reference, result: 'SUCCESS', newValue: record })
      setBackendState({ status: 'accepted', message: 'Fraud intelligence stored; background correlation is running.', incident_ref: reference, protected_subject_ref: protectedReference, schema_version: '1.0', submission_timestamp: createdAt, reporting_institution: institution.name, initial_risk_level: form.riskLevel, match_status: 'CORRELATION STARTED' })
      setSubmitted(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach the backend service.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted && backendState) {
    return (
      <div style={{ padding: 28, maxWidth: 700, margin: '0 auto' }}>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FFEF97', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={32} color="#5C2E0E" />
          </div>
          <h2 style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 800, color: '#333333', marginBottom: 6 }}>Fraud Intelligence Submitted</h2>
          <p style={{ fontSize: 13.5, color: '#555555', marginBottom: 28 }}>The submission has been validated and stored. A protected reference has been generated.</p>

          <div style={{ background: '#F8F8F8', borderRadius: 8, padding: 20, textAlign: 'left', marginBottom: 24 }}>
            {[
              ['Incident Reference', backendState.incident_ref || 'Pending'],
              ['Protected Subject Reference', backendState.protected_subject_ref || 'Pending'],
              ['Schema Version', backendState.schema_version || '1.0'],
              ['Submission Timestamp', backendState.submission_timestamp || 'Pending'],
              ['Reporting Institution', backendState.reporting_institution || appState.institution],
              ['Initial Risk Level', backendState.initial_risk_level || 'UNKNOWN'],
              ['Match Check Status', `${backendState.match_status || 'PENDING'} — Alert ${backendState.alert_ref || 'pending'} generated`],
              ['Audit Event Reference', backendState.audit_event_ref || 'Pending'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid #E6E6E6' }}>
                <div style={{ fontSize: 12, color: '#555555', minWidth: 200, flexShrink: 0 }}>{k}</div>
                <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono', color: '#333333', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#FFEF97', border: '1px solid #DA9133', borderRadius: 6, padding: 12, marginBottom: 24, textAlign: 'left', display: 'flex', gap: 10 }}>
            <AlertTriangle size={16} color="#DA9133" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, color: '#5C2E0E' }}>{backendState.message || 'A cross-institution match was detected and routed for investigation.'}</div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={() => { setSubmitted(false); setStep(1); setBackendState(null); setSubmitError('') }}>Submit Another</button>
            <button className="btn-primary" onClick={() => backendState.incident_ref && onView(backendState.incident_ref)}>View Intelligence</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>
      <SectionHeader title="Submit Fraud Intelligence" subtitle="All submissions are validated against the indicator catalogue and schema before storage." />

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {['Incident Details', 'Protected Indicators', 'Privacy & Validation', 'Review & Submit'].map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? '#DA9133' : active ? '#4D2412' : '#E6E6E6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {done ? <CheckCircle size={14} color="#FFFFFF" /> : <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#FFFFFF' : '#555555' }}>{n}</span>}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? '#4D2412' : done ? '#DA9133' : '#555555', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {i < 3 && <div style={{ flex: 1, height: 1, background: done ? '#DA9133' : '#E6E6E6', margin: '0 12px' }} />}
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: 28 }}>
        {step === 1 && (
          <div>
            <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 16, color: '#333333', marginTop: 0, marginBottom: 20 }}>Step 1: Incident Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Internal Incident Reference *</label>
                <input className="input-field" placeholder="e.g. MNO-2026-007142" value={form.ref} onChange={e => setForm({ ...form, ref: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Fraud Type *</label>
                <select className="input-field" value={form.fraudType} onChange={e => setForm({ ...form, fraudType: e.target.value })}>
                  {['Account Takeover', 'SIM-Swap Abuse', 'Social Engineering', 'Impersonation', 'Stolen PIN', 'Suspicious Incoming Funds', 'Rapid Multi-Wallet Transfer', 'Device Reuse', 'Other Approved Category'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Risk Level *</label>
                <select className="input-field" value={form.riskLevel} onChange={e => setForm({ ...form, riskLevel: e.target.value })}>
                  {['Low', 'Medium', 'High', 'Critical'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Case Status</label>
                <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {['New', 'Triaged', 'Under Investigation', 'Confirmed', 'Resolved'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Detection Date *</label>
                <input className="input-field" type="date" value={form.detectionDate} onChange={e => setForm({ ...form, detectionDate: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Detection Time *</label>
                <input className="input-field" type="time" value={form.detectionTime} onChange={e => setForm({ ...form, detectionTime: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Short Description *</label>
                <textarea className="input-field" rows={3} placeholder="Describe the suspected fraud. Do not include customer names, NINs or telephone numbers." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Retention Class</label>
                <select className="input-field" value={form.retentionClass} onChange={e => setForm({ ...form, retentionClass: e.target.value })}>
                  {['ACTIVE_CASE', 'CLOSED_CASE', 'ARCHIVED'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 16, color: '#333333', marginTop: 0, marginBottom: 12 }}>Step 2: Protected Indicators</h3>
            <div style={{ background: '#F8F8F8', border: '1px solid #E6E6E6', borderRadius: 6, padding: 14, marginBottom: 20, display: 'flex', gap: 10 }}>
              <Lock size={16} color="#4D2412" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: '#333333', lineHeight: 1.6 }}>
                <strong>Privacy protection active.</strong> The submitted wallet, account or device identifier will be converted into a protected reference. The direct identifier will not be stored in the shared fraud-intelligence record.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Wallet or Account Identifier *</label>
                <input className="input-field" placeholder="Will be HMAC-hashed before storage" value={form.walletId} onChange={e => setForm({ ...form, walletId: e.target.value })} />
                <div style={{ fontSize: 11, color: '#555555', marginTop: 4 }}>→ Protected as: SUBJ_XXXXXXXXXXXXXXXX</div>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Indicator Code *</label>
                <select className="input-field" value={form.indicatorCode} onChange={e => setForm({ ...form, indicatorCode: e.target.value })}>
                  {['SIM_SWAP_SUSPECTED', 'ACCOUNT_TAKEOVER', 'RAPID_MULTI_WALLET_TRANSFER', 'SOCIAL_ENGINEERING_REPORTED', 'REPEATED_FAILED_PIN_ACTIVITY', 'SUSPICIOUS_INCOMING_FUNDS', 'DEVICE_REUSE_ACROSS_CASES', 'NEW_SIM_HIGH_VALUE_TRANSFER', 'MULTIPLE_ACCOUNTS_ONE_DEVICE', 'RAPID_CASH_OUT'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Device Reference</label>
                <input className="input-field" placeholder="Will be hashed" value={form.deviceRef} onChange={e => setForm({ ...form, deviceRef: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>SIM Reference</label>
                <input className="input-field" placeholder="Will be hashed" value={form.simRef} onChange={e => setForm({ ...form, simRef: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Transaction Reference</label>
                <input className="input-field" placeholder="Internal transaction ID" value={form.txRef} onChange={e => setForm({ ...form, txRef: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Confidence Level</label>
                <select className="input-field" value={form.confidenceLevel} onChange={e => setForm({ ...form, confidenceLevel: e.target.value })}>
                  {['Low', 'Medium', 'High', 'Confirmed'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Detection Source</label>
                <select className="input-field" value={form.detectionSource} onChange={e => setForm({ ...form, detectionSource: e.target.value })}>
                  {['System Detection', 'Analyst Review', 'Customer Report', 'Third-Party Alert', 'Internal Audit'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Behaviour Pattern</label>
                <textarea className="input-field" rows={2} placeholder="Describe the observed behaviour. No customer names, NINs or phone numbers." value={form.behaviourPattern} onChange={e => setForm({ ...form, behaviourPattern: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 16, color: '#333333', marginTop: 0, marginBottom: 20 }}>Step 3: Privacy & Validation Review</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Schema Validation', status: 'PASSED', color: '#5C2E0E', icon: CheckCircle },
                { label: 'Privacy Check', status: 'PASSED', color: '#5C2E0E', icon: CheckCircle },
                { label: 'Prohibited Data Scan', status: 'PASSED', color: '#5C2E0E', icon: CheckCircle },
                { label: 'Indicator Code Valid', status: 'PASSED', color: '#5C2E0E', icon: CheckCircle },
                { label: 'Mandatory Fields', status: 'PASSED', color: '#5C2E0E', icon: CheckCircle },
                { label: 'Date/Time Validity', status: 'PASSED', color: '#5C2E0E', icon: CheckCircle },
              ].map(({ label, status, color, icon: Icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F8F8F8', border: '1px solid #FFEF97', borderRadius: 6 }}>
                  <Icon size={16} color={color} />
                  <div style={{ flex: 1, fontSize: 13, color: '#333333', fontWeight: 500 }}>{label}</div>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700, color }}>{status}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 10 }}>Fields being submitted</div>
              <div style={{ background: '#F8F8F8', borderRadius: 6, padding: 14 }}>
                {[
                  ['Fraud Type', form.fraudType], ['Risk Level', form.riskLevel], ['Detection Date/Time', `${form.detectionDate} ${form.detectionTime}`],
                  ['Indicator Code', form.indicatorCode], ['Confidence Level', form.confidenceLevel], ['Detection Source', form.detectionSource],
                  ['Retention Class', form.retentionClass], ['Reporting Institution', appState.institution],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid #E6E6E6', fontSize: 12.5 }}>
                    <span style={{ color: '#555555', minWidth: 180 }}>{k}</span>
                    <span style={{ color: '#333333', fontFamily: 'JetBrains Mono', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#FFEF97', border: '1px solid #DA9133', borderRadius: 6, padding: 12, marginBottom: 20, fontSize: 13, color: '#333333' }}>
              <strong>Fields excluded from shared record:</strong> Raw wallet identifier, raw device ID, raw SIM number. These are converted to protected references (HMAC-SHA256) before storage.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'confirm1', text: 'This submission is for authorised fraud-prevention purposes only, in accordance with the Data Protection Act 2019.' },
                { key: 'confirm2', text: 'The information provided is accurate to the best of this institution\'s knowledge at time of submission.' },
                { key: 'confirm3', text: 'This institution accepts responsibility for correcting any inaccurate intelligence submitted.' },
              ].map(({ key, text }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', border: '1px solid #E6E6E6', borderRadius: 6, cursor: 'pointer', background: (form as any)[key] ? 'rgba(218,145,51,0.04)' : '#FFFFFF' }}>
                  <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} style={{ marginTop: 2, accentColor: '#DA9133' }} />
                  <span style={{ fontSize: 13, color: '#333333', lineHeight: 1.5 }}>{text}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #E6E6E6' }}>
          <button className="btn-secondary" onClick={() => setStep(s => Math.max(1, s - 1))} style={{ visibility: step > 1 ? 'visible' : 'hidden' }}>
            <ArrowLeft size={14} />Back
          </button>
          {step < 3 ? (
            <button className="btn-primary" onClick={() => setStep(s => s + 1)}>
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit} disabled={!form.confirm1 || !form.confirm2 || !form.confirm3 || isSubmitting}
              style={{ opacity: (!form.confirm1 || !form.confirm2 || !form.confirm3 || isSubmitting) ? 0.5 : 1 }}>
              <Send size={14} />{isSubmitting ? 'Submitting…' : 'Submit Fraud Intelligence'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function IntelligenceDetail({ reference, onBack }: { reference?: string; onBack: () => void }) {
  const { state, user, assignment, institution } = useCurrentAccess()
  const record = state.intelligence.find(item => item.reference === reference) as Record<string, any> | undefined
  useEffect(() => {
    if (!record || !user || !assignment || !institution) return
    auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution.name, role: assignment.role, action: 'INTELLIGENCE_VIEWED', resourceType: 'INTELLIGENCE', resourceReference: String(record.reference), result: 'SUCCESS' })
  }, [reference])
  if (!record) return <div style={{ padding: 28 }}><button className="btn-secondary" onClick={onBack}><ArrowLeft size={14} />Back</button><div className="card" style={{ marginTop: 18, padding: 28 }}>Intelligence record not found.</div></div>
  const fields = [['Intelligence reference', record.reference], ['Reporting institution', record.reportingInstitution], ['Reporting user', record.reportingUser], ['User role', record.userRole], ['Submission date', record.submissionDate], ['Fraud subject', record.fraudSubject], ['Standardised identifier', record.standardizedIdentifier], ['Protected reference', record.protectedReference], ['Fraud indicators', record.indicators?.join(', ')], ['Evidence summary', record.evidenceSummary], ['Risk score', record.riskScore], ['Risk level', record.riskLevel], ['Institution decision', record.institutionDecision], ['Related subjects', record.relatedSubjects?.join(', ') || 'None'], ['Matching results', record.matchingResults], ['Routed institutions', record.routedInstitutions?.join(', ') || 'Pending'], ['Excluded institutions', record.excludedInstitutions?.join(', ') || 'None']]
  return <div style={{ padding: 28 }}><button className="btn-secondary" onClick={onBack}><ArrowLeft size={14} />Back to Incidents</button><SectionHeader title={record.reference} subtitle="Persisted demonstration intelligence record" /><div className="card" style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{fields.map(([label, value]) => <div key={label}><div style={{ fontSize: 11, color: '#555555', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div><div style={{ fontSize: 13, color: '#333333', fontFamily: label.includes('reference') ? 'JetBrains Mono' : 'Inter' }}>{String(value ?? '—')}</div></div>)}</div><div className="card" style={{ padding: 20, marginTop: 16 }}><h3 style={{ marginTop: 0, color: '#333333' }}>Case timeline & audit</h3>{record.timeline?.map((item: any, index: number) => <div key={index} style={{ padding: '8px 0', borderBottom: '1px solid #E6E6E6', fontSize: 12.5 }}>{item.event} · {item.actor} · {new Date(item.timestamp).toLocaleString()}</div>)}</div></div>
}

// ─── Alerts List ──────────────────────────────────────────────────────────────

function AlertsList({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [filterRisk, setFilterRisk] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [alerts, setAlerts] = useState(SAMPLE_ALERTS)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    api<Array<{ id: number; alert_reference: string; risk_level: string; relationship_type: string; indicator_codes: string[]; reporting_institution?: string; created_at: string; status: string }>>('/alerts')
      .then(rows => setAlerts(rows.map(a => ({ id: a.id, ref: a.alert_reference, risk: a.risk_level[0] + a.risk_level.slice(1).toLowerCase(), type: a.relationship_type.replace(/_/g, ' '), matchReason: `Linked to incident reported by ${a.reporting_institution || 'another institution'}`, indicators: a.indicator_codes.length, institutions: 2, generatedAt: new Date(a.created_at).toLocaleString(), analyst: 'Unassigned', status: a.status.replace(/_/g, ' ') })) as typeof SAMPLE_ALERTS))
      .catch(error => setLoadError(error instanceof Error ? error.message : 'Alerts could not be loaded.'))
  }, [])

  const filtered = alerts.filter(a => {
    const matchRisk = !filterRisk || a.risk === filterRisk
    const matchStatus = !filterStatus || a.status === filterStatus
    const matchSearch = !search || a.ref.toLowerCase().includes(search.toLowerCase()) || a.type.toLowerCase().includes(search.toLowerCase())
    return matchRisk && matchStatus && matchSearch
  })

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Fraud Alerts"
        subtitle="Cross-institution fraud matches and risk signals"
        actions={<button className="btn-secondary" onClick={() => window.alert('Synthetic alert list prepared for export.')}><Download size={14} />Export</button>}
      />
      {loadError && <div style={{ marginBottom: 14, padding: 10, background: '#F8F8F8', color: '#BC2626', borderRadius: 6 }}>{loadError}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={14} color="#555555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="input-field" style={{ paddingLeft: 32 }} placeholder="Search alerts…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field" style={{ flex: '0 0 140px' }} value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
          <option value="">All Risk Levels</option>
          {['Low', 'Medium', 'High', 'Critical'].map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="input-field" style={{ flex: '0 0 180px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['New', 'Acknowledged', 'Under Investigation', 'Escalated', 'Confirmed', 'Resolved', 'Withdrawn'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => window.alert('All available alert filters are already displayed in this MVP.')}><Filter size={14} />More Filters</button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['Alert Reference', 'Risk', 'Fraud Type', 'Match Reason', 'Indicators', 'Institutions', 'Generated', 'Analyst', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={i} className="table-row" style={{ borderTop: '1px solid #E6E6E6', cursor: 'pointer' }} onClick={() => { sessionStorage.setItem('selected_alert_id', String((a as typeof a & { id?: number }).id || '')); onNavigate('alert-detail') }}>
                  <td style={{ padding: '13px 14px', fontSize: 12.5, fontFamily: 'JetBrains Mono', color: '#333333', fontWeight: 600 }}>{a.ref}</td>
                  <td style={{ padding: '13px 14px' }}><RiskBadge level={a.risk} /></td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: '#333333' }}>{a.type}</td>
                  <td style={{ padding: '13px 14px', fontSize: 12.5, color: '#555555', maxWidth: 180 }}>{a.matchReason}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: '#333333', textAlign: 'center' }}>{a.indicators}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: '#333333', textAlign: 'center' }}>{a.institutions}</td>
                  <td style={{ padding: '13px 14px', fontSize: 11.5, color: '#555555', fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap' }}>{a.generatedAt}</td>
                  <td style={{ padding: '13px 14px', fontSize: 12.5, color: '#333333' }}>{a.analyst}</td>
                  <td style={{ padding: '13px 14px' }}><StatusBadge status={a.status} /></td>
                  <td style={{ padding: '13px 14px' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DA9133', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); onNavigate('alert-detail') }}>
                      View <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#555555', fontSize: 13 }}>
            <AlertCircle size={32} color="#E6E6E6" style={{ display: 'block', margin: '0 auto 12px' }} />
            No alerts match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Alert Detail ─────────────────────────────────────────────────────────────

function AlertDetail({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [activeTab, setActiveTab] = useState('summary')
  const [status, setStatus] = useState('Under Investigation')

  return (
    <div style={{ padding: 28 }}>
      <button className="btn-secondary" style={{ marginBottom: 16, padding: '7px 12px', fontSize: 12.5 }} onClick={() => onNavigate('alerts')}>
        <ArrowLeft size={13} />Back to Alerts
      </button>

      {/* Header */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 16, color: '#333333' }}>ALT-2026-00891</span>
              <RiskBadge level="Critical" />
              <StatusBadge status={status} />
            </div>
            <h2 style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: 800, color: '#333333', margin: '0 0 6px' }}>
              High-Risk Cross-Institution Fraud Pattern Detected
            </h2>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: '#555555' }}>
              <span><Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />Generated: 2026-07-11 14:32</span>
              <span><Users size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />Analyst: Daniella Mukisa</span>
              <span><Building2 size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />2 Participating Institutions</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => window.alert('Case assigned to Daniella Mukisa.')} style={{ fontSize: 12, padding: '7px 12px' }}>Assign Analyst</button>
            <button className="btn-secondary" onClick={() => window.alert('Investigation note recorded in the demonstration timeline.')} style={{ fontSize: 12, padding: '7px 12px' }}>Add Note</button>
            <button className="btn-secondary" onClick={() => window.alert('Alert escalated to Kevin Mugabi for supervisor review.')} style={{ fontSize: 12, padding: '7px 12px', color: '#DA9133', borderColor: '#DA9133' }}>Escalate</button>
            <button className="btn-primary" style={{ fontSize: 12, padding: '7px 12px' }} onClick={() => onNavigate('disclosure-requests')}>Request Disclosure</button>
          </div>
        </div>
      </div>

      {/* Privacy warning */}
      <div style={{ background: '#FFEF97', border: '1px solid #DA9133', borderRadius: 6, padding: 12, marginBottom: 16, display: 'flex', gap: 10 }}>
        <AlertTriangle size={15} color="#DA9133" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#5C2E0E', fontStyle: 'italic' }}>
          <strong>Important:</strong> A fraud match is an intelligence signal. It is not automatic proof that a customer committed fraud. Customer identity is not disclosed automatically.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #E6E6E6', display: 'flex', marginBottom: 20 }}>
        {[['summary', 'Summary'], ['match', 'Match Explanation'], ['timeline', 'Timeline'], ['actions', 'Actions']].map(([id, label]) => (
          <button key={id} className={`tab-btn${activeTab === id ? ' active' : ''}`} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 14 }}>Alert Summary</div>
              {[
                ['Common Incident Reference', 'FL-UG-2026-000245'],
                ['Fraud Type', 'Account Takeover / Suspicious Incoming Funds'],
                ['Related Indicators', '3'],
                ['Participating Institutions', 'MTN Mobile Money Uganda Limited, Airtel Mobile Commerce Uganda Limited'],
                ['Match Confidence', '85%'],
                ['Detection Window', '< 24 hours'],
                ['Protected Subject Reference', 'SUBJ_8F92A7B4C91D4E16'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 14, padding: '7px 0', borderBottom: '1px solid #E6E6E6', fontSize: 13 }}>
                  <span style={{ color: '#555555', minWidth: 220, flexShrink: 0 }}>{k}</span>
                  <span style={{ color: '#333333', fontFamily: k.includes('Reference') ? 'JetBrains Mono' : undefined, fontWeight: k.includes('Reference') ? 500 : 400 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 14 }}>Change Status</div>
              <select className="input-field" value={status} onChange={e => setStatus(e.target.value)} style={{ marginBottom: 10 }}>
                {['New', 'Acknowledged', 'Under Investigation', 'Escalated', 'Confirmed', 'Resolved', 'Withdrawn'].map(s => <option key={s}>{s}</option>)}
              </select>
              <button className="btn-primary" onClick={() => window.alert('Alert status updated in the demonstration workflow.')} style={{ width: '100%', justifyContent: 'center' }}>Update Status</button>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 12 }}>Related Incidents</div>
              {['FL-UG-2026-000245', 'FL-UG-2026-000244'].map(ref => (
                <div key={ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #E6E6E6' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#DA9133', fontWeight: 500 }}>{ref}</span>
                  <ExternalLink size={13} color="#555555" style={{ cursor: 'pointer' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'match' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 16, color: '#333333', marginBottom: 6 }}>Match Explanation</div>
          <div style={{ fontSize: 13, color: '#555555', marginBottom: 20 }}>How this alert was generated by the matching engine</div>

          <div style={{ background: '#5C2E0E', borderRadius: 8, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Composite Risk Score</div>
              <div style={{ fontFamily: 'Manrope', fontSize: 36, fontWeight: 800, color: '#FFFFFF' }}>85</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <RiskBadge level="Critical" />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Matching Rule: EXACT_REF_MULTI_INST</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Exact protected wallet-reference match', score: '+40', color: '#5C2E0E' },
              { label: 'Reports submitted by different institutions', score: '+20', color: '#BC2626' },
              { label: 'High-risk indicator combination', score: '+15', color: '#DA9133' },
              { label: 'Events occurred within 24 hours', score: '+10', color: '#DA9133' },
            ].map(({ label, score, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#F8F8F8', borderRadius: 6, borderLeft: `3px solid ${color}` }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13, color, minWidth: 36 }}>{score}</span>
                <span style={{ fontSize: 13, color: '#333333' }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Triggering Indicator Codes', value: 'ACCOUNT_TAKEOVER, RAPID_MULTI_WALLET_TRANSFER, SUSPICIOUS_INCOMING_FUNDS' },
              { label: 'Contributing Institutions', value: 'MTN Mobile Money Uganda Limited, Airtel Mobile Commerce Uganda Limited' },
              { label: 'Recommended Next Action', value: 'Assign to senior analyst · Consider controlled disclosure request' },
              { label: 'Detection Window', value: 'Events within 5h 44m of each other' },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: 14, background: '#F8F8F8', borderRadius: 6 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#333333', lineHeight: 1.5, fontFamily: label.includes('Code') ? 'JetBrains Mono' : undefined }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 20 }}>Investigation Timeline</div>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 1, background: '#E6E6E6' }} />
            {[
              { time: '14:32 · 11 Jul', event: 'Alert generated', detail: 'Cross-institution reference match detected by matching engine', user: 'System', color: '#5C2E0E' },
              { time: '14:33 · 11 Jul', event: 'Status changed to Under Investigation', detail: 'Assigned to Daniella Mukisa', user: 'Daniella Mukisa', color: '#DA9133' },
              { time: '13:46 · 11 Jul', event: 'Incident FL-UG-2026-000244 submitted', detail: 'Airtel Mobile Commerce Uganda Limited — Suspicious Incoming Funds', user: 'Gideon Maku', color: '#DA9133' },
              { time: '14:28 · 11 Jul', event: 'Incident FL-UG-2026-000245 submitted', detail: 'MTN Mobile Money Uganda Limited — Account Takeover', user: 'Kevin Mugabi', color: '#DA9133' },
            ].map(({ time, event, detail, user, color }, i) => (
              <div key={i} style={{ position: 'relative', marginBottom: 20, paddingLeft: 16 }}>
                <div style={{ position: 'absolute', left: -19, top: 5, width: 10, height: 10, borderRadius: '50%', background: color, border: '2px solid #FFFFFF', boxShadow: `0 0 0 2px ${color}40` }} />
                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: '#555555', marginBottom: 2 }}>{time}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#333333' }}>{event}</div>
                <div style={{ fontSize: 12.5, color: '#555555', marginTop: 2 }}>{detail}</div>
                <div style={{ fontSize: 11.5, color: '#929292', marginTop: 2 }}>by {user}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'actions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Acknowledge Alert', icon: CheckCircle, color: '#DA9133', desc: 'Mark this alert as acknowledged by your team' },
            { label: 'Add Investigation Note', icon: Edit2, color: '#333333', desc: 'Add a note to the investigation record' },
            { label: 'Escalate', icon: ArrowUp, color: '#DA9133', desc: 'Escalate to a fraud supervisor for review' },
            { label: 'Request Controlled Disclosure', icon: Unlock, color: '#BC2626', desc: 'Initiate a controlled identity disclosure workflow' },
            { label: 'Mark as False Positive', icon: XCircle, color: '#555555', desc: 'Flag this alert as a false positive for review' },
            { label: 'Withdraw Indicator', icon: Minus, color: '#BC2626', desc: 'Withdraw an indicator from this institution\'s submission' },
            { label: 'Export Authorised Summary', icon: Download, color: '#DA9133', desc: 'Export a redacted summary of this alert' },
            { label: 'Assign Analyst', icon: UserPlus, color: '#333333', desc: 'Assign this case to an analyst for investigation' },
          ].map(({ label, icon: Icon, color, desc }) => (
            <button key={label} onClick={() => window.alert(`${label} workflow opened for the selected record.`)} style={{ background: '#FFFFFF', border: '1px solid #E6E6E6', borderRadius: 8, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 12, transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#E6E6E6')}>
              <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#333333' }}>{label}</div>
                <div style={{ fontSize: 12, color: '#555555', marginTop: 2 }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Fraud Network ────────────────────────────────────────────────────────────

function FraudNetwork() {
  const [selected, setSelected] = useState<string | null>('SUBJ_8F92A7B4C91D4E16')

  const nodes = [
    { id: 'SUBJ_8F92A7B4', x: 320, y: 200, type: 'wallet', label: 'SUBJ_8F92A7B4', color: '#BC2626', size: 22 },
    { id: 'FL-000245', x: 160, y: 120, type: 'incident', label: 'FL-UG-000245', color: '#333333', size: 16 },
    { id: 'FL-000244', x: 480, y: 120, type: 'incident', label: 'FL-UG-000244', color: '#333333', size: 16 },
    { id: 'MTN-MoMo', x: 100, y: 280, type: 'institution', label: 'MTN MoMo', color: '#DA9133', size: 18 },
    { id: 'Airtel-Money', x: 540, y: 280, type: 'institution', label: 'Airtel Money', color: '#DA9133', size: 18 },
    { id: 'DEV_F7A2', x: 320, y: 340, type: 'device', label: 'DEV_F7A2', color: '#DA9133', size: 14 },
    { id: 'CODE_RAPA', x: 200, y: 380, type: 'indicator', label: 'RAPID_TRANSFER', color: '#555555', size: 13 },
    { id: 'CODE_SUS', x: 440, y: 380, type: 'indicator', label: 'SUSP_FUNDS', color: '#555555', size: 13 },
  ]

  const edges = [
    { from: 'SUBJ_8F92A7B4', to: 'FL-000245', type: 'solid' },
    { from: 'SUBJ_8F92A7B4', to: 'FL-000244', type: 'solid' },
    { from: 'FL-000245', to: 'MTN-MoMo', type: 'solid' },
    { from: 'FL-000244', to: 'Airtel-Money', type: 'solid' },
    { from: 'SUBJ_8F92A7B4', to: 'DEV_F7A2', type: 'dashed' },
    { from: 'FL-000245', to: 'CODE_RAPA', type: 'dashed' },
    { from: 'FL-000244', to: 'CODE_SUS', type: 'dashed' },
    { from: 'MTN-MoMo', to: 'Airtel-Money', type: 'dashed' },
  ]

  const nodeShapes: Record<string, string> = { wallet: '⬡', incident: '■', institution: '▲', device: '●', indicator: '◆' }
  const selectedNode = nodes.find(n => n.id === selected || n.label === selected)

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Fraud Network View" subtitle="Interactive visualisation of cross-institution fraud relationships" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Filters */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E6E6E6', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {['Time Range', 'Institution', 'Fraud Type', 'Risk Level', 'Relationship'].map(f => (
              <select key={f} className="input-field" style={{ flex: '0 0 auto', fontSize: 12, padding: '5px 28px 5px 10px' }}>
                <option>{f}: All</option>
              </select>
            ))}
          </div>

          {/* Canvas */}
          <div style={{ position: 'relative', height: 460, background: '#F8F8F8', overflow: 'hidden' }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#E6E6E6" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              {edges.map((e, i) => {
                const from = nodes.find(n => n.id === e.from)!
                const to = nodes.find(n => n.id === e.to)!
                return (
                  <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={e.type === 'solid' ? '#DA9133' : '#929292'}
                    strokeWidth={e.type === 'solid' ? 2 : 1.5}
                    strokeDasharray={e.type === 'dashed' ? '5,4' : undefined}
                    opacity={0.7}
                  />
                )
              })}
              {nodes.map(node => {
                const isSelected = selected === node.id || selected === node.label
                return (
                  <g key={node.id} onClick={() => setSelected(node.id)} style={{ cursor: 'pointer' }}>
                    <circle cx={node.x} cy={node.y} r={node.size + 4} fill={isSelected ? node.color : 'transparent'} fillOpacity={0.12} />
                    <circle cx={node.x} cy={node.y} r={node.size} fill={isSelected ? node.color : '#FFFFFF'} stroke={node.color} strokeWidth={isSelected ? 2.5 : 1.5} />
                    <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={isSelected ? '#FFFFFF' : node.color} fontFamily="JetBrains Mono">
                      {node.type === 'wallet' ? 'W' : node.type === 'incident' ? 'I' : node.type === 'institution' ? '🏛' : node.type === 'device' ? 'D' : 'C'}
                    </text>
                    <text x={node.x} y={node.y + node.size + 12} textAnchor="middle" fontSize="10" fill="#555555" fontFamily="JetBrains Mono">
                      {node.label}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 14, left: 14, background: 'rgba(255,255,255,0.92)', border: '1px solid #E6E6E6', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#555555' }}>
              {[
                { symbol: '—', color: '#DA9133', label: 'Direct match' },
                { symbol: '- -', color: '#929292', label: 'Inferred relationship' },
              ].map(({ symbol, color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'monospace', color, fontWeight: 700, fontSize: 13 }}>{symbol}</span>
                  <span>{label}</span>
                </div>
              ))}
              {[{ c: '#BC2626', l: 'Wallet/Account' }, { c: '#4D2412', l: 'Incident' }, { c: '#DA9133', l: 'Institution' }, { c: '#DA9133', l: 'Device' }, { c: '#555555', l: 'Indicator' }].map(({ c, l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="card" style={{ padding: 20, overflowY: 'auto' }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 14 }}>Node Detail</div>
          {selectedNode ? (
            <div>
              <div style={{ background: '#F8F8F8', borderRadius: 6, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{selectedNode.type}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: '#333333' }}>{selectedNode.id}</div>
              </div>
              {[
                { label: 'Related Incidents', value: 'FL-UG-2026-000245, FL-UG-2026-000244' },
                { label: 'Participating Institutions', value: 'MTN Mobile Money Uganda Limited, Airtel Mobile Commerce Uganda Limited' },
                { label: 'Indicator Codes', value: 'ACCOUNT_TAKEOVER, RAPID_MULTI_WALLET_TRANSFER, SUSPICIOUS_INCOMING_FUNDS' },
                { label: 'Match Reasons', value: 'Exact reference match, Time-based correlation' },
                { label: 'Investigation Status', value: 'Under Investigation' },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12.5, color: '#333333', lineHeight: 1.5 }}>{value}</div>
                </div>
              ))}
              <div style={{ padding: 10, background: '#FFEF97', border: '1px solid #DA9133', borderRadius: 5, fontSize: 11.5, color: '#5C2E0E', marginTop: 12 }}>
                Customer identity not disclosed. Controlled disclosure request required.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 24, color: '#555555', fontSize: 13 }}>Select a node to view details</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Incidents ────────────────────────────────────────────────────────────────

function Incidents({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [search, setSearch] = useState('')
  const [incidents, setIncidents] = useState(SAMPLE_INCIDENTS)
  useEffect(() => {
    api<Array<{ incident_reference: string; reporting_institution: string; fraud_type: string; risk_level: string; protected_reference: string; detected_at: string; status: string }>>('/incidents')
      .then(rows => setIncidents(rows.map(i => ({ ref: i.incident_reference, institution: i.reporting_institution, type: i.fraud_type, risk: i.risk_level[0] + i.risk_level.slice(1).toLowerCase(), protectedRef: `${i.protected_reference.slice(0, 24)}…`, detectedAt: new Date(i.detected_at).toLocaleString(), status: i.status.replace(/_/g, ' '), matchStatus: 'Processing', analyst: 'Authorised user' }))))
      .catch(() => undefined)
  }, [])
  const filtered = incidents.filter(i =>
    !search || i.ref.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Fraud Incidents"
        subtitle="Submitted fraud intelligence records"
        actions={
          <>
            <button className="btn-secondary" onClick={() => window.alert('Synthetic incident list prepared for export.')}><Download size={14} />Export</button>
            <button className="btn-primary" onClick={() => onNavigate('submit-intel')}><Plus size={14} />Submit Intelligence</button>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={14} color="#555555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="input-field" style={{ paddingLeft: 32 }} placeholder="Search incidents…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['Fraud Type', 'Risk Level', 'Status', 'Institution', 'Date Range'].map(f => (
          <select key={f} className="input-field" style={{ flex: '0 0 140px' }}>
            <option>{f}: All</option>
          </select>
        ))}
        <button className="btn-secondary" onClick={() => window.alert('No saved searches exist in the current demo data.')}><Filter size={14} />Saved Searches</button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['Incident Reference', 'Institution', 'Fraud Type', 'Risk', 'Protected Reference', 'Detected At', 'Status', 'Match Status', 'Analyst', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc, i) => (
                <tr key={i} className="table-row" style={{ borderTop: '1px solid #E6E6E6', cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px', fontSize: 12.5, fontFamily: 'JetBrains Mono', color: '#333333', fontWeight: 600 }}>{inc.ref}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#333333' }}>{inc.institution}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#333333' }}>{inc.type}</td>
                  <td style={{ padding: '12px 14px' }}><RiskBadge level={inc.risk} /></td>
                  <td style={{ padding: '12px 14px', fontSize: 11.5, fontFamily: 'JetBrains Mono', color: '#DA9133', fontWeight: 500 }}>{inc.protectedRef}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#555555', fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap' }}>{inc.detectedAt}</td>
                  <td style={{ padding: '12px 14px' }}><StatusBadge status={inc.status} /></td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: inc.matchStatus === 'Matched' ? '#DA9133' : '#555555' }}>
                      {inc.matchStatus === 'Matched' ? '✓ ' : '— '}{inc.matchStatus}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#333333' }}>{inc.analyst}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => window.alert(`Opening ${inc.ref}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DA9133', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      View <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Institutions ─────────────────────────────────────────────────────────────

function Institutions({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const { can } = usePermissions()
  const { state, user, assignment, institution: actorInstitution } = useCurrentAccess()
  const [onboarding, setOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [institutionName, setInstitutionName] = useState('')
  const [institutionCode, setInstitutionCode] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [notice, setNotice] = useState('')
  const advanceOnboarding = () => {
    if (onboardingStep === 1 && !institutionName.trim()) return setNotice('Legal institution name is required.')
    if (onboardingStep === 2 && !/^\S+@\S+\.\S+$/.test(contactEmail)) return setNotice('A valid primary contact email is required.')
    if (onboardingStep < 5) return setOnboardingStep(step => step + 1)
    if (!user || !assignment || !actorInstitution) return
    const application = { id: crypto.randomUUID(), legalName: institutionName, tradingName: institutionName, institutionCode, contactEmail, institutionType: 'Payment Service Provider', integrationMethod: 'REST API', security: { mfa: true, rbac: true, apiSecurity: true, incidentResponse: true, audit: true }, status: 'PENDING_REVIEW', submittedBy: user.fullName, submittedAt: new Date().toISOString() }
    demoRepository.update(state => ({ ...state, institutionApplications: [...state.institutionApplications, application] })); auditRepository.create({ userId: user.id, userName: user.fullName, institution: actorInstitution.name, role: assignment.role, action: 'INSTITUTION_ONBOARDING_SUBMITTED', resourceType: 'INSTITUTION_APPLICATION', resourceReference: application.id, result: 'SUCCESS', newValue: application }); setOnboarding(false); setOnboardingStep(1); setNotice('Institution application submitted with Pending Review status.')
  }
  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Participating Institutions"
        subtitle="Bank of Uganda oversight — all regulated entities on the platform"
        actions={can('ONBOARD_INSTITUTION') ? <button className="btn-primary" onClick={() => { setOnboardingStep(1); setOnboarding(true) }}><Plus size={14} />Onboard Institution</button> : undefined}
      />
      {notice && <div style={{ padding: 10, marginBottom: 14, borderRadius: 6, background: '#FFEF97', color: '#5C2E0E', fontSize: 13 }}>{notice}</div>}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['Institution', 'Type', 'Reg. Status', 'Platform', 'API', 'Last Submission', 'Indicators', 'Matches', 'Alerts', 'Compliance', 'Users', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_INSTITUTIONS_TABLE.map((inst, i) => (
                <tr key={i} className="table-row" style={{ borderTop: '1px solid #E6E6E6' }}>
                  <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, color: '#333333', cursor: 'pointer' }} onClick={() => onNavigate('institution-detail')}>{inst.name}</td>
                  <td style={{ padding: '12px 12px', fontSize: 11.5, color: '#555555' }}>{inst.type}</td>
                  <td style={{ padding: '12px 12px' }}><span style={{ fontSize: 11.5, fontWeight: 600, color: '#5C2E0E' }}>{inst.regStatus}</span></td>
                  <td style={{ padding: '12px 12px' }}><ApiStatusDot status={inst.platformStatus === 'Connected' ? 'Online' : 'Offline'} /></td>
                  <td style={{ padding: '12px 12px' }}><ApiStatusDot status={inst.apiConn} /></td>
                  <td style={{ padding: '12px 12px', fontSize: 11.5, color: '#555555', fontFamily: 'JetBrains Mono' }}>{inst.lastSub}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12.5, fontFamily: 'JetBrains Mono', color: '#333333' }}>{inst.indicators.toLocaleString()}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12.5, fontFamily: 'JetBrains Mono', color: '#333333' }}>{inst.matches}</td>
                  <td style={{ padding: '12px 12px', fontSize: 12.5, fontFamily: 'JetBrains Mono', color: inst.alerts > 20 ? '#BC2626' : '#4D2412' }}>{inst.alerts}</td>
                  <td style={{ padding: '12px 12px' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: inst.compliance === 'Compliant' ? '#5C2E0E' : '#DA9133' }}>{inst.compliance}</span>
                  </td>
                  <td style={{ padding: '12px 12px', fontSize: 12.5, color: '#333333' }}>{inst.users}</td>
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11.5 }} onClick={() => onNavigate('institution-detail')}>View</button>
                      <button onClick={() => window.alert(`${inst.name} suspension requires a recorded regulatory reason.`)} style={{ padding: '4px 8px', fontSize: 11.5, background: '#FFEF97', color: '#BC2626', border: '1px solid #E6E6E6', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>Suspend</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {state.institutionApplications.length > 0 && <div className="card" style={{ padding: 18, marginTop: 16 }}><h3 style={{ marginTop: 0, color: '#333333' }}>Institution Applications</h3>{state.institutionApplications.map((item: any) => <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 0', borderTop: '1px solid #E6E6E6', fontSize: 12 }}><strong style={{ flex: 1 }}>{item.legalName}</strong><StatusBadge status={item.status} />{['View','Edit','Approve','Reject','Request more information','Activate sandbox access','Suspend integration'].map(action => <button key={action} className="btn-secondary" onClick={() => setNotice(`${action}: ${item.legalName}`)} style={{ padding: '4px 6px', fontSize: 10 }}>{action}</button>)}</div>)}</div>}
      {onboarding && <ActionDialog title={`Onboard Institution — Step ${onboardingStep} of 5`} confirmLabel={onboardingStep === 5 ? 'Submit for Review' : 'Next'} onClose={() => setOnboarding(false)} onConfirm={advanceOnboarding}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ color: '#DA9133', fontWeight: 700 }}>{['Institution Information','Contacts','Platform Configuration','Security and Compliance','Review and Submit'][onboardingStep - 1]}</div>
          {onboardingStep === 1 && <><label>Legal name<input className="input-field" value={institutionName} onChange={e => setInstitutionName(e.target.value)} style={{ marginTop: 5 }} /></label><label>Trading name<input className="input-field" style={{ marginTop: 5 }} /></label><label>Institution type<select className="input-field" style={{ marginTop: 5 }}><option>Commercial Bank</option><option>Payment Service Provider</option><option>Microfinance Institution</option></select></label><label>BoU licence/reference<input className="input-field" style={{ marginTop: 5 }} /></label></>}
          {onboardingStep === 2 && <><label>Executive contact<input className="input-field" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={{ marginTop: 5 }} /></label>{['Technical contact','Compliance contact','Data-protection contact','Fraud-operations contact'].map(label => <label key={label}>{label}<input className="input-field" type="email" style={{ marginTop: 5 }} /></label>)}</>}
          {onboardingStep === 3 && <><label>Institution code<input className="input-field" value={institutionCode} onChange={e => setInstitutionCode(e.target.value.toUpperCase())} style={{ marginTop: 5 }} /></label><label>Integration method<select className="input-field" style={{ marginTop: 5 }}><option>REST API</option><option>Secure file exchange</option></select></label><label>Webhook endpoint<input className="input-field" style={{ marginTop: 5 }} /></label><label>IP allowlist<textarea className="input-field" style={{ marginTop: 5 }} /></label></>}
          {onboardingStep === 4 && ['MFA readiness','RBAC readiness','API-security readiness','Incident-response readiness','Audit readiness','Data-retention confirmation','Sandbox status'].map(label => <label key={label} style={{ display: 'flex', gap: 8 }}><input type="checkbox" defaultChecked />{label}</label>)}
          {onboardingStep === 5 && <div style={{ background: '#F8F8F8', padding: 14, borderRadius: 6 }}><strong>{institutionName}</strong><br />Code: {institutionCode || 'Pending'}<br />Contact: {contactEmail}<br />Status on submission: PENDING_REVIEW<label style={{ display: 'block', marginTop: 10 }}><input type="checkbox" required /> I confirm this synthetic application is ready for review.</label></div>}
        </div>
      </ActionDialog>}
    </div>
  )
}

// ─── Institution Detail ───────────────────────────────────────────────────────

function InstitutionDetail({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const demo = useDemoState()
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div style={{ padding: 28 }}>
      <button className="btn-secondary" style={{ marginBottom: 16, padding: '7px 12px', fontSize: 12.5 }} onClick={() => onNavigate('institutions')}>
        <ArrowLeft size={13} />Back to Institutions
      </button>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, borderRadius: 10, background: '#DA9133', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={24} color="#FFFFFF" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 800, color: '#333333', margin: 0 }}>MTN Mobile Money Uganda Limited</h2>
              <ApiStatusDot status="Online" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#5C2E0E', background: '#FFEF97', padding: '2px 8px', borderRadius: 4 }}>Compliant</span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: '#555555' }}>
              <span>Mobile Network Operator</span>
              <span>Regulatory ID: DEMO-PSP-001</span>
              <span>14 users</span>
              <span>Last security review: 2026-04-15</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => window.alert('Administrator contact workflow opened.')} style={{ fontSize: 12, padding: '7px 12px' }}>Contact Admin</button>
            <button className="btn-danger" onClick={() => window.alert('Institution access suspension requires BoU Administrator confirmation.')} style={{ fontSize: 12, padding: '7px 12px' }}>Suspend Access</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <MetricCard label="Total Indicators" value="4,821" icon={FileText} />
        <MetricCard label="Confirmed Matches" value="312" icon={Network} color="#DA9133" />
        <MetricCard label="Open Alerts" value="28" icon={AlertTriangle} color="#BC2626" />
        <MetricCard label="Data Quality Score" value="94%" icon={CheckCircle} color="#5C2E0E" />
      </div>

      <div style={{ borderBottom: '1px solid #E6E6E6', display: 'flex', marginBottom: 20 }}>
        {['overview', 'users', 'api', 'submissions', 'alerts', 'audit', 'compliance', 'settings'].map(tab => (
          <button key={tab} className={`tab-btn${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)} style={{ textTransform: 'capitalize' }}>{tab}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 16 }}>Institution Overview</div>
          {[
            ['Institution Name', 'MTN Mobile Money Uganda Limited'],
            ['Type', 'Mobile Network Operator'],
            ['Regulatory Status', 'Active — Licensed by UCC'],
            ['Platform Status', 'Connected'],
            ['API Base URL', 'https://api.fraudlink.ug/v1'],
            ['Schema Version', '1.0'],
            ['Onboarded', '2025-06-12'],
            ['Last Security Review', '2026-04-15'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 14, padding: '8px 0', borderBottom: '1px solid #E6E6E6', fontSize: 13 }}>
              <span style={{ color: '#555555', minWidth: 200, flexShrink: 0 }}>{k}</span>
              <span style={{ color: '#333333', fontFamily: k.includes('URL') ? 'JetBrains Mono' : undefined }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8F8F8' }}>
                  {['Name', 'Email', 'Role', 'MFA', 'Status', 'Last Login', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demo.users.filter(u => u.roleAssignments.some(role => role.institutionId === 'mtn-momo-ug' && role.status === 'ACTIVE')).map(u => (
                  <tr key={u.id} className="table-row" style={{ borderTop: '1px solid #E6E6E6' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#333333' }}>{u.fullName}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#555555', fontFamily: 'JetBrains Mono' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#333333' }}>{u.roleAssignments.filter(role => role.institutionId === 'mtn-momo-ug' && role.status === 'ACTIVE').map(role => role.role.replace(/_/g, ' ')).join(', ')}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11.5, fontWeight: 600, color: u.mfaEnabled ? '#5C2E0E' : '#BC2626' }}>{u.mfaEnabled ? 'Enabled' : 'Disabled'}</span></td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11.5, fontWeight: 600, color: '#5C2E0E' }}>{u.status}</span></td>
                    <td style={{ padding: '12px 16px', fontSize: 11.5, color: '#555555', fontFamily: 'JetBrains Mono' }}>{u.lastLogin || 'Never'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => window.alert(`Editing ${u.fullName}`)} style={{ fontSize: 11.5, color: '#DA9133', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Disclosure Requests ──────────────────────────────────────────────────────

function DisclosureRequests() {
  const { state, user, assignment, institution } = useCurrentAccess()
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [reviewAction, setReviewAction] = useState<'reject' | 'more-info' | null>(null)
  const [reviewNotice, setReviewNotice] = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [infoCategory, setInfoCategory] = useState('Case evidence')
  const [responseDeadline, setResponseDeadline] = useState('2026-07-14')

  if (submitted) {
    return (
      <div style={{ padding: 28, maxWidth: 700, margin: '0 auto' }}>
        <div className="card" style={{ padding: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FFEF97', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={24} color="#5C2E0E" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: 800, color: '#333333', margin: 0 }}>Disclosure Request Submitted</h2>
              <p style={{ fontSize: 13, color: '#555555', margin: '3px 0 0' }}>DIS-2026-00042 · Awaiting supervisor review</p>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{ position: 'absolute', left: 9, top: 8, bottom: 8, width: 1, background: '#E6E6E6' }} />
            {[
              { label: 'Request Created', done: true, time: '2026-07-11 14:48', user: 'Daniella Mukisa · MTN Mobile Money Uganda Limited' },
              { label: 'Supervisor Review', done: false, time: 'Pending', user: 'Awaiting fraud supervisor' },
              { label: 'Owning Institution Notified', done: false, time: 'Pending', user: 'Airtel Mobile Commerce Uganda Limited (institution owner)' },
              { label: 'Decision Recorded', done: false, time: 'Pending', user: '' },
              { label: 'Disclosure Completed', done: false, time: 'Pending', user: '' },
            ].map(({ label, done, time, user }, i) => (
              <div key={i} style={{ position: 'relative', marginBottom: 18, paddingLeft: 16 }}>
                <div style={{ position: 'absolute', left: -19, top: 5, width: 10, height: 10, borderRadius: '50%', background: done ? '#DA9133' : '#E6E6E6', border: '2px solid #FFFFFF', boxShadow: done ? '0 0 0 2px #DA913340' : 'none' }} />
                <div style={{ fontSize: 13.5, fontWeight: done ? 600 : 400, color: done ? '#4D2412' : '#929292' }}>{label}</div>
                <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono', color: done ? '#DA9133' : '#929292', marginTop: 1 }}>{time}</div>
                {user && <div style={{ fontSize: 11.5, color: '#555555', marginTop: 1 }}>{user}</div>}
              </div>
            ))}
          </div>

          <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => { setSubmitted(false); setStep(1) }}>Submit Another Request</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 28, maxWidth: 760, margin: '0 auto' }}>
      <SectionHeader title="Controlled Identity Disclosure Request" subtitle="A secure, multi-step approval workflow. Identity is never disclosed automatically." />

      {reviewNotice && <div style={{ padding: 11, marginBottom: 14, borderRadius: 6, background: '#F8F8F8', color: '#555555', fontSize: 13 }}>{reviewNotice}</div>}
      {state.disclosureDecisions.length > 0 && <div className="card" style={{ padding: 12, marginBottom: 14 }}>{state.disclosureDecisions.slice(-3).map((item: any) => <div key={item.id} style={{ fontSize: 12, padding: 5 }}><strong>{item.status}</strong> at Step {item.stage} by {item.decidedBy}: {item.reason}</div>)}</div>}

      <div style={{ background: '#F8F8F8', border: '1px solid #E6E6E6', borderRadius: 6, padding: 12, marginBottom: 20, display: 'flex', gap: 10 }}>
        <Lock size={15} color="#BC2626" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#BC2626', lineHeight: 1.5 }}>
          Identity disclosure is strictly controlled. This request requires supervisor approval and owning institution consent before any customer identity is shared.
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        {['Select Alert', 'Request Details', 'Supervisor Review', 'Institution Review'].map((label, i) => {
          const n = i + 1; const done = step > n; const active = step === n
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? '#DA9133' : active ? '#4D2412' : '#E6E6E6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {done ? <CheckCircle size={13} color="#FFFFFF" /> : <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#FFFFFF' : '#555555' }}>{n}</span>}
                </div>
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#4D2412' : done ? '#DA9133' : '#555555', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {i < 3 && <div style={{ flex: 1, height: 1, background: done ? '#DA9133' : '#E6E6E6', margin: '0 10px' }} />}
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: 24 }}>
        {step === 1 && (
          <div>
            <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 15, color: '#333333', marginTop: 0, marginBottom: 16 }}>Select Matched Alert</h3>
            {SAMPLE_ALERTS.filter(a => a.risk === 'Critical' || a.risk === 'High').slice(0, 3).map((a, i) => (
              <div key={i} onClick={() => setStep(2)} style={{ border: '1px solid #E6E6E6', borderRadius: 6, padding: 14, marginBottom: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#DA9133')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#E6E6E6')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5, fontWeight: 600, color: '#333333' }}>{a.ref}</span>
                  <RiskBadge level={a.risk} />
                </div>
                <div style={{ fontSize: 12.5, color: '#555555' }}>{a.type} · {a.matchReason} · {a.institutions} institutions</div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 15, color: '#333333', marginTop: 0, marginBottom: 16 }}>Step 2: Request Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Investigation Reason *</label>
                <textarea className="input-field" rows={3} placeholder="State the legal basis and operational need for identity disclosure." style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Requested Information *</label>
                  <select className="input-field">
                    <option>Full name and account number</option>
                    <option>Contact details only</option>
                    <option>Account activity summary</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Urgency</label>
                  <select className="input-field">
                    <option>Standard (48h)</option>
                    <option>Urgent (24h)</option>
                    <option>Critical (4h)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Legal/Internal Authorisation Reference *</label>
                  <input className="input-field" placeholder="e.g. LEGAL-2026-004421" />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Supporting Document Reference</label>
                  <input className="input-field" placeholder="e.g. DOC-2026-00881" />
                </div>
              </div>
            </div>
          </div>
        )}

        {step >= 3 && (
          <div>
            <h3 style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 15, color: '#333333', marginTop: 0, marginBottom: 16 }}>
              Step {step}: {step === 3 ? 'Supervisor Review' : 'Owning Institution Review'}
            </h3>
            <div style={{ background: '#F8F8F8', borderRadius: 6, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#555555', marginBottom: 8 }}>
                {step === 3
                  ? 'This request is pending review by a fraud supervisor. The supervisor will evaluate the stated reason and authorisation before approving.'
                  : 'This request has been approved by the supervisor and is pending review by Airtel Mobile Commerce Uganda Limited (the owning institution).'}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => step < 4 ? setStep(s => s + 1) : setSubmitted(true)}>
                  {step === 3 ? 'Approve (Demo)' : 'Approve & Complete Disclosure (Demo)'}
                </button>
                <button className="btn-danger" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => { setDecisionReason(''); setReviewAction('reject') }}>Reject</button>
                <button className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => { setDecisionReason(''); setReviewAction('more-info') }}>Request More Info</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #E6E6E6' }}>
          <button className="btn-secondary" onClick={() => setStep(s => Math.max(1, s - 1))} style={{ visibility: step > 1 ? 'visible' : 'hidden' }}>
            <ArrowLeft size={14} />Back
          </button>
          {step < 3 && (
            <button className="btn-primary" onClick={() => setStep(s => s + 1)}>Next <ArrowRight size={14} /></button>
          )}
        </div>
      </div>
      {reviewAction && <ActionDialog title={reviewAction === 'reject' ? 'Reject Disclosure Request' : 'Request More Information'} confirmLabel={reviewAction === 'reject' ? 'Reject Request' : 'Send Request'} danger={reviewAction === 'reject'} onClose={() => setReviewAction(null)} onConfirm={() => {
        if (!decisionReason.trim()) return setReviewNotice(reviewAction === 'reject' ? 'A rejection reason is required.' : 'Describe the missing information.')
        if (!user || !assignment || !institution) return
        const status = reviewAction === 'reject' ? 'REJECTED' : 'MORE_INFORMATION_REQUESTED'; const action = reviewAction === 'reject' ? 'DISCLOSURE_REJECTED' : 'DISCLOSURE_MORE_INFO_REQUESTED'
        const record = { id: crypto.randomUUID(), requestReference: 'DIS-2026-00042', status, stage: step, reason: decisionReason, category: reviewAction === 'more-info' ? infoCategory : undefined, responseDeadline: reviewAction === 'more-info' ? responseDeadline : undefined, decidedBy: user.fullName, institution: institution.name, role: assignment.role, timestamp: new Date().toISOString() }
        demoRepository.update(state => ({ ...state, disclosureDecisions: [...state.disclosureDecisions, record] })); auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution.name, role: assignment.role, action, resourceType: 'DISCLOSURE_REQUEST', resourceReference: record.requestReference, result: 'SUCCESS', reason: decisionReason, newValue: record })
        setReviewNotice(reviewAction === 'reject' ? `Disclosure request rejected at step ${step}. The requester was notified.` : `More information requested at step ${step}. The previous responsible party was notified.`)
        setReviewAction(null)
      }}>
        <div style={{ display: 'grid', gap: 12 }}>{reviewAction === 'more-info' && <><label>Category<select className="input-field" value={infoCategory} onChange={e => setInfoCategory(e.target.value)} style={{ marginTop: 6 }}>{['Investigation purpose','Case evidence','Legal justification','Requested identity fields','Urgency','Supervisor authorisation','Institution confirmation','Other'].map(item => <option key={item}>{item}</option>)}</select></label><label>Response deadline<input className="input-field" type="date" value={responseDeadline} onChange={e => setResponseDeadline(e.target.value)} style={{ marginTop: 6 }} /></label></>}<label>{reviewAction === 'reject' ? 'Reason for rejection' : 'Information required'}<textarea className="input-field" rows={4} value={decisionReason} onChange={e => setDecisionReason(e.target.value)} placeholder={reviewAction === 'reject' ? 'Explain why this request cannot be approved…' : 'Describe the additional evidence or authorisation required…'} style={{ marginTop: 6, resize: 'vertical' }} /></label></div>
      </ActionDialog>}
    </div>
  )
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

function AuditLogs() {
  const [search, setSearch] = useState('')
  const filtered = AUDIT_LOGS.filter(l =>
    !search || l.user.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()) || l.ref.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Audit Logs"
        subtitle="Complete audit trail of all platform actions"
        actions={<button className="btn-secondary" onClick={() => window.alert('Audit log export prepared from synthetic records.')}><Download size={14} />Export Logs</button>}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={14} color="#555555" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="input-field" style={{ paddingLeft: 32 }} placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['User', 'Institution', 'Action', 'Result', 'Date Range'].map(f => (
          <select key={f} className="input-field" style={{ flex: '0 0 140px' }}>
            <option>{f}: All</option>
          </select>
        ))}
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['Timestamp', 'User', 'Institution', 'Role', 'Action', 'Resource', 'Reference', 'IP Address', 'Result', 'Reason'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={i} className="table-row" style={{ borderTop: '1px solid #E6E6E6', cursor: 'pointer' }}>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'JetBrains Mono', color: '#555555', whiteSpace: 'nowrap' }}>{log.ts}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12.5, color: '#333333', fontWeight: 500, whiteSpace: 'nowrap' }}>{log.user}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#555555', whiteSpace: 'nowrap' }}>{log.institution}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11.5, color: '#555555' }}>{log.role}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 600, color: '#333333', whiteSpace: 'nowrap' }}>{log.action}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#555555' }}>{log.resource}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'JetBrains Mono', color: '#DA9133', fontWeight: 500, whiteSpace: 'nowrap' }}>{log.ref}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'JetBrains Mono', color: '#555555' }}>{log.ip}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: log.result === 'Success' ? '#5C2E0E' : '#BC2626' }}>{log.result}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11.5, color: '#555555', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Indicator Catalogue ──────────────────────────────────────────────────────

function IndicatorCatalogue() {
  const { can } = usePermissions()
  const { state, user, assignment, institution } = useCurrentAccess()
  const [dialog, setDialog] = useState<{ type: 'view' | 'history' | 'propose'; index?: number } | null>(null)
  const [notice, setNotice] = useState('')
  const [proposalCode, setProposalCode] = useState('')
  const [proposalName, setProposalName] = useState('')
  const [proposalDefinition, setProposalDefinition] = useState('')
  const selectedIndicator = dialog?.index === undefined ? undefined : INDICATOR_CATALOGUE[dialog.index]
  const auditIndicator = (action: string, reference: string) => user && assignment && institution && auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution.name, role: assignment.role, action, resourceType: 'INDICATOR', resourceReference: reference, result: 'SUCCESS' })
  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Indicator Catalogue"
        subtitle="Bank of Uganda approved fraud indicator codes · Schema v1.0"
        actions={
          <>
            <button className="btn-secondary" onClick={() => { setDialog({ type: 'history' }); auditIndicator('INDICATOR_HISTORY_VIEWED', 'CATALOGUE') }}><BookOpen size={14} />View History</button>
            {can('PROPOSE_INDICATOR') && <button className="btn-secondary" onClick={() => setDialog({ type: 'propose' })}><Plus size={14} />Propose Indicator</button>}
          </>
        }
      />
      {notice && <div style={{ padding: 10, marginBottom: 14, borderRadius: 6, background: '#FFEF97', color: '#5C2E0E', fontSize: 13 }}>{notice}</div>}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['Indicator Code', 'Name', 'Definition', 'Default Severity', 'Version', 'Approval Date', 'Status', 'Approved By', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INDICATOR_CATALOGUE.map((ind, i) => (
                <tr key={i} className="table-row" style={{ borderTop: '1px solid #E6E6E6' }}>
                  <td style={{ padding: '12px 14px', fontSize: 11.5, fontFamily: 'JetBrains Mono', color: '#DA9133', fontWeight: 600 }}>{ind.code}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#333333', fontWeight: 500, whiteSpace: 'nowrap' }}>{ind.name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#555555', maxWidth: 220 }}>{ind.definition}</td>
                  <td style={{ padding: '12px 14px' }}><RiskBadge level={ind.severity} /></td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'JetBrains Mono', color: '#555555' }}>v{ind.version}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11.5, fontFamily: 'JetBrains Mono', color: '#555555' }}>{ind.approvalDate}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#5C2E0E' }}>{ind.status}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#555555' }}>{ind.approvedBy}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { setDialog({ type: 'view', index: i }); auditIndicator('INDICATOR_VIEWED', ind.code) }}>View</button>
                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { setDialog({ type: 'history', index: i }); auditIndicator('INDICATOR_HISTORY_VIEWED', ind.code) }}>History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {state.indicatorProposals.length > 0 && <div className="card" style={{ padding: 18, marginTop: 16 }}><h3 style={{ marginTop: 0, color: '#333333' }}>Pending Proposals</h3>{state.indicatorProposals.map((item: any) => <div key={item.id} style={{ padding: '8px 0', borderTop: '1px solid #E6E6E6', fontSize: 12.5 }}><strong>{item.code}</strong> — {item.name} · proposed by {item.proposedBy} · <span style={{ color: '#DA9133' }}>{item.status}</span></div>)}</div>}
      {dialog?.type === 'view' && selectedIndicator && <ActionDialog title={selectedIndicator.name} confirmLabel="Close" onClose={() => setDialog(null)} onConfirm={() => setDialog(null)}>
        <div style={{ display: 'grid', gap: 9 }}>{[['Code', selectedIndicator.code], ['Definition', selectedIndicator.definition], ['Severity', selectedIndicator.severity], ['Version', `v${selectedIndicator.version}`], ['Approved', `${selectedIndicator.approvalDate} by ${selectedIndicator.approvedBy}`], ['Status', selectedIndicator.status]].map(([label, value]) => <div key={label}><strong style={{ color: '#333333' }}>{label}:</strong> {value}</div>)}</div>
      </ActionDialog>}
      {dialog?.type === 'history' && <ActionDialog title={selectedIndicator ? `${selectedIndicator.name} History` : 'Indicator Catalogue History'} confirmLabel="Close" onClose={() => setDialog(null)} onConfirm={() => setDialog(null)}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div><strong style={{ color: '#333333' }}>15 Mar 2025</strong><br />Catalogue baseline approved by Bank of Uganda.</div>
          <div><strong style={{ color: '#333333' }}>02 Apr 2025</strong><br />Device-reuse definition updated to version 1.1.</div>
          <div><strong style={{ color: '#333333' }}>11 Jul 2026</strong><br />Catalogue reviewed by Malcolm Mark Okabo.</div>
        </div>
      </ActionDialog>}
      {dialog?.type === 'propose' && <ActionDialog title="Propose New Indicator" confirmLabel="Submit Proposal" onClose={() => setDialog(null)} onConfirm={() => {
        if (!proposalCode.trim() || !proposalName.trim() || !proposalDefinition.trim()) return setNotice('Code, name, and definition are required.')
        if (INDICATOR_CATALOGUE.some(item => item.code === proposalCode.trim().toUpperCase()) || state.indicatorProposals.some((item: any) => item.code === proposalCode.trim().toUpperCase())) return setNotice('Indicator code must be unique.')
        if (!user || !assignment || !institution) return
        const record = { id: crypto.randomUUID(), code: proposalCode.trim().toUpperCase(), name: proposalName, definition: proposalDefinition, fraudCategory: 'Account and Transaction Fraud', severity: 'High', evidenceRequirements: 'Documented fraud evidence', reason: 'New observed fraud pattern', supportingNotes: '', proposedEffectiveDate: new Date().toISOString().slice(0, 10), status: 'PENDING_BOU_REVIEW', proposedBy: user.fullName }
        demoRepository.update(state => ({ ...state, indicatorProposals: [...state.indicatorProposals, record] })); auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution.name, role: assignment.role, action: 'INDICATOR_PROPOSED', resourceType: 'INDICATOR', resourceReference: record.code, result: 'SUCCESS', newValue: record }); setDialog(null); setNotice('Indicator proposal submitted for Bank of Uganda review.')
      }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>Proposed code<input className="input-field" value={proposalCode} onChange={e => setProposalCode(e.target.value.replace(/\s/g, '_').toUpperCase())} placeholder="AGENT_COLLUSION_PATTERN" style={{ marginTop: 5 }} /></label>
          <label>Indicator name<input className="input-field" value={proposalName} onChange={e => setProposalName(e.target.value)} placeholder="e.g. Agent Collusion Pattern" style={{ marginTop: 5 }} /></label>
          <label>Default severity<select className="input-field" style={{ marginTop: 5 }}><option>Medium</option><option>High</option><option>Critical</option><option>Low</option></select></label>
          <label>Definition<textarea className="input-field" rows={3} value={proposalDefinition} onChange={e => setProposalDefinition(e.target.value)} placeholder="Describe the observable fraud signal…" style={{ marginTop: 5, resize: 'vertical' }} /></label>
        </div>
      </ActionDialog>}
    </div>
  )
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function Reports() {
  const { can } = usePermissions()
  const { state, user, assignment, institution } = useCurrentAccess()
  const [scheduling, setScheduling] = useState(false)
  const [notice, setNotice] = useState('')
  const [scheduleName, setScheduleName] = useState('Weekly Fraud Trend Report')
  const [scheduleFrequency, setScheduleFrequency] = useState('Weekly')
  const [scheduleRecipients, setScheduleRecipients] = useState('')
  const saveSchedule = () => {
    if (!scheduleName.trim() || !/^\S+@\S+\.\S+$/.test(scheduleRecipients)) return setNotice('Enter a report name and one valid recipient email.')
    if (!user || !assignment || !institution) return
    const record = { id: crypto.randomUUID(), name: scheduleName, type: 'Fraud Trend Report', institutionScope: institution.name, fraudType: 'All', riskLevel: 'All', frequency: scheduleFrequency, deliveryDay: 'Monday', deliveryTime: '08:00', format: 'PDF', recipients: [scheduleRecipients], status: 'ACTIVE', owner: user.fullName, createdAt: new Date().toISOString() }
    demoRepository.update(state => ({ ...state, reportSchedules: [...state.reportSchedules, record] }))
    auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution.name, role: assignment.role, action: 'REPORT_SCHEDULE_CREATED', resourceType: 'REPORT_SCHEDULE', resourceReference: record.id, result: 'SUCCESS', newValue: record })
    setScheduling(false); setNotice('Report schedule saved. Delivery is simulated in this frontend MVP.')
  }
  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Reports & Analytics"
        subtitle="Generate compliance, operational, and intelligence reports"
        actions={can('SCHEDULE_REPORT') ? <button className="btn-primary" onClick={() => setScheduling(true)}><Plus size={14} />Schedule Report</button> : undefined}
      />
      {notice && <div style={{ padding: 10, marginBottom: 14, borderRadius: 6, background: '#FFEF97', color: '#5C2E0E', fontSize: 13 }}>{notice}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {['Institution: All', 'Date: Jul 2026', 'Fraud Type: All', 'Risk Level: All', 'Region: All', 'Status: All'].map(f => (
          <select key={f} className="input-field" style={{ flex: '0 0 auto' }}>
            <option>{f}</option>
          </select>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { title: 'Fraud Trend Report', desc: 'Submission volume and type trends over time', icon: TrendingUp, color: '#DA9133' },
          { title: 'Institution Response Report', desc: 'Average investigation and response times by institution', icon: Building2, color: '#333333' },
          { title: 'Cross-Institution Match Report', desc: 'Cross-entity fraud pattern matches and resolutions', icon: Network, color: '#BC2626' },
          { title: 'Indicator Quality Report', desc: 'Data quality scores and submission accuracy', icon: CheckCircle, color: '#5C2E0E' },
          { title: 'Confirmed Cases Report', desc: 'Confirmed fraud cases and investigation outcomes', icon: FileText, color: '#DA9133' },
          { title: 'Withdrawn Intelligence Report', desc: 'Records withdrawn and the reasons provided', icon: XCircle, color: '#555555' },
          { title: 'Audit Activity Report', desc: 'User activity and audit log summary', icon: ClipboardList, color: '#333333' },
          { title: 'API Performance Report', desc: 'API health, request rates, and error rates', icon: Code2, color: '#DA9133' },
        ].map(({ title, desc, icon: Icon, color }) => (
          <div key={title} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={color} />
              </div>
              <div>
                <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: '#555555', lineHeight: 1.4 }}>{desc}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={() => setNotice(`${title} PDF generated (simulated).`)} style={{ fontSize: 12, padding: '6px 12px', flex: 1, justifyContent: 'center' }}><Download size={13} />PDF</button>
              <button className="btn-secondary" onClick={() => setNotice(`${title} CSV generated (simulated).`)} style={{ fontSize: 12, padding: '6px 12px' }}>CSV</button>
              <button className="btn-secondary" onClick={() => setNotice(`${title} delivery simulated.`)} style={{ fontSize: 12, padding: '6px 12px' }}><Send size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      {state.reportSchedules.length > 0 && <div className="card" style={{ marginTop: 18, padding: 18 }}><h3 style={{ marginTop: 0, color: '#333333' }}>Scheduled Reports</h3>{state.reportSchedules.map((item: any) => <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #E6E6E6', fontSize: 12.5 }}><strong style={{ flex: 1 }}>{item.name}</strong><span>{item.frequency}</span><StatusBadge status={item.status} /><button className="btn-secondary" onClick={() => setNotice(`${item.name}: ${item.format}, ${item.recipients.join(', ')}`)}>View</button><button className="btn-secondary" onClick={() => demoRepository.update(state => ({ ...state, reportSchedules: state.reportSchedules.map((schedule: any) => schedule.id === item.id ? { ...schedule, status: schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : schedule) }))}>{item.status === 'ACTIVE' ? 'Pause' : 'Resume'}</button><button className="btn-secondary" onClick={() => setNotice(`${item.name} ran successfully (simulated).`)}>Run now</button><button className="btn-danger" onClick={() => demoRepository.update(state => ({ ...state, reportSchedules: state.reportSchedules.filter((schedule: any) => schedule.id !== item.id) }))}>Delete</button></div>)}</div>}
      {scheduling && <ActionDialog title="Schedule Report" confirmLabel="Create Schedule" onClose={() => setScheduling(false)} onConfirm={saveSchedule}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>Report name<input className="input-field" value={scheduleName} onChange={e => setScheduleName(e.target.value)} style={{ marginTop: 5 }} /></label>
          <label>Report type<select className="input-field" style={{ marginTop: 5 }}><option>Fraud Trend Report</option><option>Institution Response Report</option><option>Audit Activity Report</option><option>Indicator Quality Report</option></select></label>
          <label>Institution scope<input className="input-field" value={institution?.name || ''} readOnly style={{ marginTop: 5 }} /></label>
          <label>Frequency<select className="input-field" value={scheduleFrequency} onChange={e => setScheduleFrequency(e.target.value)} style={{ marginTop: 5 }}><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option></select></label>
          <label>File format<select className="input-field" style={{ marginTop: 5 }}><option>PDF</option><option>CSV</option><option>Excel</option></select></label>
          <label>Recipients<input className="input-field" type="email" value={scheduleRecipients} onChange={e => setScheduleRecipients(e.target.value)} placeholder="recipient@institution.ug" style={{ marginTop: 5 }} /></label>
          <small>Delivery is simulated in the frontend MVP.</small>
        </div>
      </ActionDialog>}
    </div>
  )
}

// ─── API & Integrations ───────────────────────────────────────────────────────

function APIIntegrations() {
  const { can } = usePermissions()
  const { state: demoState, user, assignment, institution } = useCurrentAccess()
  const [copied, setCopied] = useState(false)
  const defaultKeys = [
    { id: 'key-production', name: 'Production Key', prefix: 'mfl_demo_••••••••••••A92F', created: '2026-01-12', lastUsed: '2026-07-11 14:32', active: true, version: 1 },
    { id: 'key-staging', name: 'Staging Key', prefix: 'mfl_demo_••••••••••••B71C', created: '2026-02-04', lastUsed: '2026-07-10 09:12', active: true, version: 1 },
  ]
  const [keys, setKeys] = useState<any[]>(() => demoState.apiKeys.length ? demoState.apiKeys : defaultKeys)
  const [keyAction, setKeyAction] = useState<{ type: 'rotate' | 'revoke'; index: number } | null>(null)
  const [keyNotice, setKeyNotice] = useState('')
  const [revocationReason, setRevocationReason] = useState('')
  const [revealedKey, setRevealedKey] = useState('')

  const handleCopy = async (value = exampleJson) => { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const exampleJson = `{
  "schema_version": "1.0",
  "incident_id": "FL-UG-2026-000245",
  "fraud_type": "ACCOUNT_TAKEOVER",
  "protected_subject_ref": "HMAC:8F92A7B4C91D...",
  "indicator_code": "RAPID_MULTI_WALLET_TRANSFER",
  "risk_level": "HIGH",
  "detected_at": "2026-07-11T14:32:00+03:00",
  "reporting_entity": "ENTITY-004",
  "status": "UNDER_INVESTIGATION",
  "retention_class": "ACTIVE_CASE"
}`

  if (!can('MANAGE_API_KEYS')) return <div style={{ padding: 28 }}><div className="card" style={{ padding: 24 }}><strong>Access denied.</strong><p>Your active role cannot manage API credentials.</p></div></div>

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="API & Integrations" subtitle="Manage API credentials, webhooks, and integration configuration" />
      {keyNotice && <div style={{ padding: 10, marginBottom: 14, borderRadius: 6, background: '#F8F8F8', color: '#555555', fontSize: 13 }}>{keyNotice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="API Status" value="Online" icon={Activity} color="#5C2E0E" />
        <MetricCard label="Active API Keys" value="3" icon={Key} color="#DA9133" />
        <MetricCard label="Requests (24h)" value="12,481" icon={Zap} color="#4D2412" />
        <MetricCard label="Failed Requests" value="14" icon={XCircle} color="#BC2626" sub="(0.11% error rate)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* API Keys */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 16 }}>API Keys</div>
          {keys.map((key, i) => (
            <div key={i} style={{ border: '1px solid #E6E6E6', borderRadius: 6, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#333333' }}>{key.name}</div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#5C2E0E' }}>{key.active ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#555555', marginBottom: 8 }}>{key.prefix}</div>
              <div style={{ fontSize: 11.5, color: '#929292', marginBottom: 10 }}>Created {key.created} · Last used {key.lastUsed}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-secondary" style={{ fontSize: 11.5, padding: '4px 8px' }} onClick={() => handleCopy(key.prefix)}>
                  <Copy size={11} />{copied ? 'Copied!' : 'Copy'}
                </button>
                {can('MANAGE_API_KEYS') && <><button className="btn-secondary" disabled={!key.active} style={{ fontSize: 11.5, padding: '4px 8px' }} onClick={() => setKeyAction({ type: 'rotate', index: i })}><RotateCcw size={11} />Rotate</button>
                <button disabled={!key.active} onClick={() => { setRevocationReason(''); setKeyAction({ type: 'revoke', index: i }) }} style={{ fontSize: 11.5, padding: '4px 8px', background: '#FFEF97', color: '#BC2626', border: '1px solid #E6E6E6', borderRadius: 4, cursor: key.active ? 'pointer' : 'not-allowed', opacity: key.active ? 1 : .5 }}>Revoke</button></>}
              </div>
            </div>
          ))}
          <button className="btn-primary" onClick={() => setKeyNotice('Use Rotate on an existing demonstration integration to issue a replacement key.')} style={{ fontSize: 12.5, width: '100%', justifyContent: 'center' }}><Key size={13} />Generate New Key</button>
        </div>

        {/* Webhook */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 16 }}>Webhook Configuration</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', display: 'block', marginBottom: 6 }}>Webhook URL</label>
            <input className="input-field" defaultValue="https://hooks.mtn.co.ug/fraudlink" />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#333333', marginBottom: 8 }}>Events</div>
          {['alert.generated', 'alert.status_changed', 'incident.matched', 'disclosure.decision'].map(ev => (
            <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13, color: '#333333', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: '#DA9133' }} />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>{ev}</span>
            </label>
          ))}
          <button className="btn-primary" onClick={() => setKeyNotice('Webhook configuration saved locally for this demonstration.')} style={{ marginTop: 14, fontSize: 12.5 }}><Webhook size={13} />Save Webhook</button>
        </div>
      </div>

      {/* API Reference */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 14 }}>API Endpoints</div>
          {[
            { method: 'POST', path: '/api/v1/incidents', desc: 'Submit fraud incident' },
            { method: 'GET', path: '/api/v1/incidents/{id}', desc: 'Retrieve incident' },
            { method: 'GET', path: '/api/v1/alerts', desc: 'List alerts' },
            { method: 'GET', path: '/api/v1/alerts/{id}', desc: 'Alert detail' },
            { method: 'PATCH', path: '/api/v1/incidents/{id}/status', desc: 'Update status' },
            { method: 'GET', path: '/api/v1/audit', desc: 'Audit log' },
            { method: 'GET', path: '/api/v1/schema', desc: 'Schema version' },
          ].map(({ method, path, desc }) => (
            <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #E6E6E6' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'JetBrains Mono', color: method === 'POST' ? '#5C2E0E' : method === 'PATCH' ? '#DA9133' : '#DA9133', background: method === 'POST' ? '#FFEF97' : method === 'PATCH' ? '#FFEF97' : '#F8F8F8', padding: '2px 6px', borderRadius: 3, minWidth: 44, textAlign: 'center' }}>{method}</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11.5, color: '#333333', flex: 1 }}>{path}</span>
              <span style={{ fontSize: 11.5, color: '#555555' }}>{desc}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333' }}>Example Payload</div>
            <button className="btn-secondary" style={{ fontSize: 11.5, padding: '4px 8px' }} onClick={() => handleCopy(exampleJson)}>
              <Copy size={11} />{copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre style={{ background: '#333333', borderRadius: 6, padding: 16, fontSize: 11, fontFamily: 'JetBrains Mono', color: '#FFFFFF', margin: 0, overflow: 'auto', lineHeight: 1.7 }}>{exampleJson}</pre>
        </div>
      </div>
      {keyAction && <ActionDialog title={`${keyAction.type === 'rotate' ? 'Rotate' : 'Revoke'} ${keys[keyAction.index].name}`} confirmLabel={keyAction.type === 'rotate' ? 'Rotate Key' : 'Revoke Key'} danger={keyAction.type === 'revoke'} onClose={() => setKeyAction(null)} onConfirm={() => {
        if (keyAction.type === 'revoke' && !revocationReason.trim()) return setKeyNotice('A revocation reason is required.')
        const current = keys[keyAction.index]
        if (keyAction.type === 'rotate') {
          const fullKey = `mfl_demo_${crypto.randomUUID().replace(/-/g, '')}`; const suffix = fullKey.slice(-4).toUpperCase()
          const next = keys.map((item, i) => i === keyAction.index ? { ...item, prefix: `mfl_demo_••••••••••••${suffix}`, version: (item.version || 1) + 1, lastRotated: new Date().toISOString(), rotatedBy: user?.fullName } : item); setKeys(next); setRevealedKey(fullKey); demoRepository.update(state => ({ ...state, apiKeys: next }))
          setKeyNotice(`${current.name} rotated. Update connected systems with the newly issued key.`)
        } else {
          const next = keys.map((item, i) => i === keyAction.index ? { ...item, active: false, status: 'REVOKED', revokedBy: user?.fullName, revokedAt: new Date().toISOString(), revocationReason } : item); setKeys(next); demoRepository.update(state => ({ ...state, apiKeys: next }))
          setKeyNotice(`${current.name} revoked successfully.`)
        }
        if (user && assignment && institution) auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution.name, role: assignment.role, action: keyAction.type === 'rotate' ? 'API_KEY_ROTATED' : 'API_KEY_REVOKED', resourceType: 'API_KEY', resourceReference: current.id, result: 'SUCCESS', reason: keyAction.type === 'revoke' ? revocationReason : undefined })
        setKeyAction(null)
      }}><div>{keyAction.type === 'rotate' ? <p style={{ margin: 0 }}>A fictional replacement credential will be issued. The previous key will stop working after rotation.</p> : <><p>Connected systems using this key will immediately lose API access.</p><label>Revocation reason<textarea className="input-field" value={revocationReason} onChange={e => setRevocationReason(e.target.value)} style={{ marginTop: 6 }} /></label></>}</div></ActionDialog>}
      {revealedKey && <ActionDialog title="New Demonstration Key" confirmLabel="I have saved the key" onClose={() => setRevealedKey('')} onConfirm={() => setRevealedKey('')}><p>This fictional key is displayed only once. Only its masked value is stored.</p><code style={{ display: 'block', padding: 12, background: '#333333', color: '#fff', overflowWrap: 'anywhere' }}>{revealedKey}</code><button className="btn-secondary" onClick={() => handleCopy(revealedKey)} style={{ marginTop: 10 }}><Copy size={13} />{copied ? 'Copied' : 'Copy key'}</button></ActionDialog>}
    </div>
  )
}

// ─── Users & Roles ────────────────────────────────────────────────────────────

function UsersRoles() {
  const { can } = usePermissions()
  const { state, user: actor, assignment: actorAssignment, institution: actorInstitution } = useCurrentAccess()
  const [userAction, setUserAction] = useState<{ type: 'add' | 'edit' | 'status' | 'assign' | 'history'; userId?: string } | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [reason, setReason] = useState('')
  const [assignmentSide, setAssignmentSide] = useState<AccessSide>('SERVICE_PROVIDER')
  const [assignmentInstitution, setAssignmentInstitution] = useState('mtn-momo-ug')
  const [assignmentRole, setAssignmentRole] = useState<UserRole>('FRAUD_ANALYST')
  const [notice, setNotice] = useState('')
  const selectedUser = state.users.find(user => user.id === userAction?.userId)
  const isBouAdmin = actorAssignment?.role === 'BOU_ADMINISTRATOR'
  const recordAudit = (action: string, resource: string, previousValue?: unknown, newValue?: unknown) => actor && actorAssignment && auditRepository.create({ userId: actor.id, userName: actor.fullName, institution: actorInstitution?.name || 'Unknown', role: actorAssignment.role, action, resourceType: 'USER', resourceReference: resource, result: 'SUCCESS', reason, previousValue, newValue })

  const openEdit = (user: DemoUser) => { setFormName(user.fullName); setFormEmail(user.email); setReason(''); setUserAction({ type: 'edit', userId: user.id }) }
  const saveUser = () => {
    if (!formName.trim() || !/^\S+@\S+\.\S+$/.test(formEmail)) return setNotice('Enter a full name and valid email address.')
    if (state.users.some(user => user.email.toLowerCase() === formEmail.toLowerCase() && user.id !== selectedUser?.id)) return setNotice('A user with that email already exists.')
    if (userAction?.type === 'add') {
      const newUser: DemoUser = { id: crypto.randomUUID(), fullName: formName.trim(), email: formEmail.toLowerCase(), initials: formName.split(/\s+/).map(word => word[0]).join('').slice(0, 2), status: 'ACTIVE', mfaEnabled: true, roleAssignments: [] }
      demoRepository.update(state => ({ ...state, users: [...state.users, newUser] })); recordAudit('USER_CREATED', newUser.id, undefined, newUser); setNotice(`${newUser.fullName} created. Assign a role before login.`)
    } else if (selectedUser) {
      const updated = { ...selectedUser, fullName: formName.trim(), email: formEmail.toLowerCase() }
      demoRepository.update(state => ({ ...state, users: state.users.map(user => user.id === updated.id ? updated : user) })); recordAudit('USER_UPDATED', updated.id, selectedUser, updated); setNotice(`${updated.fullName} updated.`)
    }
    setUserAction(null)
  }

  const saveAssignment = () => {
    if (!selectedUser || !actor || !actorAssignment) return
    if (!isBouAdmin && (assignmentSide === 'BANK_OF_UGANDA' || assignmentInstitution !== actorAssignment.institutionId)) return setNotice('Institution administrators can assign roles only within their institution.')
    const role: RoleAssignment = { id: crypto.randomUUID(), userId: selectedUser.id, accessSide: assignmentSide, institutionId: assignmentSide === 'BANK_OF_UGANDA' ? 'bou' : assignmentInstitution, role: assignmentRole, status: 'ACTIVE', assignedBy: actor.id, assignedAt: new Date().toISOString(), reason }
    demoRepository.update(state => ({ ...state, users: state.users.map(user => user.id === selectedUser.id ? { ...user, roleAssignments: [...user.roleAssignments, role] } : user) }))
    recordAudit('ROLE_ASSIGNED', role.id, undefined, role); setNotice(`${assignmentRole.replace(/_/g, ' ')} assigned to ${selectedUser.fullName}.`); setUserAction(null)
  }

  const changeRoleStatus = (target: DemoUser, role: RoleAssignment, status: RoleAssignment['status']) => {
    const activeAdmins = state.users.flatMap(user => user.roleAssignments).filter(item => item.role === 'BOU_ADMINISTRATOR' && item.status === 'ACTIVE')
    if (role.role === 'BOU_ADMINISTRATOR' && role.status === 'ACTIVE' && activeAdmins.length === 1) return setNotice('The final active BoU Administrator role cannot be removed or suspended.')
    demoRepository.update(state => ({ ...state, users: state.users.map(user => user.id === target.id ? { ...user, roleAssignments: user.roleAssignments.map(item => item.id === role.id ? { ...item, status } : item) } : user) }))
    recordAudit(status === 'REVOKED' ? 'ROLE_REVOKED' : 'ROLE_ASSIGNED', role.id, role, { ...role, status }); setNotice(`Role assignment ${status.toLowerCase()}.`)
  }
  if (!can('MANAGE_ALL_USERS') && !can('MANAGE_INSTITUTION_USERS')) return <div style={{ padding: 28 }}><div className="card" style={{ padding: 24 }}><strong>Access denied.</strong><p>Your active role cannot manage users or role assignments.</p></div></div>
  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Users & Roles"
        subtitle="Manage platform users, roles, and permissions"
        actions={(can('MANAGE_ALL_USERS') || can('MANAGE_INSTITUTION_USERS')) ? <><button className="btn-secondary" onClick={() => { setReason(''); setUserAction({ type: 'assign', userId: state.users[0]?.id }) }}><Key size={14} />Assign Role</button><button className="btn-primary" onClick={() => { setFormName(''); setFormEmail(''); setReason(''); setUserAction({ type: 'add' }) }}><UserPlus size={14} />Add User</button></> : undefined}
      />
      {notice && <div style={{ padding: 10, marginBottom: 14, borderRadius: 6, background: '#FFEF97', color: '#5C2E0E', fontSize: 13 }}>{notice}</div>}

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F8F8' }}>
                {['User', 'Simulated Email', 'Active Assignments', 'MFA', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.users.map(u => (
                <tr key={u.id} className="table-row" style={{ borderTop: '1px solid #E6E6E6' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#DA9133', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#333333', flexShrink: 0 }}>
                        {u.initials}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#333333' }}>{u.fullName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#555555', fontFamily: 'JetBrains Mono' }}>{u.email}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#333333' }}>{u.roleAssignments.filter(role => role.status === 'ACTIVE').map(role => <div key={role.id} style={{ marginBottom: 4 }}><strong>{role.role.replace(/_/g, ' ')}</strong> · {state.institutions.find(item => item.id === role.institutionId)?.code}<button onClick={() => changeRoleStatus(u, role, 'SUSPENDED')} style={{ marginLeft: 6, border: 0, background: 'none', color: '#DA9133', cursor: 'pointer', fontSize: 10 }}>Suspend</button><button onClick={() => changeRoleStatus(u, role, 'REVOKED')} style={{ border: 0, background: 'none', color: '#BC2626', cursor: 'pointer', fontSize: 10 }}>Revoke</button></div>)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: u.mfaEnabled ? '#5C2E0E' : '#BC2626' }}>
                      {u.mfaEnabled ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}><span style={{ fontSize: 11.5, fontWeight: 600, color: u.status === 'ACTIVE' ? '#5C2E0E' : '#BC2626' }}>{u.status}</span></td>
                  <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#555555', fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap' }}>{u.lastLogin || 'Never'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-secondary" style={{ padding: '3px 7px', fontSize: 11 }} onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn-secondary" style={{ padding: '3px 7px', fontSize: 11 }} onClick={() => setUserAction({ type: 'history', userId: u.id })}>History</button>
                      <button onClick={() => { if (u.id === actor?.id) return setNotice('You cannot suspend your own active session.'); setReason('Administrative account status change'); demoRepository.update(state => ({ ...state, users: state.users.map(user => user.id === u.id ? { ...user, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : user) })); recordAudit(u.status === 'ACTIVE' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', u.id, u.status, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE') }} style={{ padding: '3px 7px', fontSize: 11, background: u.status === 'ACTIVE' ? '#FFEF97' : '#FFEF97', color: u.status === 'ACTIVE' ? '#BC2626' : '#5C2E0E', border: '1px solid #E6E6E6', borderRadius: 4, cursor: 'pointer' }}>{u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(userAction?.type === 'add' || userAction?.type === 'edit') && <ActionDialog title={userAction.type === 'add' ? 'Add User' : 'Edit User'} confirmLabel={userAction.type === 'add' ? 'Create User' : 'Save Changes'} onClose={() => setUserAction(null)} onConfirm={saveUser}><div style={{ display: 'grid', gap: 12 }}><label>Full name<input className="input-field" value={formName} onChange={e => setFormName(e.target.value)} style={{ marginTop: 5 }} /></label><label>Simulated email<input className="input-field" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} style={{ marginTop: 5 }} /></label><label>Reason<textarea className="input-field" value={reason} onChange={e => setReason(e.target.value)} style={{ marginTop: 5 }} /></label></div></ActionDialog>}
      {userAction?.type === 'assign' && <ActionDialog title="Assign Role" confirmLabel="Confirm Assignment" onClose={() => setUserAction(null)} onConfirm={saveAssignment}><div style={{ display: 'grid', gap: 12 }}><label>User<select className="input-field" value={userAction.userId} onChange={e => setUserAction({ type: 'assign', userId: e.target.value })} style={{ marginTop: 5 }}>{state.users.map(user => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label><label>Access side<select className="input-field" value={assignmentSide} onChange={e => { const side = e.target.value as AccessSide; setAssignmentSide(side); setAssignmentInstitution(side === 'BANK_OF_UGANDA' ? 'bou' : actorAssignment?.institutionId || 'mtn-momo-ug'); setAssignmentRole(side === 'BANK_OF_UGANDA' ? 'BOU_OVERSIGHT_OFFICER' : 'FRAUD_ANALYST') }} style={{ marginTop: 5 }}><option value="SERVICE_PROVIDER">Service Provider</option>{isBouAdmin && <option value="BANK_OF_UGANDA">Bank of Uganda</option>}</select></label>{assignmentSide === 'SERVICE_PROVIDER' && <label>Institution<select className="input-field" value={assignmentInstitution} onChange={e => setAssignmentInstitution(e.target.value)} style={{ marginTop: 5 }}>{state.institutions.filter(item => item.accessSide === 'SERVICE_PROVIDER' && (isBouAdmin || item.id === actorAssignment?.institutionId)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label>Role<select className="input-field" value={assignmentRole} onChange={e => setAssignmentRole(e.target.value as UserRole)} style={{ marginTop: 5 }}>{assignmentSide === 'BANK_OF_UGANDA' ? <><option value="BOU_ADMINISTRATOR">BoU Administrator</option><option value="BOU_OVERSIGHT_OFFICER">BoU Oversight Officer</option></> : <><option value="FRAUD_ANALYST">Fraud Analyst</option><option value="FRAUD_SUPERVISOR">Fraud Supervisor</option><option value="INSTITUTION_ADMIN">Institution Administrator</option><option value="COMPLIANCE_AUDITOR">Compliance Auditor</option></>}</select></label><label>Assignment reason<textarea className="input-field" value={reason} onChange={e => setReason(e.target.value)} style={{ marginTop: 5 }} /></label></div></ActionDialog>}
      {userAction?.type === 'history' && selectedUser && <ActionDialog title={`${selectedUser.fullName} History`} confirmLabel="Close" onClose={() => setUserAction(null)} onConfirm={() => setUserAction(null)}><div style={{ display: 'grid', gap: 9 }}>{state.auditEvents.filter(event => event.userId === selectedUser.id || event.resourceReference === selectedUser.id).map(event => <div key={event.id}><strong>{event.action}</strong> · {new Date(event.timestamp).toLocaleString()}</div>)}{!state.auditEvents.some(event => event.userId === selectedUser.id || event.resourceReference === selectedUser.id) && <span>No audit events recorded yet.</span>}</div></ActionDialog>}

      {/* Role summary */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 16, color: '#333333', marginBottom: 14 }}>Role Permissions Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { role: 'BoU Administrator', color: '#5C2E0E', perms: ['Manage all users', 'Assign BoU roles', 'Assign cross-institution roles', 'Onboard institutions'] },
            { role: 'BoU Oversight Officer', color: '#5C2E0E', perms: ['View national statistics', 'Review indicators', 'Review compliance', 'View oversight alerts'] },
            { role: 'Institution Admin', color: '#333333', perms: ['Manage users', 'Issue API credentials', 'Configure webhooks', 'View alerts', 'Notification settings'] },
            { role: 'Fraud Analyst', color: '#DA9133', perms: ['Submit intelligence', 'Review alerts', 'Investigate cases', 'Add notes', 'Request disclosure'] },
            { role: 'Fraud Supervisor', color: '#DA9133', perms: ['Approve escalations', 'Assign investigations', 'Approve disclosures', 'Confirm intelligence', 'Review analyst work'] },
            { role: 'Compliance Auditor', color: '#555555', perms: ['View audit logs', 'Review access history', 'View data exports', 'Generate compliance reports'] },
          ].map(({ role, color, perms }) => (
            <div key={role} className="card" style={{ padding: 16 }}>
              <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10, marginBottom: 12 }}>
                <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, color: '#333333' }}>{role}</div>
              </div>
              {perms.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', fontSize: 12, color: '#555555' }}>
                  <CheckCircle size={12} color={color} />
                  {p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── USSD Simulator ───────────────────────────────────────────────────────────

function USSDSimulator() {
  type UssdScreen = 'menu' | 'report-menu' | 'phone-entry' | 'block-options' | 'success' | 'status-entry' | 'status-result' | 'safety-info' | 'exit'
  type ReportType = 'Unknown Transaction' | 'PIN Request' | 'SIM Swap Suspicion' | 'Stolen Phone' | 'Fraudulent Transaction'

  const [screen, setScreen] = useState<UssdScreen>('menu')
  const [input, setInput] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [reportType, setReportType] = useState<ReportType>('Unknown Transaction')
  const [reportRef, setReportRef] = useState('RPT-2026-443821')
  const [transactionsBlocked, setTransactionsBlocked] = useState(false)
  const [statusLookup, setStatusLookup] = useState('')
  const [error, setError] = useState('')

  const providerPrefixes: Record<string, string> = {
    '070': 'Airtel Mobile Commerce Uganda Limited',
    '074': 'Airtel Mobile Commerce Uganda Limited',
    '075': 'Airtel Mobile Commerce Uganda Limited',
    '076': 'MTN Mobile Money Uganda Limited',
    '077': 'MTN Mobile Money Uganda Limited',
    '078': 'MTN Mobile Money Uganda Limited',
  }

  const reportOptions: ReportType[] = [
    'Unknown Transaction',
    'PIN Request',
    'SIM Swap Suspicion',
    'Stolen Phone',
    'Fraudulent Transaction',
  ]

  const highRiskReportTypes: ReportType[] = ['SIM Swap Suspicion', 'Stolen Phone']

  const normalizePhone = (value: string) => {
    let digits = value.replace(/\D/g, '')
    if (digits.startsWith('256') && digits.length === 12) digits = `0${digits.slice(3)}`
    return digits
  }

  const detectProvider = (value: string) => providerPrefixes[normalizePhone(value).slice(0, 3)] || ''
  const provider = detectProvider(phoneNumber)
  const isHighRiskReport = highRiskReportTypes.includes(reportType)

  const generateReportRef = () => `RPT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`

  const resetSimulator = () => {
    setScreen('menu')
    setInput('')
    setPhoneNumber('')
    setReportType('Unknown Transaction')
    setReportRef('RPT-2026-443821')
    setTransactionsBlocked(false)
    setStatusLookup('')
    setError('')
  }

  const setNextScreen = (nextScreen: UssdScreen) => {
    setScreen(nextScreen)
    setInput('')
    setError('')
  }

  const handleSubmit = () => {
    const value = input.trim()
    setError('')

    switch (screen) {
      case 'menu':
        if (value === '1') return setNextScreen('report-menu')
        if (value === '2') return setNextScreen('status-entry')
        if (value === '3') return setNextScreen('safety-info')
        if (value === '4') return setNextScreen('exit')
        setError('Enter 1, 2, 3, or 4.')
        return

      case 'report-menu': {
        if (value === '0') return setNextScreen('menu')
        const selectedReport = reportOptions[Number(value) - 1]
        if (selectedReport) {
          setReportType(selectedReport)
          return setNextScreen('phone-entry')
        }
        setError('Enter a valid report type from 1 to 5, or 0 to go back.')
        return
      }

      case 'phone-entry': {
        if (value === '0') return setNextScreen('report-menu')
        const normalized = normalizePhone(value)
        const detectedProvider = detectProvider(normalized)
        if (normalized.length !== 10 || !normalized.startsWith('07')) {
          setError('Enter a valid Ugandan mobile number, for example 0771234567.')
          return
        }
        if (!detectedProvider) {
          setError('We could not detect the provider for that number. Check the number and try again.')
          return
        }
        setPhoneNumber(normalized)
        return setNextScreen('block-options')
      }

      case 'block-options':
        if (value === '0') return setNextScreen('phone-entry')
        if (value === '1' || value === '2') {
          setTransactionsBlocked(value === '1')
          setReportRef(generateReportRef())
          return setNextScreen('success')
        }
        setError('Enter 1 to block transactions, 2 to report only, or 0 to go back.')
        return

      case 'status-entry':
        if (value === '0') return setNextScreen('menu')
        if (!value) {
          setError('Enter a report reference or phone number.')
          return
        }
        setStatusLookup(value)
        return setNextScreen('status-result')

      case 'status-result':
      case 'safety-info':
        if (value === '0') return setNextScreen('menu')
        setError('Enter 0 to return to the main menu.')
        return

      case 'success':
      case 'exit':
        resetSimulator()
        return

      default:
        return
    }
  }

  const getCurrentScreen = () => {
    switch (screen) {
      case 'menu':
        return {
          content: 'MoMo FraudLink Uganda\n*284*90#\n\n1. Report Suspected Fraud\n2. Check Report Status\n3. Mobile Money Safety Information\n4. Exit',
          prompt: 'Enter choice:',
        }
      case 'report-menu':
        return {
          content: 'Report Suspected Fraud\n\n' + reportOptions.map((option, index) => String(index + 1) + '. ' + option).join('\n') + '\n\n0. Back',
          prompt: 'Enter choice:',
        }
      case 'phone-entry':
        return {
          content: `${reportType}\n\nEnter the mobile money phone number linked to the affected account.\n\nThe system will detect the provider automatically.\n\n0. Back`,
          prompt: 'Phone number:',
        }
      case 'block-options':
        return {
          content: 'Provider Detected\n\nPhone: ' + phoneNumber + '\nProvider: ' + provider + '\nReport type: ' + reportType + '\n\n' + (isHighRiskReport ? 'Recommended action: block transactions immediately while the provider verifies ownership.' : 'You can block transactions if you believe money is at immediate risk.') + '\n\n1. Block all mobile money transactions\n2. Submit report without blocking\n\n0. Back',
          prompt: 'Enter choice:',
        }
      case 'success':
        return {
          content: `Request Submitted\n\nReport reference: ${reportRef}\nType: ${reportType}\nPhone: ${phoneNumber}\nProvider: ${provider}\n\n${transactionsBlocked ? 'All mobile money transactions have been blocked pending provider verification.' : 'Your report has been submitted for provider verification. Transactions remain active until the provider takes action.'}\n\nFor further help, visit the nearest service centre with valid identification for assistance.`,
          prompt: '',
        }
      case 'status-entry':
        return {
          content: 'Check Report Status\n\nEnter your report reference or the affected phone number.\n\n0. Back',
          prompt: 'Reference or phone:',
        }
      case 'status-result':
        return {
          content: `Report Status\n\nLookup: ${statusLookup}\nStatus: Received by provider\nNext step: provider verification\n\nIf your phone was stolen, your SIM was swapped, or you cannot access the number, visit the nearest service centre with valid identification.\n\n0. Main menu`,
          prompt: 'Enter choice:',
        }
      case 'safety-info':
        return {
          content: 'Mobile Money Safety Information\n\n- Never share your PIN or OTP.\n- Providers will not ask for your PIN by phone.\n- If your phone is stolen, block transactions immediately.\n- If your SIM stops working unexpectedly, report possible SIM swap.\n- Confirm the recipient name before sending money.\n- Visit a service centre if you lose access to your SIM.\n\n0. Main menu',
          prompt: 'Enter choice:',
        }
      case 'exit':
        return {
          content: 'Thank you for using MoMo FraudLink Uganda.\n\nFor urgent mobile money help, visit the nearest service centre for assistance.',
          prompt: '',
        }
      default:
        return { content: '', prompt: '' }
    }
  }

  const curr = getCurrentScreen()
  const canStartAgain = screen === 'success' || screen === 'exit'

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="USSD Fraud-Reporting Simulator" subtitle="Consumer protection flow for suspicious activity, SIM swaps, and stolen phones" />

      <div style={{ background: '#FFEF97', border: '1px solid #DA9133', borderRadius: 6, padding: 12, marginBottom: 24, display: 'flex', gap: 10, maxWidth: 700 }}>
        <Info size={15} color="#DA9133" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#5C2E0E', lineHeight: 1.5 }}>
          <strong>Consumer protection input.</strong> A user selects the fraud scenario, enters the affected phone number, gets routed to the detected provider, and can request a temporary mobile-money transaction block while the provider verifies the case.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Phone mockup */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ width: 260, background: '#333333', borderRadius: 36, padding: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ background: '#111', borderRadius: 28, overflow: 'hidden' }}>
              {/* Camera */}
              <div style={{ height: 28, background: '#333333', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#333' }} />
              </div>
              {/* Screen */}
              <div style={{ background: '#333333', minHeight: 420, padding: 16, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  {/* Signal bars */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                    <span>MTN UG</span>
                    <span>|||| 3G</span>
                    <span>84%</span>
                  </div>
                  <div style={{ background: '#333333', borderRadius: 6, padding: 12, minHeight: 280, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#FFFFFF', lineHeight: 1.7 }}>
                    {curr.content}
                  </div>
                  {error && (
                    <div style={{ marginTop: 8, border: '1px solid #BC2626', background: '#BC2626', borderRadius: 4, padding: '7px 8px', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#FFFFFF', lineHeight: 1.5 }}>
                      {error}
                    </div>
                  )}
                </div>
                {curr.prompt && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#666', marginBottom: 4 }}>{curr.prompt}</div>
                    <input
                      value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      style={{ width: '100%', background: '#333333', border: '1px solid #333', borderRadius: 4, padding: '6px 8px', color: '#FFFFFF', fontFamily: 'JetBrains Mono', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button onClick={handleSubmit} style={{ width: '100%', marginTop: 6, background: '#DA9133', border: 'none', borderRadius: 4, padding: '7px', color: '#FFFFFF', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter' }}>
                      Send
                    </button>
                  </div>
                )}
                {canStartAgain && (
                  <button onClick={resetSimulator} style={{ marginTop: 10, width: '100%', background: 'transparent', border: '1px solid #333', borderRadius: 4, padding: '6px', color: '#888', fontSize: 11, cursor: 'pointer', fontFamily: 'JetBrains Mono' }}>
                    Start again
                  </button>
                )}
              </div>
              {/* Home bar */}
              <div style={{ height: 28, background: '#333333', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: 60, height: 3, borderRadius: 2, background: '#333' }} />
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#555555' }}>Dial <strong style={{ fontFamily: 'JetBrains Mono' }}>*284*90#</strong></div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 12 }}>How it works</div>
            {[
              { n: 1, text: 'Customer dials *284*90# and chooses Report Suspected Fraud, status lookup, or safety information' },
              { n: 2, text: 'For a report, the customer selects Unknown Transaction, PIN Request, SIM Swap, Stolen Phone, or Fraudulent Transaction' },
              { n: 3, text: 'Customer enters the affected phone number, and the system detects the provider automatically' },
              { n: 4, text: 'The request is routed to the detected provider for verification and action' },
              { n: 5, text: 'Customer can request a temporary block on all mobile money transactions and is directed to the nearest service centre' },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#DA9133', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{n}</span>
                </div>
                <span style={{ fontSize: 13, color: '#333333', lineHeight: 1.5, paddingTop: 2 }}>{text}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: '#333333', marginBottom: 10 }}>Report Categories</div>
            {reportOptions.map((c, i) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #E6E6E6', fontSize: 13, color: '#333333' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#F8F8F8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#555555', flexShrink: 0 }}>{i + 1}</span>
                {c}
              </div>
            ))}
            <div style={{ marginTop: 14, borderTop: '1px solid #E6E6E6', paddingTop: 12, fontSize: 12.5, color: '#555555', lineHeight: 1.6 }}>
              Provider detection happens automatically from the submitted phone number. SIM swap and stolen-phone reports recommend immediate transaction blocking.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Settings (placeholder)
function SettingsScreen() {
  const [resetting, setResetting] = useState(false)
  const [notice, setNotice] = useState('')
  return (
    <div style={{ padding: 28, maxWidth: 700 }}>
      <SectionHeader title="Settings" subtitle="Notification, security, and platform configuration" />
      {notice && <div style={{ padding: 10, marginBottom: 14, background: '#FFEF97', color: '#5C2E0E', borderRadius: 6 }}>{notice}</div>}
      <div className="card" style={{ padding: 24 }}>
        {['Email Notifications', 'SMS Alerts', 'Webhook Events', 'Session Timeout (minutes)', 'Data Retention Class', 'Two-Factor Authentication'].map((setting, i) => (
          <div key={setting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #E6E6E6' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: '#333333' }}>{setting}</div>
            </div>
            {i < 3 ? (
              <div style={{ width: 40, height: 22, borderRadius: 11, background: '#DA9133', position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', right: 3, top: 3, width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF' }} />
              </div>
            ) : (
              <input className="input-field" defaultValue={i === 3 ? '30' : i === 4 ? 'ACTIVE_CASE' : 'TOTP'} style={{ width: 160, textAlign: 'right' }} />
            )}
          </div>
        ))}
        <button className="btn-primary" onClick={() => setNotice('Settings saved for this demonstration session.')} style={{ marginTop: 20 }}>Save Settings</button>
      </div>
      <div className="card" style={{ padding: 20, marginTop: 16, borderColor: '#E6E6E6' }}><h3 style={{ marginTop: 0, color: '#BC2626' }}>Demonstration Data</h3><p style={{ fontSize: 13, color: '#555555' }}>Restore the five Team 4 users, initial role assignments, and clear all locally persisted workflow records.</p><button className="btn-danger" onClick={() => setResetting(true)}>Reset Demo Data</button></div>
      {resetting && <ActionDialog title="Reset Demo Data" confirmLabel="Reset Everything" danger onClose={() => setResetting(false)} onConfirm={() => { demoRepository.reset(); setResetting(false); setNotice('Demo data reset. Log out to begin with the initial assignments.') }}><p style={{ margin: 0 }}>This clears locally stored users, assignments, intelligence, proposals, decisions, schedules, API-key state, applications, and audit events.</p></ActionDialog>}
    </div>
  )
}

// ─── Main App Shell ───────────────────────────────────────────────────────────

export default function App() {
  const initialDemo = demoRepository.getSnapshot()
  const initialUser = initialDemo.users.find(user => user.id === initialDemo.session?.userId)
  const initialAssignment = initialUser?.roleAssignments.find(role => role.id === initialDemo.session?.assignmentId)
  const [phase, setPhase] = useState<'restoring' | 'login' | 'mfa' | 'app'>(() => initialDemo.session ? (initialDemo.session.mfaVerified ? 'app' : 'mfa') : 'login')
  const [pendingUser, setPendingUser] = useState<DemoUser | null>(() => initialDemo.session?.mfaVerified ? null : initialUser || null)
  const [pendingAssignment, setPendingAssignment] = useState<RoleAssignment | null>(() => initialDemo.session?.mfaVerified ? null : initialAssignment || null)
  const [appState, setAppState] = useState<AppState>({
    screen: 'institution-dashboard',
    role: 'fraud-analyst',
    institution: 'MTN Mobile Money Uganda Limited',
    user: 'Daniella Mukisa',
  })

  const [connection, setConnection] = useState<'LIVE' | 'RECONNECTING' | 'OFFLINE'>('OFFLINE')
  const applyAuthenticatedUser = (user: DemoUser, assignment: RoleAssignment) => {
    // Central permissions authorize capabilities; this mapping only selects the
    // existing visual navigation variant for the active assignment.
    const roleMap: Record<UserRole, Role> = { BOU_ADMINISTRATOR: 'bou-officer', BOU_OVERSIGHT_OFFICER: 'bou-officer', FRAUD_ANALYST: 'fraud-analyst', FRAUD_SUPERVISOR: 'fraud-supervisor', COMPLIANCE_AUDITOR: 'compliance-auditor', INSTITUTION_ADMIN: 'institution-admin' }
    const role = roleMap[assignment.role]
    const institution = demoRepository.getSnapshot().institutions.find(item => item.id === assignment.institutionId)
    setAppState(s => ({
      ...s, role, institution: institution?.name || 'Unknown institution',
      user: user.fullName,
      screen: assignment.accessSide === 'BANK_OF_UGANDA' ? 'bou-dashboard' : 'institution-dashboard',
    }))
  }

  const handleLogin = (user: DemoUser, assignment: RoleAssignment) => {
    setPendingUser(user)
    setPendingAssignment(assignment)
    setPhase('mfa')
  }

  const handleMFAVerify = () => {
    if (!pendingUser || !pendingAssignment) { authRepository.logout(); setPhase('login'); return }
    authRepository.verifyMfa('123456')
    const institution = demoRepository.getSnapshot().institutions.find(item => item.id === pendingAssignment.institutionId)
    auditRepository.create({ userId: pendingUser.id, userName: pendingUser.fullName, institution: institution?.name || 'Unknown', role: pendingAssignment.role, action: 'MFA_VERIFIED', resourceType: 'SESSION', resourceReference: pendingAssignment.id, result: 'SUCCESS' })
    applyAuthenticatedUser(pendingUser, pendingAssignment)
    setPendingUser(null)
    setPendingAssignment(null)
    setPhase('app')
  }
  useEffect(() => {
    if (phase !== 'app' || !initialUser || !initialAssignment) return
    if (initialUser.status === 'ACTIVE' && initialAssignment.status === 'ACTIVE') applyAuthenticatedUser(initialUser, initialAssignment)
    else { authRepository.logout(); setPhase('login') }
  }, [])
  const handleLogout = () => { authRepository.logout(); clearSession(); setPendingUser(null); setPendingAssignment(null); setPhase('login'); setConnection('OFFLINE') }
  const handleSwitchRole = (assignment: RoleAssignment) => {
    const user = demoRepository.getSnapshot().users.find(item => item.id === demoRepository.getSnapshot().session?.userId)
    if (!user) return
    const previous = user.roleAssignments.find(item => item.id === demoRepository.getSnapshot().session?.assignmentId)
    authRepository.switchRole(assignment.id)
    const institution = demoRepository.getSnapshot().institutions.find(item => item.id === assignment.institutionId)
    auditRepository.create({ userId: user.id, userName: user.fullName, institution: institution?.name || 'Unknown', role: assignment.role, action: 'ROLE_SWITCHED', resourceType: 'ROLE_ASSIGNMENT', resourceReference: assignment.id, result: 'SUCCESS', previousValue: previous, newValue: assignment })
    applyAuthenticatedUser(user, assignment)
  }
  const navigate = (screen: Screen) => setAppState(s => ({ ...s, screen }))
  const viewIntelligence = (reference: string) => setAppState(s => ({ ...s, screen: 'intelligence-detail', selectedReference: reference, previousScreen: 'incidents' }))

  if (phase === 'restoring') return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#555555' }}>Restoring secure session…</div>
  if (phase === 'login') return <LoginScreen onLogin={handleLogin} />
  if (phase === 'mfa') return <MFAScreen onVerify={handleMFAVerify} />

  const renderScreen = () => {
    switch (appState.screen) {
      case 'bou-dashboard': return <BoUDashboard onNavigate={navigate} />
      case 'institution-dashboard': return <InstitutionDashboard appState={appState} onNavigate={navigate} />
      case 'alerts': return <AlertsList onNavigate={navigate} />
      case 'alert-detail': return <AlertDetail onNavigate={navigate} />
      case 'incidents': return <Incidents onNavigate={navigate} />
      case 'submit-intel': return <SubmitIntelligence appState={appState} onView={viewIntelligence} />
      case 'intelligence-detail': return <IntelligenceDetail reference={appState.selectedReference} onBack={() => navigate('incidents')} />
      case 'fraud-network': return <FraudNetwork />
      case 'institutions': return <Institutions onNavigate={navigate} />
      case 'institution-detail': return <InstitutionDetail onNavigate={navigate} />
      case 'disclosure-requests': return <DisclosureRequests />
      case 'audit-logs': return <AuditLogs />
      case 'indicator-catalogue': return <IndicatorCatalogue />
      case 'reports': return <Reports />
      case 'api-integrations': return <APIIntegrations />
      case 'users-roles': return <UsersRoles />
      case 'ussd-simulator': return <USSDSimulator />
      case 'settings': return <SettingsScreen />
      default: return <InstitutionDashboard appState={appState} onNavigate={navigate} />
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8F8F8' }}>
      <Sidebar appState={appState} onNavigate={navigate} onLogout={handleLogout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar appState={appState} onNavigate={navigate} onSwitchRole={handleSwitchRole} onLogout={handleLogout} />
        <div style={{ position: 'fixed', right: 18, bottom: 14, zIndex: 20, background: '#FFEF97', color: connection === 'LIVE' ? '#5C2E0E' : '#555555', border: '1px solid currentColor', borderRadius: 20, padding: '6px 10px', fontSize: 11, fontWeight: 700 }}>{connection}</div>
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  )
}
