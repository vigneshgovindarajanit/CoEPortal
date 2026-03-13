import { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/axios'

const TOKEN_STORAGE_KEY = 'coeportal.auth.token'
const USER_STORAGE_KEY = 'coeportal.auth.user'

const AuthContext = createContext(null)

function readStoredUser() {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

function persistSession(token, user) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  window.dispatchEvent(new Event('auth-changed'))
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
  window.dispatchEvent(new Event('auth-changed'))
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken())
  const [user, setUser] = useState(() => readStoredUser())
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(getStoredToken()))

  useEffect(() => {
    async function restoreSession() {
      const existingToken = getStoredToken()
      if (!existingToken) {
        setIsBootstrapping(false)
        return
      }

      try {
        const response = await api.get('/auth/me')
        setToken(existingToken)
        setUser(response.data?.user || response.data)
      } catch {
        clearStoredSession()
        setToken(null)
        setUser(null)
      } finally {
        setIsBootstrapping(false)
      }
    }

    restoreSession()
  }, [])

  useEffect(() => {
    function handleUnauthorized() {
      clearStoredSession()
      setToken(null)
      setUser(null)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  async function login(credentials) {
    const response = await api.post('/auth/login', credentials)
    const authPayload = response.data?.user ? response.data : response.data?.data ?? response.data

    persistSession(authPayload.token, authPayload.user)
    setToken(authPayload.token)
    setUser(authPayload.user)
    return authPayload.user
  }

  function logout() {
    clearStoredSession()
    setToken(null)
    setUser(null)
  }

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token),
    isBootstrapping,
    login,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
