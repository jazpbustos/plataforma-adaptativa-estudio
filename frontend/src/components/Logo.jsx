import { Link } from 'react-router-dom'

// Marcador de posición: el prototipo para la facultad no usa nombre de producto.
export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="shrink-0 text-[.95rem] font-semibold tracking-[-.03em] sm:text-[1.05rem]">
      plataforma<span className="accent">/estudio</span>
    </Link>
  )
}
