import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('central demo seed contains the exact five Team 4 users and simulated emails', () => {
  const source = read('src/data/demoUsers.ts')
  for (const [name, email] of [
    ['Malcolm Mark Okabo', 'malcolm.okabo@bou.demo.ug'], ['Daniella Mukisa', 'daniella.mukisa@mtn.demo.ug'],
    ['Esther Nampiina', 'esther.nampiina@mtn.demo.ug'], ['Kevin Mugabi', 'kevin.mugabi@mtn.demo.ug'], ['Gideon Maku', 'gideon.maku@mtn.demo.ug'],
  ]) { assert.match(source, new RegExp(name)); assert.match(source, new RegExp(email.replaceAll('.', '\\.'))) }
  assert.equal((source.match(/id: 'user-/g) || []).length, 5)
})

test('role seed preserves multiple assignments and required initial roles', () => {
  const source = read('src/data/demoUsers.ts')
  for (const role of ['BOU_ADMINISTRATOR', 'BOU_OVERSIGHT_OFFICER', 'FRAUD_ANALYST', 'INSTITUTION_ADMIN', 'FRAUD_SUPERVISOR', 'COMPLIANCE_AUDITOR']) assert.match(source, new RegExp(role))
  assert.match(source, /role-malcolm-admin/)
  assert.match(source, /role-malcolm-oversight/)
})

test('permissions are centralized for every supported role', () => {
  const source = read('src/auth/rolePermissions.ts')
  for (const role of ['BOU_ADMINISTRATOR', 'BOU_OVERSIGHT_OFFICER', 'FRAUD_ANALYST', 'INSTITUTION_ADMIN', 'FRAUD_SUPERVISOR', 'COMPLIANCE_AUDITOR']) assert.match(source, new RegExp(`${role}:`))
  assert.match(source, /ASSIGN_BOU_ROLE/)
  assert.match(source, /MANAGE_API_KEYS/)
})

test('persistence is isolated behind the central repository', () => {
  const repository = read('src/repositories/demoRepository.ts')
  assert.match(repository, /localStorage\.getItem/)
  assert.match(repository, /localStorage\.setItem/)
  const app = read('src/App.tsx')
  assert.doesNotMatch(app, /localStorage\./)
})

test('required audit actions are implemented', () => {
  const sources = [read('src/App.tsx'), read('src/repositories/authRepository.ts')].join('\n')
  for (const action of ['LOGIN_SUCCESS','MFA_VERIFIED','ROLE_ASSIGNED','ROLE_REVOKED','ROLE_SWITCHED','USER_CREATED','USER_UPDATED','USER_SUSPENDED','USER_REACTIVATED','API_KEY_ROTATED','API_KEY_REVOKED','INTELLIGENCE_SUBMITTED','INTELLIGENCE_VIEWED','INDICATOR_VIEWED','INDICATOR_HISTORY_VIEWED','INDICATOR_PROPOSED','DISCLOSURE_REJECTED','DISCLOSURE_MORE_INFO_REQUESTED','REPORT_SCHEDULE_CREATED','INSTITUTION_ONBOARDING_SUBMITTED']) assert.match(sources, new RegExp(action))
})

test('button audit exists and placeholder names are absent from active frontend', () => {
  assert.match(read('BUTTON_AUDIT.md'), /Manual pending/)
  const app = read('src/App.tsx')
  assert.doesNotMatch(app, /Aisha Nakato|Joy Ochieng|A\. Nakato/)
})

