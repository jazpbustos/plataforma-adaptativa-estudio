import { Link, useOutletContext } from 'react-router-dom'
import { IconLock } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { MODULES } from '../lib/format.js'

// Pantallas de los módulos mientras se construyen: explican qué van a hacer y dónde está la ruta hoy.
const COPY = {
  aprender: {
    title: 'Entendé el tema', accent: 'a tu manera.',
    sub: 'Cada sesión se genera desde el material híbrido del tema: tus apuntes, si los cargaste, y fuentes académicas indexadas.',
    items: ['Resumen con las ideas clave del tema', 'Preguntas guiadas para llegar a las ideas paso a paso', 'Ejercicio práctico sobre un caso concreto'],
  },
  practicar: {
    title: 'Si te trabás,', accent: 'la ayuda llega sola.',
    sub: 'Un editor de código que observa cómo resolvés, no solo el resultado.',
    items: ['Editor con ejecución y validación del código', 'Detección de bloqueos a partir de la edición, compilación y ejecución', 'Retroalimentación sin que tengas que pedirla'],
  },
  consolidar: {
    title: 'Explicalo', accent: 'con tus palabras.',
    sub: 'Explicás el tema con tus palabras y el sistema verifica que tu explicación sea correcta.',
    items: ['Explicación del tema con tus propias palabras', 'Verificación automática de la explicación', 'Preguntas de seguimiento ante partes incompletas o incorrectas'],
  },
}

export default function Modulo({ module }) {
  const m = MODULES[module], c = COPY[module]
  const { data } = useOutletContext()
  const plan = data?.plans?.[0]
  const s = plan?.by_module?.[module]

  return (
    <div className="grid gap-8" style={{ '--c': m.color }}>
      <PageHeader kicker={`${m.n} / ${m.label}`} kickerColor={m.color} title={c.title} accent={c.accent} sub={c.sub}
        action={<span className="pill">En construcción</span>} />

      <section className="card grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid content-start gap-4">
          <span className="label">Qué vas a encontrar acá</span>
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
            <p className="text-sm">Tu ruta tiene <b className="font-medium">{s?.total ?? 0} sesiones</b> de {m.label} para <b className="font-medium">{plan.topic}</b>. Quedan guardadas para cuando el módulo esté listo.</p>
          ) : (
            <p className="text-sm">Todavía no armaste tu ruta. Empezá por configurar tu objetivo.</p>
          )}
          <Link to={plan ? '/app' : '/empezar'} className="btn btn-primary btn-sm">{plan ? 'Volver al inicio' : 'Configurar objetivo'}</Link>
        </div>
      </section>
    </div>
  )
}
