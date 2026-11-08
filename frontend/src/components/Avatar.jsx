import { useAuth } from '../context/AuthContext.jsx'

// Foto de perfil de Google o, si no hay, las iniciales.
export default function Avatar() {
  const { user } = useAuth()
  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('') ?? '?'
  return (
    <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-elev text-xs font-medium text-muted">
      {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : initials}
    </span>
  )
}
