import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import Sidebar from './Sidebar'
import Header from './Header'

const MainLayout = () => {
  const { user } = useAuth()
  const { userRole } = useRole()
  const navigate = useNavigate()
  const location = useLocation()

  // Redirect to role-specific dashboard if on root
  useEffect(() => {
    if (location.pathname === '/dashboard' || location.pathname === '/') {
      // Wait a bit for role to be set if not available yet
      if (!userRole && user) {
        // Try to get role from user object
        const role = user.role || user.defaultRole
        if (role) {
          const roleRoutes = {
            admin: '/admin',
            relationship_manager: '/rm/dashboard',
            credit_team: '/credit/dashboard',
            operations_team: '/operations/dashboard',
            ceo: '/management/dashboard',
            cfo: '/management/dashboard',
            md: '/management/dashboard',
          }
          const redirectPath = roleRoutes[role] || '/rm/dashboard'
          navigate(redirectPath, { replace: true })
          return
        }
      }
      
      if (userRole) {
        const roleRoutes = {
          admin: '/admin',
          relationship_manager: '/rm/dashboard',
          credit_team: '/credit/dashboard',
          operations_team: '/operations/dashboard',
          ceo: '/management/dashboard',
          cfo: '/management/dashboard',
          md: '/management/dashboard',
        }
        const redirectPath = roleRoutes[userRole] || '/rm/dashboard'
        navigate(redirectPath, { replace: true })
      }
    }
  }, [location.pathname, userRole, user, navigate])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 ml-64">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout

