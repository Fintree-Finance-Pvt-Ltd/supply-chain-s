import { useSelector } from 'react-redux'
import { ROLES } from '../constants/roles'

export const useRole = () => {
  const { user } = useSelector((state) => state.auth)
  
  // Get role from user object (could be user.role or user.defaultRole)
  const userRole = user?.role || user?.defaultRole
  
  const hasRole = (role) => {
    return userRole === role
  }
  
  const hasAnyRole = (roles) => {
    return roles.includes(userRole)
  }
  
  const isAdmin = () => {
    return userRole === ROLES.ADMIN
  }
  
  const isManagement = () => {
    return [ROLES.CEO, ROLES.CFO, ROLES.MD].includes(userRole)
  }
  
  return {
    userRole,
    hasRole,
    hasAnyRole,
    isAdmin,
    isManagement,
  }
}

