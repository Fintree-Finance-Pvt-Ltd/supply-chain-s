import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'

const OperationsDashboard = () => {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCases = async () => {
      try {
        setIsLoading(true)
        const response = await workflowService.getOperationsDashboard()
        setCases(response.data?.data || [])
      } catch (error) {
        console.error('Error loading operations cases:', error)
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
      label: 'Received Date',
      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    navigate(`/operations/case/${row.customerId}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-gray-600 mt-2">Verify and process post-sanction cases</p>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Pending Review</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            data={cases.pending || []}
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
          <DataTable
            data={cases.handled || []}
            columns={columns}
            onRowClick={handleRowClick}
          />
        )}
      </div>
    </div>
  )
}

export default OperationsDashboard

