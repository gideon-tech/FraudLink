export interface AuthUser {
  id: number
  email: string
  full_name: string
  role: 'BOU_OVERSIGHT' | 'FRAUD_ANALYST' | 'FRAUD_SUPERVISOR' | 'COMPLIANCE' | 'SYSTEM_ADMIN'
  institution_id: number
  institution_code: string
  institution_name: string
}

const TOKEN_KEY = 'fraudlink_access_token'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || '').replace(/\/$/, '')

// sessionStorage intentionally limits the demo token to this browser tab. A production
// deployment should prefer a Secure, HttpOnly, SameSite cookie to reduce token exposure.
export function token() { return sessionStorage.getItem(TOKEN_KEY) }
export function clearSession() { sessionStorage.removeItem(TOKEN_KEY) }

// One API wrapper keeps URL construction, authentication, and FastAPI error parsing
// consistent across every screen. Clearing a rejected token prevents restore loops.
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (response.status === 401) clearSession()
  if (!response.ok) {
    const detail = data.detail
    throw new Error(typeof detail === 'string' ? detail : detail?.message || 'The service could not complete this request.')
  }
  return data as T
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await api<{ access_token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  sessionStorage.setItem(TOKEN_KEY, response.access_token)
  return response.user
}

export function connectEvents(onEvent: (event: { type: string; data: unknown }) => void, onState: (state: 'LIVE' | 'RECONNECTING' | 'OFFLINE') => void) {
  let socket: WebSocket | null = null
  let stopped = false
  let retry = 1000
  const open = () => {
    const accessToken = token()
    if (!accessToken || stopped) return
    onState(retry === 1000 ? 'RECONNECTING' : 'OFFLINE')
    // Vite proxies this relative socket in development; deployed builds derive ws/wss
    // from the configured API origin unless a dedicated WebSocket origin is supplied.
    const defaultSocketBase = API_BASE_URL
      ? API_BASE_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`
    socket = new WebSocket(`${WS_BASE_URL || defaultSocketBase}/ws/events?token=${encodeURIComponent(accessToken)}`)
    socket.onopen = () => { retry = 1000; onState('LIVE') }
    socket.onmessage = message => {
      try { onEvent(JSON.parse(message.data)) }
      catch { /* Ignore malformed event frames and keep the live connection open. */ }
    }
    // Bounded exponential backoff avoids flooding the API during an outage.
    socket.onclose = () => { if (!stopped) { onState('RECONNECTING'); window.setTimeout(open, retry); retry = Math.min(retry * 2, 15000) } }
    socket.onerror = () => socket?.close()
  }
  open()
  return () => { stopped = true; socket?.close(); onState('OFFLINE') }
}
