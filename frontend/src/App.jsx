import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { checkAuth } from './store/slices/authSlice'
import ProtectedRoute from './components/ProtectedRoute'
import { Toaster } from 'react-hot-toast'
import { ROLES } from './constants/roles'

// Layouts
import MainLayout from './layouts/MainLayout'

// Auth Pages
import Login from './pages/auth/Login'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import RoleManagement from './pages/admin/RoleManagement'
import ApprovalFlowConfig from './pages/admin/ApprovalFlowConfig'

// RM Pages
import RMDashboard from './pages/rm/RMDashboard'
import NewCustomerOnboarding from './pages/rm/NewCustomerOnboarding'
import PostSanction from './pages/rm/PostSanction'

// Credit Pages
import CreditDashboard from './pages/credit/CreditDashboard'
import CreditCaseDetail from './pages/credit/CreditCaseDetail'

// Management Pages
import ManagementDashboard from './pages/management/ManagementDashboard'
import ApprovalScreen from './pages/management/ApprovalScreen'

// Operations Pages
import OperationsDashboard from './pages/operations/OperationsDashboard'
import OperationsCaseScreen from './pages/operations/OperationsCaseScreen'

// Common
import Unauthorized from './pages/common/Unauthorized'

function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(checkAuth())
  }, [dispatch])

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/roles"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <RoleManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/approval-flows"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <ApprovalFlowConfig />
              </ProtectedRoute>
            }
          />

          {/* RM Routes */}
          <Route
            path="rm/dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER]}>
                <RMDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="rm/customer/new"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER]}>
                <NewCustomerOnboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="rm/customer/:id/post-sanction"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER]}>
                <PostSanction />
              </ProtectedRoute>
            }
          />

          {/* Credit Routes */}
          <Route
            path="credit/dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CREDIT_TEAM]}>
                <CreditDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="credit/case/:id"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CREDIT_TEAM]}>
                <CreditCaseDetail />
              </ProtectedRoute>
            }
          />

          {/* Management Routes */}
          <Route
            path="management/dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CEO, ROLES.CFO, ROLES.MD]}>
                <ManagementDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="management/approval/:id"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CEO, ROLES.CFO, ROLES.MD]}>
                <ApprovalScreen />
              </ProtectedRoute>
            }
          />

          {/* Operations Routes */}
          <Route
            path="operations/dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLES.OPERATIONS_TEAM]}>
                <OperationsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/case/:id"
            element={
              <ProtectedRoute allowedRoles={[ROLES.OPERATIONS_TEAM]}>
                <OperationsCaseScreen />
              </ProtectedRoute>
            }
          />

          {/* Default redirect - handled by MainLayout */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<div />} />
        </Route>
      </Routes>
    </>
  )
}

export default App

