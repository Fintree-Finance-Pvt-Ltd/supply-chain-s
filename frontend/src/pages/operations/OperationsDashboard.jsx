import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { operationsService } from '../../services/operationsService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'

const OperationsDashboard = () => {
  const navigate = useNavigate()
  const [checks, setChecks] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadChecks = async () => {
      try {
        setIsLoading(true)
        const response = await operationsService.getPendingChecks()
        setChecks(response.data || [])
      } catch (error) {
        console.error('Error loading operations checks:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadChecks()
  }, [])

  const columns = [
    { 
      key: 'customerName', 
      label: 'Customer Name',
      render: (_, row) => row.customer?.name || 'N/A'
    },
    { 
      key: 'rmName', 
      label: 'RM Name',
      render: (_, row) => row.customer?.rm?.name || 'N/A'
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} label={value} />,
    },
    {
      key: 'createdAt',
      label: 'Received Date',
      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    navigate(`/operations/case/${row.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Operations Dashboard</h1>
        <p className="text-gray-600 mt-2">Verify and process post-sanction cases</p>
      </div>

      <div className="card">
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Pending Operations Verification: <span className="font-semibold">{checks.length}</span>
          </p>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            data={checks}
            columns={columns}
            onRowClick={handleRowClick}
          />
        )}
      </div>
    </div>
  )
}

export default OperationsDashboard

