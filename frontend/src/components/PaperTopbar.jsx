import Logo from './Logo.jsx'
import { TEAR } from './Notebook.jsx'

// Hoja superior con borde rasgado: la misma barra de la portada y del ingreso.
export default function PaperTopbar({ logoTo = '/', right }) {
  return (
    <div className="nb-topsheet">
      <header className="relative mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-10">
        <Logo to={logoTo} />
        <div className="flex items-center gap-5">{right}</div>
      </header>
      <svg className="nb-toptear" viewBox="0 0 1440 20" preserveAspectRatio="none" aria-hidden="true"><path d={TEAR} /></svg>
    </div>
  )
}
