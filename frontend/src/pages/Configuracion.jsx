import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { ThemeSwitch } from '../components/ThemeToggle.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Configuracion() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="grid gap-8">
      <PageHeader kicker="Configuración" title="Tu cuenta" accent="y tus preferencias." />
      <section className="card divide-y divide-line/70">
        <div className="flex flex-wrap items-center gap-4 p-5">
          {user?.picture
            ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-11 rounded-full" />
            : <span className="grid size-11 place-items-center rounded-full bg-elev text-sm text-muted">{user?.name?.[0]}</span>}
          <div className="min-w-0"><p className="font-medium">{user?.name}</p><p className="truncate font-mono text-xs text-muted">{user?.email}</p></div>
          <span className="pill ml-auto" style={{ '--c': 'var(--violet)' }}>Cuenta de Google</span>
        </div>
        <div className="flex items-center justify-between gap-4 p-5">
          <div><p className="text-sm font-medium">Apariencia</p><p className="text-xs text-muted">Por defecto se usa la de tu sistema.</p></div>
          <ThemeSwitch />
        </div>
        <div className="flex items-center justify-between gap-4 p-5">
          <div><p className="text-sm font-medium">Sesión</p><p className="text-xs text-muted">Cerrás sesión en este navegador.</p></div>
          <button type="button" className="btn btn-soft btn-sm" onClick={async () => { await logout(); navigate('/') }}>Cerrar sesión</button>
        </div>
      </section>
    </div>
  )
}
