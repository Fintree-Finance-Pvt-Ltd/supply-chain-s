import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import { ROLES } from '../constants/roles'
import {
  FiHome,
  FiUsers,
  FiSettings,
  FiCheckCircle,
  FiUserPlus,
  FiShield,
  FiGitBranch,
} from 'react-icons/fi'

const Sidebar = () => {
  const { logout, user } = useAuth()
  const { userRole, isAdmin, isManagement } = useRole()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
  }

  const getNavItems = () => {
    switch (userRole) {
      case ROLES.ADMIN:
        return [
          { path: '/admin', label: 'Dashboard', icon: FiHome },
          { path: '/admin/users', label: 'User Management', icon: FiUsers },
          { path: '/admin/roles', label: 'Role Management', icon: FiShield },
          { path: '/admin/approval-flows', label: 'Approval Flows', icon: FiGitBranch },
        ]

      case ROLES.RELATIONSHIP_MANAGER:
        return [
          { path: '/rm/dashboard', label: 'Dashboard', icon: FiHome },
          { path: '/rm/customer/new', label: 'New Customer', icon: FiUserPlus },
        ]

      case ROLES.CREDIT_TEAM_L1:
      case ROLES.CREDIT_TEAM_L2:
        return [
          { path: '/credit/dashboard', label: 'Credit Dashboard', icon: FiHome },
          { path: '/credit/pending', label: 'Pending Sanctions', icon: FiCheckCircle },
        ]

      case ROLES.OPERATIONS_TEAM_L1:
        return [
          { path: '/operations/dashboard', label: 'Ops Dashboard', icon: FiHome },
          { path: '/operations/supplier/onboard', label: 'Onboard Supplier', icon: FiUserPlus },
          { path: '/operations/pending', label: 'Pending Checks', icon: FiCheckCircle },
        ]
      case ROLES.OPERATIONS_TEAM_L2:
        return [
          { path: '/operations/dashboard', label: 'Ops Dashboard', icon: FiHome },
          { path: '/operations/pending', label: 'Pending Checks', icon: FiCheckCircle },
        ]
      case ROLES.OPERATIONS_HEAD:
        return [
          { path: '/operations/dashboard', label: 'Ops Dashboard', icon: FiHome },
          { path: '/operations/pending', label: 'Customer Checks', icon: FiCheckCircle },
        ]

      case ROLES.CEO:
      case ROLES.CFO:
      case ROLES.MD:
        return [
          { path: '/management/dashboard', label: 'Management Dashboard', icon: FiHome },
          { path: '/management/approvals', label: 'Pending Approvals', icon: FiCheckCircle },
        ]

      default:
        return []
    }
  }

  const navItems = getNavItems()

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 shadow-sm z-10">
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="mb-2 px-4 text-sm text-gray-600">
          <p className="font-medium">{user?.name}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <FiSettings className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}

export default Sidebar

