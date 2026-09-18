import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo.jsx'

// Barra superior simple para el flujo de configuración (sin menú lateral, para no distraer).
export default function AppHeader({ right }) {
  const { user } = useAuth()
  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('') ?? '?'
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-5 sm:px-10">
      <Logo to="/app" />
      <div className="flex items-center gap-5">
        {right}
        <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-elev text-xs font-medium text-muted">
          {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : initials}
        </span>
      </div>
    </header>
  )
}
