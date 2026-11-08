import { Link } from 'react-router-dom'
import { IconLock } from './Icons.jsx'

// Encabezado de cada pantalla: título corto (con una parte en color si hace falta) y una sola línea chica debajo.
export default function PageHeader({ title, accent, accentColor, sub, action }) {
  return (
    <header className="rise grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-[clamp(1.7rem,3vw,2.2rem)]">
          {title}{accent && <> <span className="accent" style={accentColor ? { color: accentColor } : undefined}>{accent}</span></>}
        </h1>
        {action}
      </div>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </header>
  )
}

// Pantalla de módulo o de progreso: el encabezado y debajo un bloque que ocupa el alto de la ventana, sin desplazar
// la página (cada parte interna tiene su propio desplazamiento). `color` define --c, el color del módulo.
export function Pantalla({ color, children, ...encabezado }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:-mb-20 lg:h-[calc(100dvh-3.5rem)]" style={color ? { '--c': color } : undefined}>
      <PageHeader {...encabezado} />
      {children}
    </div>
  )
}

// Módulo sin plan todavía.
export function SinPlan({ m }) {
  return (
    <div className="grid gap-6">
      <PageHeader title="Módulo" accent={m.label} accentColor={m.color} />
      <p className="text-sm">Todavía no armaste tu plan.</p>
      <div><Link to="/empezar" className="btn btn-primary">Armar mi plan <span className="arrow">→</span></Link></div>
    </div>
  )
}

// HU-011, CA3: el módulo bloqueado informa qué condición falta cumplir y lleva al módulo anterior.
export function Bloqueado({ m, tema, falta, anterior }) {
  return (
    <div className="grid gap-8" style={{ '--c': m.color }}>
      <PageHeader title="Módulo" accent={m.label} accentColor={m.color} sub={tema} />
      <section className="card grid justify-items-start gap-3 p-6">
        <span className="grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-rule text-muted"><IconLock className="size-4" /></span>
        <p className="text-sm">{falta}</p>
        <Link to={anterior.path} className="btn btn-primary btn-sm">Ir a {anterior.label} <span className="arrow">→</span></Link>
      </section>
    </div>
  )
}
