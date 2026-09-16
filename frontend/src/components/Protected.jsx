import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Synapse from './Synapse.jsx'

export default function Protected() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid min-h-dvh place-items-center"><Synapse>Cargando</Synapse></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
