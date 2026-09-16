import { useEffect, useState } from 'react'

const next = { system: 'dark', dark: 'light', light: 'system' }
const names = { system: 'sistema', dark: 'oscuro', light: 'claro' }

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'system')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try { theme === 'system' ? localStorage.removeItem('theme') : localStorage.setItem('theme', theme) } catch { /* modo privado */ }
  }, [theme])

  return (
    <button
      type="button"
      onClick={() => setTheme(next[theme])}
      className="cursor-pointer rounded-full border border-line px-3 py-1 font-mono text-xs text-muted transition hover:border-rule hover:text-fg"
    >
      tema: {names[theme]}
    </button>
  )
}
