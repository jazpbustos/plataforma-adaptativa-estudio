import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { IconChart, IconCode, IconExplain, IconFile, IconGear, IconHome, IconLearn, IconMenu } from './Icons.jsx'
import Logo from './Logo.jsx'
import { TEAR_V } from './Notebook.jsx'

const NAV = [
  ['/app', 'Inicio', IconHome, true],
  ['/app/material', 'Mi material', IconFile],
  ['/app/aprender', 'Aprender', IconLearn],
  ['/app/practicar', 'Practicar', IconCode],
  ['/app/consolidar', 'Consolidar', IconExplain],
  ['/app/progreso', 'Progreso', IconChart],
]

/*
  Estructura de la app autenticada: menú lateral + contenido.
  Pide /dashboard una vez y lo comparte con las pantallas hijas vía useOutletContext().
*/
export default function AppShell() {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false) // menú en celular
  const [menu, setMenu] = useState(false) // menú de cuenta
  const location = useLocation()
  // Tema activo: el que se eligió por última vez (queda guardado en este navegador) o el recién creado.
  const [planId, setPlanId] = useState(() => {
    try {
      if (location.state?.planId) { localStorage.setItem('planActivo', String(location.state.planId)); return location.state.planId }
      return Number(localStorage.getItem('planActivo')) || null
    } catch { return location.state?.planId ?? null }
  })
  const selectPlan = useCallback((id) => {
    setPlanId(id)
    try { localStorage.setItem('planActivo', String(id)) } catch { /* modo privado: queda solo en memoria */ }
  }, [])
  const navigate = useNavigate()
  const menuRef = useRef(null)

  const reload = useCallback(() => api('/dashboard').then(setData).catch((e) => setError(e.message)), [])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { setOpen(false); setMenu(false) }, [location.pathname])
  useEffect(() => {
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const plan = data?.plans?.find((p) => p.id === planId) ?? data?.plans?.[0]
  const initials = user?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('') ?? '?'

  const sidebar = (
    <nav className="flex h-full flex-col gap-8 p-5" aria-label="Principal">
      <div className="px-1 pt-1"><Logo to="/app" /></div>
      <ul className="grid gap-1">
        {NAV.map(([to, label, Icon, end]) => (
          <li key={to}><NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon />{label}</NavLink></li>
        ))}
      </ul>
      <div className="mt-auto">
        <NavLink to="/app/configuracion" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><IconGear />Configuración</NavLink>
      </div>
    </nav>
  )

  return (
    <div className="notebook app-paper min-h-dvh overflow-x-clip md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="nb-sidesheet sticky top-0 hidden h-dvh md:block">
        {sidebar}
        <svg className="nb-sidetear" viewBox="0 0 20 1440" preserveAspectRatio="none" aria-hidden="true"><path d={TEAR_V} /></svg>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="nb-sidesheet rise absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      <div className="nb-page nb-lined min-h-dvh min-w-0">
        <div className="nb-sheetbar sticky top-0 z-20">
          <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-3 px-4 py-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className="btn btn-ghost -ml-2 md:hidden" aria-label="Abrir menú" onClick={() => setOpen(true)}><IconMenu className="size-5" /></button>
              <span className="truncate text-sm text-muted">Mi espacio{plan ? <> / <span className="text-fg">{plan.topic}</span></> : ''}</span>
            </div>
            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menú de cuenta"
                className="grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full bg-elev text-xs font-medium text-muted transition hover:text-fg">
                {user?.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : initials}
              </button>
              {menu && (
                <div className="rise card absolute right-0 mt-2 w-60 p-2 shadow-xl shadow-black/20">
                  <div className="border-b border-line px-3 pt-1 pb-2">
                    <p className="truncate text-sm font-medium">{user?.name}</p>
                    <p className="truncate text-xs text-muted">{user?.email}</p>
                  </div>
                  <button type="button" className="mt-1 w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-elev hover:text-fg"
                    onClick={async () => { await logout(); navigate('/') }}>Cerrar sesión</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <main className="relative z-[2] mx-auto max-w-[1040px] px-4 pt-4 pb-20 sm:px-8 md:pl-12">
          {error ? <p role="alert" className="text-red">{error}</p> : <Outlet context={{ data, reload, plan, selectPlan }} />}
        </main>
      </div>
    </div>
  )
}
