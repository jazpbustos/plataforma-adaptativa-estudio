import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import Protected from './components/Protected.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import NuevoPlan from './pages/NuevoPlan.jsx'
import Home from './pages/Home.jsx'
import Material from './pages/Material.jsx'
import Progreso from './pages/Progreso.jsx'
import Modulo from './pages/Modulo.jsx'
import Configuracion from './pages/Configuracion.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/ingresar" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/empezar" element={<NuevoPlan />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="material" element={<Material />} />
          <Route path="aprender" element={<Modulo module="aprender" />} />
          <Route path="practicar" element={<Modulo module="practicar" />} />
          <Route path="consolidar" element={<Modulo module="consolidar" />} />
          <Route path="progreso" element={<Progreso />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
