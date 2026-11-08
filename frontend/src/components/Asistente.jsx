import { useEffect, useState } from 'react'

/*
  Ayudante de Practicar: un cerebrito dibujado a mano, como los garabatos del cuaderno, que vive en la esquina
  del editor y habla con un globo (HU-007). Retoma el cerebro de la identidad visual (del material disperso al
  conocimiento conectado): cuando hay una pista, se encienden a su alrededor chispas naranjas, el color del
  detector, como sinapsis; al resolver, verdes, el color de Practicar.

  estado: 'espera' | 'mirando' | 'pensando' | 'pista' | 'explicacion' | 'festeja'
  El globo se puede cerrar tocando la cruz o la neurona, y se vuelve a abrir solo cuando cambia lo que dice.
*/
export default function Asistente({ estado, titulo, aviso, children, clave }) {
  const [abierto, setAbierto] = useState(true)
  useEffect(() => { setAbierto(true) }, [clave])
  const tono = estado === 'pista' || estado === 'explicacion' ? 'as-globo-pista' : estado === 'festeja' ? 'as-globo-ok' : ''
  return (
    <div className="as-zona">
      {abierto && (
        <div key={clave} className={`as-globo ${tono}`} role="status" aria-live="polite">
          <button type="button" className="as-cerrar" aria-label="Cerrar el globo" onClick={() => setAbierto(false)}>×</button>
          <div className="as-globo-texto">
            {aviso && <span className="pill mb-1.5" style={{ '--c': 'var(--orange)' }}>{aviso}</span>}
            {titulo && <p className="as-titulo">{titulo}</p>}
            <div className="text-[.9rem] leading-relaxed">{children}</div>
          </div>
        </div>
      )}
      <button type="button" className="as-boton" onClick={() => setAbierto((a) => !a)}
        aria-label={abierto ? 'Ocultar el ayudante' : 'Mostrar el ayudante'} aria-expanded={abierto}>
        <Cerebrito estado={estado} />
      </button>
    </div>
  )
}

const CHISPAS = [[14, 38], [27, 14], [70, 5], [113, 14], [126, 38], [129, 78], [11, 78]]

export function Cerebrito({ estado }) {
  const piensa = estado === 'pensando'
  return (
    <svg className={`as-neurona as-${estado}`} viewBox="0 0 140 112" aria-hidden="true">
      {/* chispas (sinapsis) alrededor */}
      <g className="as-dendritas"><path d="M23 42l-7-3M33 23l-4-6M70 16V8M107 23l4-6M117 42l7-3M119 76l7 2M21 76l-7 2" /></g>
      <g className="as-chispas">{CHISPAS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" style={{ animationDelay: `${i * 0.15}s` }} />)}</g>
      {/* cerebro: contorno de nube, cisura central y pliegues */}
      <path className="as-soma" d="M45 92c-12 1-21-8-20-19-8-4-10-15-5-22 0-11 10-19 21-17 4-9 15-13 24-8 6-5 16-5 22 1 10-2 20 5 20 15 9 3 13 14 8 21 5 9-1 20-11 21-2 8-11 12-19 10-6 5-16 5-21 0-8 4-15 3-19-2z" />
      <path className="as-pliegues" d="M70 26c-3 6 2 11-1 17M38 48c5-3 10 1 14-1M32 64c5 2 8-2 12 0M88 48c4 2 9-2 14 1M96 64c4-2 7 2 12 0M54 34c2 4 7 4 9 1M77 35c2 3 7 3 9-1" />
      <ellipse className="as-cachete" cx="55" cy="74" rx="5" ry="3" />
      <ellipse className="as-cachete" cx="85" cy="74" rx="5" ry="3" />
      {estado === 'festeja'
        ? <path className="as-cara-trazo" d="M57 64q5-6 10 0M73 64q5-6 10 0" />
        : <g className="as-ojos">
            <ellipse cx={piensa ? 64 : 62} cy={piensa ? 59 : 63} rx="3.4" ry="4.4" />
            <ellipse cx={piensa ? 80 : 78} cy={piensa ? 59 : 63} rx="3.4" ry="4.4" />
          </g>}
      {piensa
        ? <g className="as-puntos"><circle cx="62" cy="78" r="2.2" /><circle cx="70" cy="78" r="2.2" /><circle cx="78" cy="78" r="2.2" /></g>
        : <path className="as-cara-trazo" d={estado === 'mirando' ? 'M64 77q6 1 12 0' : 'M62 74q8 8 16 0'} />}
    </svg>
  )
}
