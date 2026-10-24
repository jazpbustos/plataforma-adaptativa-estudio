import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { LANGUAGES } from '../lib/format.js'

const LANGS = Object.keys(LANGUAGES)

export default function Configuracion() {
  const { user, logout, setPreferredLanguage } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const elegir = async (k) => {
    setSaving(true)
    await setPreferredLanguage(user.preferred_language === k ? null : k).catch(() => {})
    setSaving(false)
  }

  return (
    <div className="grid gap-8">
      <PageHeader title="Configuración" sub="Tu cuenta y tus preferencias." />
      <section className="card divide-y divide-line/70">
        <div className="flex flex-wrap items-center gap-4 p-5">
          {user?.picture
            ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-11 rounded-full" />
            : <span className="grid size-11 place-items-center rounded-full bg-elev text-sm text-muted">{user?.name?.[0]}</span>}
          <div className="min-w-0"><p className="font-medium">{user?.name}</p><p className="truncate text-xs text-muted">{user?.email}</p></div>
          <span className="pill ml-auto" style={{ '--c': 'var(--violet)' }}>Cuenta de Google</span>
        </div>
        <div className="flex items-center justify-between gap-4 p-5">
          <div><p className="text-sm font-medium">Sesión</p><p className="text-xs text-muted">Cerrás sesión en este navegador.</p></div>
          <button type="button" className="btn btn-soft btn-sm" onClick={async () => { await logout(); navigate('/') }}>Cerrar sesión</button>
        </div>
      </section>

      <section className="card grid gap-3 p-5" aria-labelledby="lenguaje">
        <div>
          <h2 id="lenguaje" className="text-sm font-medium">Lenguaje por defecto</h2>
          <p className="text-xs text-muted">Se preselecciona al armar un objetivo nuevo. Lo podés cambiar en cada uno.</p>
        </div>
        <div role="radiogroup" aria-labelledby="lenguaje" className="flex flex-wrap gap-1.5">
          {LANGS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={user?.preferred_language === k} disabled={saving}
              className="chip" onClick={() => elegir(k)}>{LANGUAGES[k]}</button>
          ))}
        </div>
      </section>
    </div>
  )
}
