import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { checkAuth } from './store/slices/authSlice'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastContainer } from 'react-toastify'
import { ROLES } from './constants/roles'
import 'react-toastify/dist/ReactToastify.css'

// Layouts
import MainLayout from './layouts/MainLayout'

// Auth Pages
import Login from './pages/auth/Login'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import RoleManagement from './pages/admin/RoleManagement'
import ApprovalFlowConfig from './pages/admin/ApprovalFlowConfig'
import CaseAuditDetail from './pages/admin/CaseAuditDetail'
import PartnerManagement from './pages/admin/PartnerManagement'

// SuperAdmin Pages
import SuperAdminDashboard from './pages/superadmin/SuperAdminCommandCenter'
import UserPerformance from './pages/superadmin/UserPerformance'
import AllCases from './pages/superadmin/AllCases'
import Analytics from './pages/superadmin/Analytics'

// RM Pages
import RMDashboard from './pages/rm/RMDashboard'
import NewCustomerOnboarding from './pages/rm/NewCustomerOnboarding'
import RMCaseDetail from './pages/rm/RMCaseDetail'
import SubmitOpsScreen from './pages/rm/SubmitOpsScreen'

// Credit Pages
import CreditDashboard from './pages/credit/CreditDashboard'
import CreditCaseDetail from './pages/credit/CreditCaseDetail'

// Management Pages
import ManagementDashboard from './pages/management/ManagementDashboard'
import ApprovalScreen from './pages/management/ApprovalScreen'
import CEOPendingApprovals from './pages/management/CEOPendingApprovals'

// Operations Pages
import OperationsDashboard from './pages/operations/OperationsWorkbench'
import OperationsCaseScreen from './pages/operations/OperationsCaseScreen'
import RepaymentUpload from './pages/operations/RepaymentUpload'
import LoanServicing from './pages/operations/LoanServicing'
import OpsLoanSearch from './pages/operations/OpsLoanSearch'
import SupplierDashboard from './pages/supplier/SupplierDashboard'
import SupplierCreate from './pages/supplier/SupplierCreate'
import SupplierDetail from './pages/supplier/SupplierDetail'

// Common
import Unauthorized from './pages/common/Unauthorized'

// Invoice Discounting Pages
import InvoiceDiscountingRM from './pages/invoice-discounting/InvoiceDiscountingRM'
import InvoiceDiscountingCustomer from './pages/invoice-discounting/InvoiceDiscountingCustomer'
import InvoiceDiscountingOPS1 from './pages/invoice-discounting/InvoiceDiscountingOPS1'
import InvoiceDiscountingOPS2 from './pages/invoice-discounting/InvoiceDiscountingOPS2'
import InvoiceDiscountingMD from './pages/invoice-discounting/InvoiceDiscountingMD'
import InvoiceDiscountingOPSHead from './pages/invoice-discounting/InvoiceDiscountingOPSHead'

function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(checkAuth())
  }, [dispatch])

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick={true}
        pauseOnHover={true}
        draggable={true}
        theme="colored"
      />
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
              <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERADMIN]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* SuperAdmin Routes */}
          <Route
            path="superadmin"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN]}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="superadmin/performance"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN]}>
                <UserPerformance />
              </ProtectedRoute>
            }
          />
          <Route
            path="superadmin/cases"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN]}>
                <AllCases />
              </ProtectedRoute>
            }
          />
          <Route
            path="superadmin/analytics"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN]}>
                <Analytics />
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
          <Route
            path="admin/partners"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <PartnerManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/case/:id"
            element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <CaseAuditDetail />
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
            path="rm/customer/:id"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER]}>
                <RMCaseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="rm/customer/:id/submit-ops"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER]}>
                <SubmitOpsScreen />
              </ProtectedRoute>
            }
          />

          {/* Credit Routes */}
          <Route
            path="credit/dashboard"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CREDIT_TEAM, ROLES.CREDIT_TEAM_L1, ROLES.CREDIT_TEAM_L2, ROLES.CREDIT_HEAD]}>
                <CreditDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="credit/pending"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CREDIT_TEAM, ROLES.CREDIT_TEAM_L1, ROLES.CREDIT_TEAM_L2, ROLES.CREDIT_HEAD]}>
                <CreditDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="credit/case/:id"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPERADMIN, ROLES.CREDIT_TEAM, ROLES.CREDIT_TEAM_L1, ROLES.CREDIT_TEAM_L2, ROLES.CREDIT_HEAD]}>
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
            path="management/ceo-approvals"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CEO, ROLES.MD]}>
                <CEOPendingApprovals />
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
              <ProtectedRoute
                allowedRoles={[
                  ROLES.OPERATIONS_TEAM,
                  ROLES.OPERATIONS_TEAM_L1,
                  ROLES.OPERATIONS_TEAM_L2,
                  ROLES.OPERATIONS_HEAD,
                ]}
              >
                <OperationsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/pending"
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.OPERATIONS_TEAM,
                  ROLES.OPERATIONS_TEAM_L1,
                  ROLES.OPERATIONS_TEAM_L2,
                  ROLES.OPERATIONS_HEAD,
                ]}
              >
                <OperationsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/case/:id"
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.OPERATIONS_TEAM,
                  ROLES.OPERATIONS_TEAM_L1,
                  ROLES.OPERATIONS_TEAM_L2,
                  ROLES.OPERATIONS_HEAD,
                ]}
              >
                <OperationsCaseScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/repayment-upload"
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.OPERATIONS_TEAM_L1,
                  ROLES.OPERATIONS_TEAM_L2,
                  ROLES.OPERATIONS_HEAD,
                ]}
              >
                <RepaymentUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/loan-search"
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.OPERATIONS_TEAM_L1,
                  ROLES.OPERATIONS_TEAM_L2,
                  ROLES.OPERATIONS_HEAD,
                ]}
              >
                <OpsLoanSearch />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/loan-servicing"
            element={
              <ProtectedRoute
                allowedRoles={[
                  ROLES.OPERATIONS_TEAM_L1,
                  ROLES.OPERATIONS_TEAM_L2,
                  ROLES.OPERATIONS_HEAD,
                ]}
              >
                <LoanServicing />
              </ProtectedRoute>
            }
          />

          {/* Supplier Routes - accessible by RM and Operations */}
          <Route
            path="operations/suppliers"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER, ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_TEAM_L2, ROLES.OPERATIONS_HEAD]}>
                <SupplierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/suppliers/create"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER, ROLES.OPERATIONS_TEAM_L1]}>
                <SupplierCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="operations/suppliers/:id"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER, ROLES.OPERATIONS_TEAM_L1, ROLES.OPERATIONS_HEAD]}>
                <SupplierDetail />
              </ProtectedRoute>
            }
          />

          {/* Invoice Discounting Routes */}
          {/* RM - Create Invoice */}
          <Route
            path="invoice-discounting/rm"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RELATIONSHIP_MANAGER]}>
                <InvoiceDiscountingRM />
              </ProtectedRoute>
            }
          />

          {/* Customer - Mobile App Approval */}
          <Route
            path="invoice-discounting/customer"
            element={
              <ProtectedRoute allowedRoles={[ROLES.CUSTOMER]}>
                <InvoiceDiscountingCustomer />
              </ProtectedRoute>
            }
          />

          {/* OPS L1 - Verification & Disbursement Entry */}
          <Route
            path="invoice-discounting/ops-l1"
            element={
              <ProtectedRoute allowedRoles={[ROLES.OPERATIONS_TEAM_L1]}>
                <InvoiceDiscountingOPS1 />
              </ProtectedRoute>
            }
          />

          {/* OPS L2 - Verification */}
          <Route
            path="invoice-discounting/ops-l2"
            element={
              <ProtectedRoute allowedRoles={[ROLES.OPERATIONS_TEAM_L2]}>
                <InvoiceDiscountingOPS2 />
              </ProtectedRoute>
            }
          />

          {/* MD - Approval */}
          <Route
            path="invoice-discounting/md"
            element={
              <ProtectedRoute allowedRoles={[ROLES.MD]}>
                <InvoiceDiscountingMD />
              </ProtectedRoute>
            }
          />

          {/* OPS Head - Final Approval */}
          <Route
            path="invoice-discounting/ops-head"
            element={
              <ProtectedRoute allowedRoles={[ROLES.OPERATIONS_HEAD]}>
                <InvoiceDiscountingOPSHead />
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
