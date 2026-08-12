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
      const currentRole = userRole || user?.role || user?.defaultRole

       const roleRoutes = {
         superadmin: '/superadmin',
         admin: '/admin',
         relationship_manager: '/rm/dashboard',
         credit_team: '/credit/dashboard',
         credit_team_l1: '/credit/dashboard',
         credit_team_l2: '/credit/dashboard',
         credit_head: '/credit/dashboard',
         operations_team: '/operations/loan-search',
         operations_team_l1: '/operations/dashboard',
         operations_team_l2: '/operations/dashboard',
         operations_head: '/operations/dashboard',
         ceo: '/management/dashboard',
         cfo: '/management/dashboard',
         md: '/management/dashboard',
       }

      if (currentRole) {
        const redirectPath = roleRoutes[currentRole.toLowerCase()] || '/rm/dashboard'
        console.log('MainLayout redirecting:', { currentRole, redirectPath })
        navigate(redirectPath, { replace: true })
      }
    }
  }, [location.pathname, userRole, user, navigate])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 ml-64 mt-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout

