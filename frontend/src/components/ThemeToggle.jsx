import { useEffect, useState } from 'react'

/*
  Tema: solo claro u oscuro.
  - Sin elección guardada: se toma el del sistema y se sigue si el sistema cambia.
  - Al elegir uno, queda guardado en este navegador.
*/
const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
const stored = () => { try { return localStorage.getItem('theme') } catch { return null } }

export function useTheme() {
  const [theme, setThemeState] = useState(() => (stored() === 'dark' || stored() === 'light' ? stored() : systemTheme()))

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (!stored()) setThemeState(systemTheme()) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = (t) => { try { localStorage.setItem('theme', t) } catch { /* modo privado */ } setThemeState(t) }
  return [theme, setTheme]
}

// Botón redondo con ícono: muestra el tema al que vas a pasar.
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" onClick={() => setTheme(nextTheme)} aria-label={`Cambiar a modo ${nextTheme === 'dark' ? 'oscuro' : 'claro'}`} title={`Modo ${nextTheme === 'dark' ? 'oscuro' : 'claro'}`}
      className="grid size-8 cursor-pointer place-items-center rounded-full text-muted transition hover:bg-elev hover:text-fg">
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        {nextTheme === 'light'
          ? <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" /></>
          : <path d="M13 9.6A5.5 5.5 0 016.4 3a5.5 5.5 0 106.6 6.6z" />}
      </svg>
    </button>
  )
}

// Selector de dos opciones para Configuración.
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme()
  return (
    <div role="radiogroup" aria-label="Apariencia" className="flex gap-1 rounded-full bg-elev p-1">
      {[['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) => (
        <button key={v} type="button" role="radio" aria-checked={theme === v} onClick={() => setTheme(v)}
          className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium transition ${theme === v ? 'bg-card text-fg shadow-sm' : 'text-muted hover:text-fg'}`}>{t}</button>
      ))}
    </div>
  )
}
