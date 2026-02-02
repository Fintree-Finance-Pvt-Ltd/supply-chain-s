import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { approvalService } from '../../services/approvalService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../utils/format'

const ManagementDashboard = () => {
  const navigate = useNavigate()
  const [approvals, setApprovals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')

  useEffect(() => {
    const loadApprovals = async () => {
      try {
        setIsLoading(true)
        const response = await approvalService.getPendingApprovals()
        setApprovals(response.data || [])
      } catch (error) {
        console.error('Error loading approvals:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadApprovals()
  }, [])

  const pendingApprovals = approvals.filter(a => a.status === 'pending')
  const approvedApprovals = approvals.filter(a => a.status === 'approved')
  const rejectedApprovals = approvals.filter(a => a.status === 'rejected')

  const filteredApprovals = activeTab === 'pending' 
    ? pendingApprovals 
    : activeTab === 'approved' 
    ? approvedApprovals 
    : rejectedApprovals

  const columns = [
    { 
      key: 'customerName', 
      label: 'Customer Name',
      render: (_, row) => {
        const customer = row.creditSanction?.customer || row.operationsCheck?.customer
        return customer?.name || 'N/A'
      }
    },
    { 
      key: 'sanctionAmount',
      label: 'Sanction Amount',
      render: (_, row) => {
        const amount = row.creditSanction?.sanctionAmount
        return amount ? formatCurrency(amount) : 'N/A'
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} label={value} />,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    navigate(`/management/approval/${row.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
        <p className="text-gray-600 mt-2">Review and approve credit sanctions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Pending Approvals</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingApprovals.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Approved</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{approvedApprovals.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Rejected</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{rejectedApprovals.length}</p>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending Approvals ({pendingApprovals.length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'approved'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Approved ({approvedApprovals.length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rejected'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Rejected ({rejectedApprovals.length})
            </button>
          </nav>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            data={filteredApprovals}
            columns={columns}
            onRowClick={handleRowClick}
          />
        )}
      </div>
    </div>
  )
}

export default ManagementDashboard

