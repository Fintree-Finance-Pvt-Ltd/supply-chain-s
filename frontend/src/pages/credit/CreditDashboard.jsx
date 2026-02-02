import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCases } from '../../store/slices/caseSlice'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { CASE_STATUS_LABELS } from '../../constants/caseStatus'
import { formatDate } from '../../utils/format'

const CreditDashboard = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { cases, isLoading } = useSelector((state) => state.cases)
  const [filters, setFilters] = useState({
    rmName: '',
    dateFrom: '',
    dateTo: '',
    status: 'submitted',
  })

  useEffect(() => {
    dispatch(fetchCases({ status: 'submitted' }))
  }, [dispatch])

  const filteredCases = cases.filter(caseItem => {
    if (filters.rmName && !caseItem.rm?.name?.toLowerCase().includes(filters.rmName.toLowerCase())) {
      return false
    }
    if (filters.status && caseItem.status !== filters.status) {
      return false
    }
    return true
  })

  const columns = [
    { 
      key: 'name', 
      label: 'Customer Name',
      render: (_, row) => row.name || row.customerName
    },
    { 
      key: 'rmName', 
      label: 'RM Name',
      render: (_, row) => row.rm?.name || row.rmName || 'N/A'
    },
    { 
      key: 'pan', 
      label: 'PAN',
      render: (_, row) => row.pan || row.panNumber
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} label={CASE_STATUS_LABELS[value]} />,
    },
    {
      key: 'createdAt',
      label: 'Submitted Date',
      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    navigate(`/credit/case/${row.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Credit Team Dashboard</h1>
        <p className="text-gray-600 mt-2">Review and process customer cases</p>
      </div>

      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RM Name
              </label>
              <input
                type="text"
                value={filters.rmName}
                onChange={(e) => setFilters({ ...filters, rmName: e.target.value })}
                className="input-field"
                placeholder="Search RM name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="input-field"
              >
                <option value="">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="credit_approved">Credit Approved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div>
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

export default CreditDashboard

