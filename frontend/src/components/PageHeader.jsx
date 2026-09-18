// Encabezado de cada pantalla: etiqueta mono, título en dos tonos y bajada.
export default function PageHeader({ kicker, kickerColor, title, accent, sub, action }) {
  return (
    <header className="rise grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {kicker && <span className="label" style={kickerColor ? { color: kickerColor } : undefined}>{kicker}</span>}
        {action}
      </div>
      <h1 className="display text-[clamp(1.9rem,3.6vw,2.6rem)]">
        {title}{accent && <> <span className="accent">{accent}</span></>}
      </h1>
      {sub && <p className="max-w-[62ch] text-muted">{sub}</p>}
    </header>
  )
}
