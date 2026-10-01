import { useEffect, useRef } from 'react'

/*
  Hoja de cuaderno: fondo de papel (puntos, renglones, cuadrícula o lila) con margen violeta.
  Cada hoja se apoya sobre la anterior y, al entrar en pantalla, "se da vuelta" hasta quedar
  plana. Cuando termina de apoyarse la transformación se quita del todo, así no interfiere
  con las secciones con scroll fijo (position: sticky) que viven adentro.
  Con reduced-motion la hoja aparece plana, sin girar.
*/
export default function Sheet({ paper = 'dots', first = false, as: Tag = 'section', className = '', children, ...rest }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (first || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0, last = -1
    const update = () => {
      raf = 0
      const top = el.getBoundingClientRect().top
      // 0 cuando el borde superior asoma por abajo, 1 cuando llega al 30 % de la pantalla
      const p = Math.min(1, Math.max(0, (innerHeight - top) / (innerHeight * .7)))
      if (p === last) return
      last = p
      if (p >= 1) { el.style.transform = ''; el.style.setProperty('--lift', 0); return }
      const e = 1 - (1 - p) ** 3 // desacelera al final, como una hoja que se apoya
      el.style.transform = `perspective(1800px) rotateX(${(1 - e) * 16}deg) translateY(${(1 - e) * 60}px)`
      el.style.setProperty('--lift', (1 - e).toFixed(3))
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll)
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [first])

  return (
    <Tag ref={ref} className={`sheet paper-${paper} ${first ? 'sheet-first' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
