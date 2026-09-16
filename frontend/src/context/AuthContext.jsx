import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [config, setConfig] = useState(null) // { google_client_id, dev_login }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Al abrir la app: leer config de auth y ver si ya hay una sesión válida (cookie).
    Promise.allSettled([api('/auth/config'), api('/auth/me')]).then(([cfg, me]) => {
      setConfig(cfg.status === 'fulfilled' ? cfg.value : { google_client_id: null, dev_login: false, offline: true })
      setUser(me.status === 'fulfilled' ? me.value : null)
      setLoading(false)
    })
  }, [])

  const loginGoogle = useCallback(async (credential) => {
    setUser(await api('/auth/google', { method: 'POST', body: { credential } }))
  }, [])
  const loginDev = useCallback(async () => {
    setUser(await api('/auth/dev', { method: 'POST' }))
  }, [])
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, config, loading, loginGoogle, loginDev, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
