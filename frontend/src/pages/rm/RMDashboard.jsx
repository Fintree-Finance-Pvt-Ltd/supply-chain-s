import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCases } from '../../store/slices/caseSlice'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { CASE_STATUS, CASE_STATUS_LABELS } from '../../constants/caseStatus'
import { formatDate } from '../../utils/format'
import { FiPlus, FiEye } from 'react-icons/fi'

const RMDashboard = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { cases, isLoading } = useSelector((state) => state.cases)
  const { user } = useSelector((state) => state.auth)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    // Pass the logged-in RM's ID to filter only their onboarded customers
    if (user && user.id) {
      dispatch(fetchCases({ rmId: user.id }))
    } else {
      dispatch(fetchCases())
    }
  }, [dispatch, user])

  const tabs = [
    { id: 'all', label: 'All Cases' },
    { id: CASE_STATUS.DRAFT, label: 'Draft' },
    { id: CASE_STATUS.SUBMITTED, label: 'Submitted' },
    { id: CASE_STATUS.MD_APPROVED, label: 'Ready for Ops Submit' },
    { id: CASE_STATUS.OPS_L1_REVIEW, label: 'Ops Review' },
    { id: CASE_STATUS.COMPLETED, label: 'Completed' },
    { id: CASE_STATUS.REJECTED, label: 'Rejected' },
  ]

  const filteredCases = activeTab === 'all'
    ? cases
    : cases.filter(c => c.status === activeTab)

  const columns = [
    {
      key: 'customerCode',
      label: 'LAN',
      render: (_, row) => <span className="font-mono text-xs">{row.customerCode || 'Pending'}</span>,
    },
    {
      key: 'name',
      label: 'Customer Name',
      render: (_, row) => row.name || row.customerName || row.companyName || 'N/A',
    },
    {
      key: 'mobile',
      label: 'Mobile',
      render: (_, row) => row.mobile || row.mobileNumber,
    },
    {
      key: 'pan',
      label: 'PAN',
      render: (_, row) => row.pan || row.panNumber,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} label={CASE_STATUS_LABELS[value]} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    if (row.status === CASE_STATUS.DRAFT) {
      navigate(`/rm/customer/new?id=${row.id}`)
    } else {
      navigate(`/rm/customer/${row.id}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">RM Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage customer onboarding cases</p>
        </div>
        <button
          onClick={() => navigate('/rm/customer/new')}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlus className="h-5 w-5" />
          <span>New Customer</span>
        </button>
      </div>

      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              data={filteredCases}
              columns={columns}
              onRowClick={handleRowClick}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default RMDashboard

