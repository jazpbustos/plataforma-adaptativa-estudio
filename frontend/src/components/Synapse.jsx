// Loader corto: un trazo a mano que se dibuja en bucle, como si alguien estuviera escribiendo.
export default function Synapse({ children }) {
  return (
    <span className="inline-flex items-center gap-3 text-[.9rem] text-muted" role="status">
      <svg className="ld-write" viewBox="0 0 40 14" aria-hidden="true">
        <path pathLength="100" d="M2 9c2-6 4 6 6 0s4-6 6 0 4 6 6 0 4-6 6 0 4 6 6 0" />
      </svg>
      {children}
    </span>
  )
}
