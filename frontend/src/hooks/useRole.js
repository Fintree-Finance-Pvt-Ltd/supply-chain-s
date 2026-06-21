import { useSelector } from 'react-redux'
import { ROLES } from '../constants/roles'

// Menu configuration for each role - defines what sidebar items each role has
export const ROLE_MENU_CONFIG = {
  [ROLES.ADMIN]: [
    { path: '/admin', label: 'Admin Dashboard', icon: 'FiHome' },
    { path: '/admin/users', label: 'User Management', icon: 'FiUsers' },
    { path: '/admin/roles', label: 'Role Management', icon: 'FiShield' },
    { path: '/admin/approval-flows', label: 'Approval Flows', icon: 'FiGitBranch' },
    { path: '/operations/loan-servicing', label: 'Loan Servicing', icon: 'FiDollarSign' },
  ],
  [ROLES.RELATIONSHIP_MANAGER]: [
    { path: '/rm/dashboard', label: 'Dashboard', icon: 'FiHome' },
    { path: '/rm/customer/new', label: 'New Customer', icon: 'FiUserPlus' },
    { path: '/invoice-discounting/rm', label: 'Invoice Discounting', icon: 'FiFileText' },
  ],
   [ROLES.CREDIT_TEAM_L1]: [
     { path: '/credit/dashboard', label: 'Credit Dashboard', icon: 'FiHome' },
     { path: '/credit/pending', label: 'Pending Sanctions', icon: 'FiCheckCircle' },
   ],
   [ROLES.CREDIT_TEAM_L2]: [
     { path: '/credit/dashboard', label: 'Credit Dashboard', icon: 'FiHome' },
     { path: '/credit/pending', label: 'Pending Sanctions', icon: 'FiCheckCircle' },
   ],
   [ROLES.CREDIT_HEAD]: [
     { path: '/credit/dashboard', label: 'Credit Dashboard', icon: 'FiHome' },
     { path: '/credit/pending', label: 'Pending Sanctions', icon: 'FiCheckCircle' },
   ],
  [ROLES.OPERATIONS_TEAM_L1]: [
    { path: '/operations/dashboard', label: 'Ops Dashboard', icon: 'FiHome' },
    { path: '/operations/pending', label: 'Pending Checks', icon: 'FiCheckCircle' },
    { path: '/operations/suppliers', label: 'Supplier Onboarding', icon: 'FiUserPlus' },
    { path: '/invoice-discounting/ops-l1', label: 'Invoice Discounting', icon: 'FiFileText' },
    { path: '/operations/repayment-upload', label: 'Repayment Upload', icon: 'FiDollarSign' },
    { path: '/operations/loan-servicing', label: 'Loan Servicing', icon: 'FiDollarSign' },
  ],
  [ROLES.OPERATIONS_TEAM_L2]: [
    { path: '/operations/dashboard', label: 'Ops Dashboard', icon: 'FiHome' },
    { path: '/operations/pending', label: 'Pending Checks', icon: 'FiCheckCircle' },
    { path: '/operations/suppliers', label: 'Supplier Onboarding', icon: 'FiUserPlus' },
    { path: '/invoice-discounting/ops-l2', label: 'Invoice Discounting', icon: 'FiFileText' },
    { path: '/operations/repayment-upload', label: 'Repayment Upload', icon: 'FiDollarSign' },
    { path: '/operations/loan-servicing', label: 'Loan Servicing', icon: 'FiDollarSign' },
  ],
  [ROLES.OPERATIONS_HEAD]: [
    { path: '/operations/dashboard', label: 'Ops Dashboard', icon: 'FiHome' },
    { path: '/operations/pending', label: 'Pending Checks', icon: 'FiCheckCircle' },
    { path: '/operations/suppliers', label: 'Supplier Onboarding', icon: 'FiUserPlus' },
    { path: '/invoice-discounting/ops-head', label: 'Invoice Discounting', icon: 'FiFileText' },
    { path: '/operations/repayment-upload', label: 'Repayment Upload', icon: 'FiDollarSign' },
    { path: '/operations/loan-servicing', label: 'Loan Servicing', icon: 'FiDollarSign' },
  ],
  [ROLES.CEO]: [
    { path: '/management/dashboard', label: 'Management Dashboard', icon: 'FiHome' },
  ],
  [ROLES.CFO]: [
    { path: '/management/dashboard', label: 'Management Dashboard', icon: 'FiHome' },
    { path: '/invoice-discounting/md', label: 'Invoice Discounting', icon: 'FiFileText' },
  ],
  [ROLES.MD]: [
    { path: '/management/dashboard', label: 'Management Dashboard', icon: 'FiHome' },
    { path: '/management/ceo-approvals', label: 'Pending Approvals', icon: 'FiCheckCircle' },
    { path: '/invoice-discounting/md', label: 'Invoice Discounting', icon: 'FiFileText' },
  ],
  [ROLES.SUPERADMIN]: [
    { path: '/superadmin', label: 'Super Dashboard', icon: 'FiHome' },
    { path: '/superadmin/analytics', label: 'Analytics', icon: 'FiFileText' },
    { path: '/superadmin/cases', label: 'All Cases', icon: 'FiFolder' },
    { path: '/superadmin/performance', label: 'User Performance', icon: 'FiBarChart' },
    { path: '/operations/loan-servicing', label: 'Loan Servicing', icon: 'FiDollarSign' },
  ],
}

// Get icon component from string name
const getIconComponent = (iconName) => {
  const icons = {
    FiHome: () => import('react-icons/fi').then((mod) => mod.FiHome),
    FiUsers: () => import('react-icons/fi').then((mod) => mod.FiUsers),
    FiSettings: () => import('react-icons/fi').then((mod) => mod.FiSettings),
    FiCheckCircle: () => import('react-icons/fi').then((mod) => mod.FiCheckCircle),
    FiUserPlus: () => import('react-icons/fi').then((mod) => mod.FiUserPlus),
    FiShield: () => import('react-icons/fi').then((mod) => mod.FiShield),
    FiGitBranch: () => import('react-icons/fi').then((mod) => mod.FiGitBranch),
    FiFileText: () => import('react-icons/fi').then((mod) => mod.FiFileText),
    FiBarChart: () => import('react-icons/fi').then((mod) => mod.FiBarChart),
    FiFolder: () => import('react-icons/fi').then((mod) => mod.FiFolder),
    FiDollarSign: () => import('react-icons/fi').then((mod) => mod.FiDollarSign),
  }
  return icons[iconName]
}

export const useRole = () => {
  const { user } = useSelector((state) => state.auth)
  
  // Get roles array from user object (supports multiple roles)
  const userRoles = user?.roles || []
  const roles = userRoles.map((r) => r.name || r)
  
  // Primary role for backward compatibility
  const primaryRole = user?.role || user?.defaultRole || roles[0] || ''
  
  // Check if user has a specific role
  const hasRole = (role) => {
    return roles.includes(role)
  }
  
  // Check if user has any of the specified roles
  const hasAnyRole = (roleList) => {
    return roleList.some((role) => roles.includes(role))
  }
  
  // Check if user is admin (any admin-level role)
  const isAdmin = () => {
    return roles.includes(ROLES.ADMIN) || roles.includes(ROLES.SUPERADMIN)
  }
  
  // Check if user is in management (CEO, CFO, MD)
  const isManagement = () => {
    return [ROLES.CEO, ROLES.CFO, ROLES.MD].some((role) => roles.includes(role))
  }
  
  // Check if user is superadmin
  const isSuperAdmin = () => {
    return roles.includes(ROLES.SUPERADMIN)
  }
  
  // Get all menu items from all roles (merged, with deduplication)
  const getAllMenuItems = () => {
    const menuItemsMap = new Map()
    
    // Aggregate menu items from all roles
    roles.forEach((role) => {
      const roleMenuItems = ROLE_MENU_CONFIG[role] || []
      roleMenuItems.forEach((item) => {
        // Use path as key to deduplicate - later roles won't overwrite earlier ones
        if (!menuItemsMap.has(item.path)) {
          menuItemsMap.set(item.path, item)
        }
      })
    })
    
    return Array.from(menuItemsMap.values())
  }
  
  // Get menu items for specific roles only
  const getMenuItemsForRoles = (roleList) => {
    const menuItemsMap = new Map()
    
    roleList.forEach((role) => {
      const roleMenuItems = ROLE_MENU_CONFIG[role] || []
      roleMenuItems.forEach((item) => {
        if (!menuItemsMap.has(item.path)) {
          menuItemsMap.set(item.path, item)
        }
      })
    })
    
    return Array.from(menuItemsMap.values())
  }
  
  // Get all available roles for this user (for role switcher)
  const getAvailableRoles = () => {
    return roles
  }
  
  return {
    userRole: primaryRole, // Primary role (for backward compatibility)
    roles, // All roles array
    hasRole,
    hasAnyRole,
    isAdmin,
    isManagement,
    isSuperAdmin,
    getAllMenuItems,
    getMenuItemsForRoles,
    getAvailableRoles,
    ROLE_MENU_CONFIG,
  }
}
