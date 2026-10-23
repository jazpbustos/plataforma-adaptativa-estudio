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
