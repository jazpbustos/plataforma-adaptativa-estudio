import { Link, useOutletContext } from 'react-router-dom'
import { IconLock } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { MODULES } from '../lib/format.js'

// Pantallas de los módulos mientras se construyen: explican qué van a hacer y dónde está la ruta hoy.
const COPY = {
  aprender: {
    sub: 'Comprendé el tema con un resumen o preguntas guiadas.',
    items: ['Resumen con las ideas clave del tema', 'Preguntas guiadas para llegar a las ideas paso a paso', 'Preguntas de comprensión al final'],
  },
  practicar: {
    sub: 'Resolvé ejercicios. Si te trabás, la ayuda llega sola.',
    items: ['Editor de código integrado', 'Detección de bloqueos mientras resolvés', 'Pistas sin que tengas que pedirlas'],
  },
  consolidar: {
    sub: 'Explicá el tema con tus palabras.',
    items: ['Tu explicación del tema', 'Verificación automática de lo que explicaste', 'Preguntas de seguimiento sobre lo que falta'],
  },
}

export default function Modulo({ module }) {
  const m = MODULES[module], c = COPY[module]
  const { plan } = useOutletContext()
  const s = plan?.by_module?.[module]

  return (
    <div className="grid gap-8" style={{ '--c': m.color }}>
      <PageHeader title="Módulo" accent={m.label} accentColor={m.color} sub={c.sub}
        action={<span className="pill">En construcción</span>} />

      <section className="card grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid content-start gap-4">
          <ul className="grid gap-2.5">
            {c.items.map((it) => (
              <li key={it} className="flex items-start gap-3 text-sm">
                <i className="mt-2 size-1.5 flex-none rounded-full bg-[var(--c)]" />{it}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid content-start justify-items-start gap-3 rounded-xl bg-elev p-5">
          <span className="grid size-9 place-items-center rounded-full border-[1.5px] border-dashed border-rule text-muted"><IconLock className="size-4" /></span>
          {plan ? (
            <p className="text-sm"><b className="font-medium">{s?.total ?? 0} sesiones</b> de {m.label} en {plan.topic}.</p>
          ) : (
            <p className="text-sm">Todavía no armaste tu plan.</p>
          )}
          <Link to={plan ? '/app' : '/empezar'} className="btn btn-primary btn-sm">{plan ? 'Volver al inicio' : 'Armar mi plan'}</Link>
        </div>
      </section>
    </div>
  )
}
