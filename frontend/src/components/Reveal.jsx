import { useEffect, useRef, useState } from 'react'

/*
  Aparición suave al entrar en pantalla. El estado vive en React (no en classList),
  así un re-render o la recarga en caliente de Vite nunca deja el bloque invisible.
  Sin IntersectionObserver o con reduced-motion se muestra directo.
*/
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(() => typeof window === 'undefined' || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (shown) return
    const el = ref.current
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    // red de seguridad: si ya está en pantalla y el observer no dispara, se muestra igual
    const t = setTimeout(() => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) setShown(true) }, 1200)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [shown])

  return (
    <Tag ref={ref} className={`reveal ${shown ? 'is-in' : ''} ${className}`} style={{ ...style, transitionDelay: shown ? `${delay}ms` : '0ms' }} {...rest}>
      {children}
    </Tag>
  )
}
