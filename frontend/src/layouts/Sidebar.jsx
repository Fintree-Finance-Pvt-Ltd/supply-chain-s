import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole, ROLE_MENU_CONFIG } from '../hooks/useRole'
import { ROLE_LABELS } from '../constants/roles'
import {
  FiHome,
  FiUsers,
  FiSettings,
  FiCheckCircle,
  FiUserPlus,
  FiShield,
  FiGitBranch,
  FiFileText,
  FiBarChart,
  FiFolder,
  FiChevronDown,
  FiChevronUp,
  FiLayers,
  FiDollarSign,
} from 'react-icons/fi'

// Icon mapping
const iconMap = {
  FiHome,
  FiUsers,
  FiSettings,
  FiCheckCircle,
  FiUserPlus,
  FiShield,
  FiGitBranch,
  FiFileText,
  FiBarChart,
  FiFolder,
  FiLayers,
  FiDollarSign,
}

const Sidebar = () => {
  const { logout, user } = useAuth()
  const { roles, getAllMenuItems, getAvailableRoles, getMenuItemsForRoles } = useRole()
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false)
  const [selectedRole, setSelectedRole] = useState(null)

  const handleLogout = () => {
    logout()
  }

  // Get all merged menu items from all roles
  const allMenuItems = getAllMenuItems()
  
  // Get available roles for role switcher
  const availableRoles = getAvailableRoles()
  const hasMultipleRoles = availableRoles.length > 1

  // Handle role selection from switcher
  const handleRoleSelect = (role) => {
    setSelectedRole(role)
    setShowRoleSwitcher(false)
  }

  // If a role is selected, show only that role's menu items
  // Otherwise show merged menu items from all roles
  const navItems = selectedRole 
    ? getMenuItemsForRoles([selectedRole]) 
    : allMenuItems

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 shadow-sm z-10 flex flex-col">
      {/* Role Switcher */}
      {hasMultipleRoles && (
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <button
              onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center">
                <FiLayers className="mr-2 h-4 w-4" />
                {selectedRole 
                  ? ROLE_LABELS[selectedRole] || selectedRole 
                  : `All Roles (${availableRoles.length})`
                }
              </span>
              {showRoleSwitcher ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
            </button>
            
            {showRoleSwitcher && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => handleRoleSelect(null)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    !selectedRole ? 'bg-primary-50 text-primary-600' : ''
                  }`}
                >
                  All Roles (Merged)
                </button>
                {availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelect(role)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      selectedRole === role ? 'bg-primary-50 text-primary-600' : ''
                    }`}
                  >
                    {ROLE_LABELS[role] || role}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const IconComponent = iconMap[item.icon] || FiHome
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <IconComponent className="mr-3 h-5 w-5" />
                  {item.label}
                </NavLink>
              </li>
            )
          })}
        </ul>
        
        {navItems.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">No menu items available</p>
            <p className="text-xs mt-1">Select a role from the switcher above</p>
          </div>
        )}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="mb-2 px-4 text-sm text-gray-600">
          <p className="font-medium">{user?.name}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
          {hasMultipleRoles && (
            <div className="mt-2 flex flex-wrap gap-1">
              {availableRoles.map((role) => (
                <span
                  key={role}
                  className="inline-block px-2 py-0.5 text-xs bg-gray-100 rounded-full"
                >
                  {ROLE_LABELS[role] || role}
                </span>
              ))}
            </div>
          )}
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
