/*
  Garabatos estilo cuaderno compartidos por el hero, la ruta y el cierre:
  hoja, código y chat dibujados a mano + la etiqueta manuscrita de sección (Kicker).
*/
const INK = 'var(--ink-hand, #3a2a7a)'
export const Doodle = ({ children, size = 'clamp(64px, 5.8vw, 96px)' }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="nb-doodle" style={{ width: size, height: size }} aria-hidden="true">{children}</svg>
)
export const DocDoodle = (p) => (
  <Doodle {...p}>
    <path d="M26 14c10-2 26-1 36 0l14 14c1 12 0 38-1 56-14 2-36 1-50 0-1-22-1-48 1-70z" fill="var(--doodle-fill)" />
    <path d="M62 14c0 6-1 11 1 14 4 1 9 0 13 0" />
    <path d="M34 44c8-1 22 0 32-1M34 56c10 1 20-1 32 0M34 68c6 0 14 1 20 0" />
    <path d="M80 20l2 6m4-9l-3 5m5 1l-6-1" strokeWidth="2.4" />
  </Doodle>
)
export const CodeDoodle = (p) => (
  <Doodle {...p}>
    <path d="M14 22c20-3 52-2 72 0 2 18 2 36 0 56-20 2-52 3-72 0-2-18-2-38 0-56z" fill="var(--doodle-fill)" />
    <path d="M40 38L26 50l14 12M60 38l14 12-14 12M54 34l-8 32" strokeWidth="4" />
    <path d="M20 29h.01M28 29h.01M36 29h.01" strokeWidth="4.5" />
  </Doodle>
)
export const QuizDoodle = (p) => (
  <Doodle {...p}>
    <path d="M26 14c10-2 26-1 36 0l14 14c1 12 0 38-1 56-14 2-36 1-50 0-1-22-1-48 1-70z" fill="var(--doodle-fill)" />
    <path d="M62 14c0 6-1 11 1 14 4 1 9 0 13 0" />
    <path d="M32 38h8v8h-8zM32 54h8v8h-8zM32 70h8v8h-8z" strokeWidth="2.6" />
    <path d="M33 42l3 3 6-8M33 58l3 3 6-8" strokeWidth="3.2" />
    <path d="M48 42h20M48 58h20M48 74h14" strokeWidth="2.8" />
    <path d="M80 20l2 6m4-9l-3 5m5 1l-6-1" strokeWidth="2.4" />
  </Doodle>
)
export const ChatDoodle = (p) => (
  <Doodle {...p}>
    <path d="M16 22c20-4 48-3 68 0 3 14 3 28 0 40-12 2-24 1-34 2L32 82V64c-6 0-12-1-16-2-3-13-3-26 0-40z" fill="var(--doodle-fill)" />
    <path d="M36 44h.01M50 44h.01M64 44h.01" strokeWidth="6" />
    <path d="M78 10l2 7m5-10l-3 6m7 1l-7-1" strokeWidth="2.4" />
  </Doodle>
)
export const BulbDoodle = (p) => (
  <Doodle {...p}>
    <path d="M50 14c-16 0-27 12-27 26 0 10 5 16 10 22 3 4 4 8 4 12h26c0-4 1-8 4-12 5-6 10-12 10-22 0-14-11-26-27-26z" fill="var(--doodle-fill)" />
    <path d="M38 80h24M42 88h16" />
    <path d="M44 66V52l6-6 6 6v14" strokeWidth="2.6" />
    <path d="M50 3v5M17 15l4 4M83 15l-4 4M6 42h5M89 42h5" strokeWidth="2.6" />
  </Doodle>
)
export const BrainDoodle = (p) => (
  <Doodle {...p}>
    <path d="M50 20C44 8 27 11 26 24c-10 0-16 12-9 21-5 9 1 21 11 20 3 10 16 12 22 5V20z" fill="var(--doodle-fill)" />
    <path d="M50 20c6-12 23-9 24 4 10 0 16 12 9 21 5 9-1 21-11 20-3 10-16 12-22 5" fill="var(--doodle-fill)" />
    <path d="M36 38c4 2 8 0 10-4M64 40c-4 2-8 0-10-4M33 54c5 2 9 0 13-3M67 54c-5 2-9 0-13-3" strokeWidth="2.6" />
    <path d="M44 70v14M56 70v14M44 84h12" strokeWidth="2.6" />
  </Doodle>
)
export const SmileDoodle = (p) => (
  <Doodle {...p}>
    <path d="M50 14c20 0 36 15 36 36S72 86 50 86 14 71 14 50s15-36 36-36z" fill="var(--doodle-fill)" />
    <path d="M38 42h.01M62 42h.01" strokeWidth="6" />
    <path d="M33 58c7 12 27 12 34 0" />
    <path d="M84 12l2 7m5-10l-3 6m7 1l-7-1" strokeWidth="2.4" />
  </Doodle>
)
export const FootDoodle = (p) => (
  <Doodle {...p}>
    <ellipse cx="36" cy="54" rx="11" ry="15" transform="rotate(-10 36 54)" fill="var(--doodle-fill)" />
    <ellipse cx="39" cy="79" rx="7" ry="7" fill="var(--doodle-fill)" />
    <ellipse cx="66" cy="28" rx="11" ry="15" transform="rotate(10 66 28)" fill="var(--doodle-fill)" />
    <ellipse cx="63" cy="53" rx="7" ry="7" fill="var(--doodle-fill)" />
  </Doodle>
)
export const FlagDoodle = (p) => (
  <Doodle {...p}>
    <path d="M30 90V14" />
    <path d="M30 16c14-7 24 7 42 0v34c-18 7-28-7-42 0z" fill="var(--doodle-fill)" />
    <path d="M20 90h24" />
    <path d="M80 14l2 6m4-9l-3 5" strokeWidth="2.4" />
  </Doodle>
)
export const MedalDoodle = (p) => (
  <Doodle {...p}>
    <path d="M32 10l12 26M68 10L56 36" />
    <path d="M50 34c15 0 26 11 26 25S65 85 50 85 24 73 24 59s11-25 26-25z" fill="var(--doodle-fill)" />
    <path d="M50 46l4 8 9 1-6.5 6 1.8 9-8.3-4.4L41.7 70l1.8-9-6.5-6 9-1z" strokeWidth="2.6" />
    <path d="M82 22l2 6m5-9l-3 5" strokeWidth="2.4" />
  </Doodle>
)
export const CalendarDoodle = (p) => (
  <Doodle {...p}>
    <path d="M16 26c22-2 46-2 68 0 2 18 2 40 0 58-22 2-46 2-68 0-2-18-2-40 0-58z" fill="var(--doodle-fill)" />
    <path d="M17 40c22-1 44-1 66 0" />
    <path d="M34 17v15M66 17v15" />
    <path d="M28 52h.01M42 52h.01M56 52h.01M70 52h.01M28 66h.01M42 66h.01M28 78h.01M42 78h.01M70 78h.01" strokeWidth="5" />
    <path d="M51 59c4-3 12-2 13 4 1 6-4 10-9 9-5 0-8-4-7-8 0-2 2-4 4-5" strokeWidth="2.8" />
    <path d="M86 12l2 6m5-9l-3 5m6 2l-6-1" strokeWidth="2.4" />
  </Doodle>
)
/* Hoja corregida con la nota encerrada, como la marca un docente */
export const GradeDoodle = (p) => (
  <Doodle {...p}>
    <path d="M24 12c10-2 26-1 36 0l14 14c1 12 0 40-1 58-14 2-36 1-50 0-1-22-1-50 1-72z" fill="var(--doodle-fill)" />
    <path d="M60 12c0 6-1 11 1 14 4 1 9 0 13 0" />
    <path d="M32 30c7-1 14 0 20-1M32 39c9 0 16-1 24 0" strokeWidth="2.6" />
    <path d="M41 56l5-4v25" strokeWidth="3.6" />
    <path d="M60 52c5 0 8 6 8 13s-3 12-8 12-8-6-8-12 3-13 8-13z" strokeWidth="3.6" />
    <path d="M33 66c-1-12 12-20 28-19 15 1 26 9 25 19-1 11-15 18-30 17-13-1-24-7-24-16 0-6 4-10 10-13" strokeWidth="2.4" />
    <path d="M86 40l3 5m4-9l-3 5m6 2l-6-1" strokeWidth="2.4" />
  </Doodle>
)
/* Garabato flotante con aclaración manuscrita opcional */
export function Floaty({ children, rot = 0, delay = 0, label, className = '', style }) {
  return (
    <div aria-hidden="true" className={`nb-floaty ${className}`} style={style}>
      <div className="nb-float" style={{ '--r': `${rot}deg`, '--fd': `${delay}s` }}>{children}</div>
      {label && <span className="nb-floatlabel">{label}</span>}
    </div>
  )
}
/* Etiqueta de sección a mano, con subrayado ondulado */
export function Kicker({ children, color, className = '' }) {
  return (
    <span className={`nb-kicker ${className}`} style={color ? { color } : undefined}>
      {children}
      <svg viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6C20 2 40 9 60 5S100 3 118 6" /></svg>
    </span>
  )
}
