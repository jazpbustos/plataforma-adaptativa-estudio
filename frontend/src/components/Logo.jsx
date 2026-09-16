import { Link } from 'react-router-dom'

// Marcador de posición: el prototipo para la facultad no usa nombre de producto.
export default function Logo() {
  return (
    <Link to="/" className="flex items-baseline gap-0.5 text-[1.05rem] font-medium tracking-tight">
      plataforma<span className="font-mono text-[.8rem] text-violet-strong">/estudio</span>
    </Link>
  )
}
