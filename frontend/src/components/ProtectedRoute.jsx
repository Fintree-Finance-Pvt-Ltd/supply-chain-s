import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, isLoading } = useSelector((state) => state.auth)

  // Show loading state while checking authentication
  if (isLoading) {
    return null // or loading spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Get all roles from user object - supports multiple roles
  const userRoles = user?.roles?.map(r => r.name || r) || []
  // Primary role for backward compatibility
  const primaryRole = user?.role || user?.defaultRole || userRoles[0] || ''
  
  // If no roles specified, allow access
  if (allowedRoles.length === 0) {
    return children
  }
  
  // Check if user has ANY of the allowed roles (supports multiple roles)
  const hasAccess = userRoles.some((userRole) => {
    // Exact match
    if (allowedRoles.includes(userRole)) {
      return true
    }
    // Support partial/prefix matching for roles with levels
    // e.g., 'credit_team_l1' matches 'credit_team'
    if (userRole && userRole.startsWith(allowedRoles[0] + '_')) {
      return true
    }
    return false
  })

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development' && allowedRoles.length > 0) {
    console.log('ProtectedRoute check:', {
      userRoles,
      primaryRole,
      allowedRoles,
      hasAccess,
    })
  }

  if (allowedRoles.length > 0 && !hasAccess) {
    console.warn('Access denied:', { userRoles, primaryRole, allowedRoles, user })
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

export default ProtectedRoute
