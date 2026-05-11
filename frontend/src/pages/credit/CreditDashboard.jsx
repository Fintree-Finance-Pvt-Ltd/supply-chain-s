import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchWorkflowDashboard } from '../../store/slices/caseSlice'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'
import { FiEye } from 'react-icons/fi'

const HANDLED_PAGE_SIZE = 15

const getApplicantName = (row) =>
  row.customer?.customerName ||
  row.customer?.name ||
  row.customer?.companyName ||
  'N/A'

const getCaseId = (row) => row.customerId || row.customer?.id || row.id || 'N/A'

const formatAction = (value) => {
  if (!value) return 'N/A'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const CreditDashboard = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { dashboardData, isLoading } = useSelector((state) => state.cases)
  const [handledPage, setHandledPage] = useState(1)
  const userRoles = (user?.roles || []).map(r => (r.name || '').toLowerCase());
  const isCreditHead = userRoles.includes('credit_head');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Get user's roles from auth state
        const userRoles = (user?.roles || []).map(r => (r.name || '').toLowerCase())
        const hasL1Role = userRoles.includes('credit_team_l1')
        const hasL2Role = userRoles.includes('credit_team_l2')
        
        // If user has both L1 and L2 roles, fetch both levels
        if (hasL1Role && hasL2Role) {
          dispatch(fetchWorkflowDashboard({
            role: 'credit',
            level: 'both',
            handledPage,
            handledLimit: HANDLED_PAGE_SIZE,
          }))
        } else {
          // Single role - use the role from user or default based on level param
          const userRole = (user?.role || '').toLowerCase()
          const level = userRole === 'credit_team_l2' ? '2' : '1'
          dispatch(fetchWorkflowDashboard({
            role: 'credit',
            level,
            handledPage,
            handledLimit: HANDLED_PAGE_SIZE,
          }))
        }
      } catch (error) {
        console.error('Error loading dashboard:', error)
      }
    }
    
    if (user) {
      loadDashboard()
    }
  }, [dispatch, user, handledPage])

  const handledCases = dashboardData?.handled || []
  const handledPagination = dashboardData?.handledPagination || {}
  const handledTotalRecords = handledPagination.total ?? handledCases.length
  const handledTotalPages = Math.max(
    1,
    handledPagination.totalPages ?? Math.ceil(handledTotalRecords / HANDLED_PAGE_SIZE),
  )
  const handledCurrentPage = handledPagination.page ?? handledPage
  const handledCurrentRangeStart = handledPagination.from ?? (handledTotalRecords === 0 ? 0 : 1)
  const handledCurrentRangeEnd = handledPagination.to ?? handledCases.length

  useEffect(() => {
    if (
      handledPagination.page &&
      handledPagination.page !== handledPage
    ) {
      setHandledPage(handledPagination.page)
    }
  }, [handledPagination.page, handledPage])

  const columns = [
    {
      key: 'name',
      label: 'Customer Name',
      render: (_, row) => row.customer?.customerName || row.customer?.name || row.customer?.companyName  || 'N/A'
    },
    {
      key: 'code',
      label: 'Customer Code',
      render: (_, row) => row.customer?.customerCode || row.customer?.id|| 'N/A'
    },
    {
      key: 'assigned',
      label: 'Assigned To',
      render: (_, row) => {
        const assignedUserName = row.customer?.assignedUserName || row.assignedUserName;
        const assignedUserId = row.customer?.assignedUserId || row.assignedUserId;
        return assignedUserName || (assignedUserId ? `User ID: ${assignedUserId}` : 'Unassigned');
      },
      hidden: !isCreditHead, // Only show for credit head
    },
    {
      key: 'status',
      label: 'Status',
            render: (_, row) => row.customer?.status ?? 'N/A'
      // render: (value) => <StatusBadge status={value} label={value?.replace(/_/g, ' ').toUpperCase()} />,
    },
    {
      key: 'createdAt',
      label: 'Received Date',
      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    navigate(`/credit/case/${row.customerId || row.id}`)
  }

  const handleHandledView = (row) => {
    const caseId = row.customerId || row.customer?.id || row.id
    navigate(`/credit/case/${caseId}?readOnly=true`)
  }

  const renderHandledCases = () => {
    if (handledTotalRecords === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No previously handled cases found.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Case ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applicant Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Handled Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {handledCases.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {getCaseId(row)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getApplicantName(row)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <StatusBadge
                      status={row.currentStatus || row.customer?.status}
                      label={formatAction(row.currentStatus || row.customer?.status)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatAction(row.lastAction)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(row.lastHandledDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => handleHandledView(row)}
                      className="inline-flex items-center justify-center space-x-2 rounded border border-primary-200 px-3 py-2 text-primary-700 hover:bg-primary-50"
                    >
                      <FiEye className="h-4 w-4" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <div>
            Showing {handledCurrentRangeStart}-{handledCurrentRangeEnd} of {handledTotalRecords} records
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHandledPage(Math.max(1, handledCurrentPage - 1))}
              disabled={handledCurrentPage === 1}
              className="rounded border border-gray-300 px-3 py-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="font-medium text-gray-800">
              Page {handledCurrentPage} of {handledTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setHandledPage(Math.min(handledTotalPages, handledCurrentPage + 1))}
              disabled={handledCurrentPage === handledTotalPages}
              className="rounded border border-gray-300 px-3 py-2 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Credit Team Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage customer credit applications</p>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Pending Review</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            data={dashboardData?.pending || []}
            columns={columns}
            onRowClick={handleRowClick}
          />
        )}
      </div>

      <div className="card border-t-4 border-gray-300">
        <h2 className="text-xl font-bold text-gray-500 mb-4">Previously Handled (Read-Only)</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          renderHandledCases()
        )}
      </div>
    </div>
  )
}

export default CreditDashboard

