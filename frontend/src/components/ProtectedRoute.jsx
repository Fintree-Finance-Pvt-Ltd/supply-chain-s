import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, isLoading  } = useSelector((state) => state.auth)

  // Show loading state while checking authentication
  if (isLoading) {
    return null   // or loading spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Get role from user object (could be user.role or user.defaultRole)
  const userRole = user?.role || user?.defaultRole || user?.roles?.[0]?.name
  // Check if user has access
  const hasAccess = allowedRoles.length === 0 || allowedRoles.some((allowedRole) => {
    // Exact match first
    if (userRole === allowedRole) {
      return true
    }
    // Support partial/prefix matching for roles with levels
    // e.g., 'credit_team_l1' matches 'credit_team'
    if (userRole && userRole.startsWith(allowedRole + '_')) {
      return true
    }
    return false
  })

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development' && allowedRoles.length > 0) {
    console.log('ProtectedRoute check:', {
      userRole,
      allowedRoles,
      user,
      hasAccess,
    })
  }

  if (allowedRoles.length > 0 && !hasAccess) {
    console.warn('Access denied:', { userRole, allowedRoles, user })
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

export default ProtectedRoute

