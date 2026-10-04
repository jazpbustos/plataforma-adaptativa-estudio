import { useEffect } from 'react'

// Las pantallas "de papel" (portada, ingreso y configuración inicial) se ven siempre en claro:
// fuerza data-theme="light" mientras están montadas y al salir devuelve la preferencia de la app.
export default function usePaperTheme() {
  useEffect(() => {
    const root = document.documentElement, prev = root.dataset.theme
    root.dataset.theme = 'light'
    const mo = new MutationObserver(() => { if (root.dataset.theme !== 'light') root.dataset.theme = 'light' })
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { mo.disconnect(); if (prev) root.dataset.theme = prev }
  }, [])
}
