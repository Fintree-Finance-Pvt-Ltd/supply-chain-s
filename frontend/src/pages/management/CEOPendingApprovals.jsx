import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'

const CEOPendingApprovals = () => {
  const navigate = useNavigate()
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const response = await workflowService.getExecutiveDashboard()
        // Backend returns { success: true, data: { pending: [...], handled: [...] } }
        const data = response.data?.data || { pending: [], handled: [] }
        setPendingApprovals(data.pending || [])
      } catch (error) {
        console.error('Error loading CEO pending approvals:', error)
        setPendingApprovals([])
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const columns = [
    {
      key: 'customerName',
      label: 'Customer Name',
      render: (_, row) => row?.customer?.name?.trim() || row?.customer?.companyName?.trim() ||
        'N/A'

      // render: (_, row) => row.customer?.customerName || 'N/A'
    },
     {
      key: 'companyName',
      label: 'Company Name',
      render: (_, row) =>  row?.customer?.companyName?.trim() || 'N/A'
    },
    // {
    //   key: 'customerCode',
    //   label: 'Customer Code',
    //   render: (_, row) => row.customer?.customerCode || 'N/A'
    // },
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
        <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-gray-600 mt-2">Review and approve customer onboarding cases requiring CEO approval</p>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Pending Approvals ({pendingApprovals.length})</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : pendingApprovals.length > 0 ? (
          <DataTable
            data={pendingApprovals}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No pending approvals</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CEOPendingApprovals