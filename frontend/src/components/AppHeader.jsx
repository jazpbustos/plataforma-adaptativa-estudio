import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'

export default function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('') ?? '?'

  return (
    <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-[4vw] xl:px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menú de cuenta"
              className="grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-line bg-elev font-mono text-xs text-muted transition hover:border-rule">
              {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : initials}
            </button>
            {open && (
              <div className="rise absolute right-0 mt-2 w-60 rounded-xl border border-line bg-surface p-2 shadow-lg shadow-black/10">
                <div className="border-b border-line px-3 pb-2 pt-1">
                  <p className="truncate text-sm font-medium">{user?.name}</p>
                  <p className="truncate font-mono text-xs text-muted">{user?.email}</p>
                </div>
                <button type="button" className="mt-1 w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-elev hover:text-fg"
                  onClick={async () => { await logout(); navigate('/login') }}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
