import { useEffect, useState } from 'react'

// true si el tema efectivo es oscuro (por elección o por el sistema). Se actualiza al cambiar.
export default function useIsDark() {
  const read = () => getComputedStyle(document.documentElement).colorScheme === 'dark'
  const [dark, setDark] = useState(read)
  useEffect(() => {
    const update = () => requestAnimationFrame(() => setDark(read()))
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    return () => { mo.disconnect(); mq.removeEventListener('change', update) }
  }, [])
  return dark
}
