import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'

const ManagementDashboard = () => {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCases = async () => {
      try {
        setIsLoading(true)
        const response = await workflowService.getExecutiveDashboard()
        setCases(response.data?.data || [])
      } catch (error) {
        console.error('Error loading executive cases:', error)
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
        <p className="text-gray-600 mt-2">Review and approve customer onboarding cases</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Pending Approvals</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{cases.length}</p>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            data={cases}
            columns={columns}
            onRowClick={handleRowClick}
          />
        )}
      </div>
    </div>
  )
}

export default ManagementDashboard

