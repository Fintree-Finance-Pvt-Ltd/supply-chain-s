import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'

const ManagementDashboard = () => {
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState({ pending: [], handled: [] })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCases = async () => {
      try {
        setIsLoading(true)
        const response = await workflowService.getExecutiveDashboard()
        // Backend returns { success: true, data: { pending: [...], handled: [...] } }
        setDashboardData(response.data?.data || { pending: [], handled: [] })
      } catch (error) {
        console.error('Error loading executive cases:', error)
        setDashboardData({ pending: [], handled: [] })
      } finally {
        setIsLoading(false)
      }
    }
    loadCases()
  }, [])

  const columns = [
    {
      key: 'customerName',
      label: 'Customer Name',
      render: (_, row) => row.customer?.customerName || 'N/A'
    },
    {
      key: 'customerCode',
      label: 'Customer Code',
      render: (_, row) => row.customer?.customerCode || 'N/A'
    },
    {
      key: 'currentStatus',
      label: 'Stage',
      render: (value) => <StatusBadge status={value} label={value.replace(/_/g, ' ').toUpperCase()} />,
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    navigate(`/management/approval/${row.customerId}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
        <p className="text-gray-600 mt-2">Review and manage customer onboarding cases</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600 font-medium">Pending Approvals</p>
          <p className="text-4xl font-bold text-yellow-600 mt-2">{dashboardData.pending?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting your review</p>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
          <p className="text-sm text-gray-600 font-medium">Completed Cases</p>
          <p className="text-4xl font-bold text-green-600 mt-2">{dashboardData.handled?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Total handled by you</p>
        </div>
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500">
          <p className="text-sm text-gray-600 font-medium">Total Cases</p>
          <p className="text-4xl font-bold text-blue-600 mt-2">{(dashboardData.pending?.length || 0) + (dashboardData.handled?.length || 0)}</p>
          <p className="text-xs text-gray-500 mt-1">All time summary</p>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-violet-50 border-l-4 border-purple-500">
          <p className="text-sm text-gray-600 font-medium">Completion Rate</p>
          <p className="text-4xl font-bold text-purple-600 mt-2">
            {((dashboardData.handled?.length || 0) + (dashboardData.pending?.length || 0)) > 0
              ? Math.round(((dashboardData.handled?.length || 0) / ((dashboardData.handled?.length || 0) + (dashboardData.pending?.length || 0))) * 100)
              : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Cases completed</p>
        </div>
      </div>

      <div className="card border-t-4 border-gray-300">
        <h2 className="text-xl font-bold text-gray-500 mb-4">Handled Cases (Read-Only)</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : dashboardData.handled?.length > 0 ? (
          <DataTable
            data={dashboardData.handled}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No handled cases yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManagementDashboard
