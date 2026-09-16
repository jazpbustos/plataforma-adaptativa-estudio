import { MODULES } from '../lib/format.js'

const Check = () => <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
const Lock = () => <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" /></svg>

// Ruta en miniatura: cada módulo es una neurona. Hecha / actual (con halo) / bloqueada (punteada).
export default function RouteChain({ byModule, current }) {
  const keys = Object.keys(MODULES)
  const currentIdx = keys.indexOf(current)
  return (
    <ol className="flex items-center" aria-label="Ruta de aprendizaje">
      {keys.map((k, i) => {
        const { label, color } = MODULES[k]
        const m = byModule?.[k] ?? { done: 0, total: 0 }
        const state = m.total && m.done === m.total ? 'done' : i === currentIdx ? 'now' : i < currentIdx ? 'done' : 'locked'
        return (
          <li key={k} className="flex min-w-0 flex-1 items-center last:flex-none" style={{ '--c': color }}>
            <div className="grid justify-items-center gap-1.5">
              <span
                className={`relative grid size-9 place-items-center rounded-full border-[1.5px] font-mono text-xs ${
                  state === 'done' ? 'border-[var(--c)] bg-[var(--c)] text-bg'
                  : state === 'now' ? 'halo border-[var(--c)] bg-bg text-[var(--c)]'
                  : 'border-dashed border-rule bg-bg text-muted'}`}
              >
                {state === 'done' ? <Check /> : state === 'locked' ? <Lock /> : i + 1}
              </span>
              <span className={`font-mono text-[.68rem] ${state === 'locked' ? 'text-muted' : 'text-fg'}`}>{label}</span>
              <span className="font-mono text-[.64rem] text-muted">{m.done}/{m.total}</span>
            </div>
            {i < keys.length - 1 && (
              <span className="mx-2 mb-10 h-0.5 flex-1 rounded"
                style={{ background: state === 'locked' ? 'var(--border)' : `linear-gradient(90deg, ${color}, ${i + 1 <= currentIdx ? MODULES[keys[i + 1]].color : 'var(--rule)'})` }} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
