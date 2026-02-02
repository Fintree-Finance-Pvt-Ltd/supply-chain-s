import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Get role from user object (could be user.role or user.defaultRole)
  const userRole = user?.role || user?.defaultRole

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development' && allowedRoles.length > 0) {
    console.log('ProtectedRoute check:', {
      userRole,
      allowedRoles,
      user,
      hasAccess: allowedRoles.includes(userRole),
    })
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    console.warn('Access denied:', { userRole, allowedRoles, user })
    return <Navigate to="/unauthorized" replace />
  }

  return children
}

export default ProtectedRoute

