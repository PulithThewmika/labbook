import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Spinner } from './components/feedback'
import { useAuth } from './lib/auth'
import AuthCallback from './pages/AuthCallback'
import AdminEquipment from './pages/admin/AdminEquipment'
import AdminLabs from './pages/admin/AdminLabs'
import Approvals from './pages/admin/Approvals'
import Dashboard from './pages/admin/Dashboard'
import Book from './pages/Book'
import Equipment from './pages/Equipment'
import LabDetail from './pages/LabDetail'
import Labs from './pages/Labs'
import Landing from './pages/Landing'
import MyBookings from './pages/MyBookings'

function RequireAuth() {
  const { status } = useAuth()
  if (status === 'loading') return <Spinner />
  return status === 'signedIn' ? <Outlet /> : <Navigate to="/" replace />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/labs" replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<RequireAuth />}>
        <Route path="/labs" element={<Labs />} />
        <Route path="/labs/:id" element={<LabDetail />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/book" element={<Book />} />
        <Route path="/bookings" element={<MyBookings />} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/approvals" element={<Approvals />} />
          <Route path="/admin/labs" element={<AdminLabs />} />
          <Route path="/admin/equipment" element={<AdminEquipment />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
