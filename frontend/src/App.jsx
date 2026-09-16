import { Navigate, Route, Routes } from 'react-router-dom'
import Protected from './components/Protected.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import NuevoPlan from './pages/NuevoPlan.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Home />} />
        <Route path="/estudiar/nuevo" element={<NuevoPlan />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
