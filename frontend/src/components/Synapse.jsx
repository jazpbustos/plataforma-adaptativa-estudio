// Loader corto: tres neuronas que se disparan en cadena.
export default function Synapse({ children }) {
  return (
    <span className="inline-flex items-center gap-3 text-[.9rem] text-muted" role="status">
      <span className="syn" aria-hidden="true"><i /><s /><i /><s /><i /></span>
      {children}
    </span>
  )
}
