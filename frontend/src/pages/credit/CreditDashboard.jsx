import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchWorkflowDashboard } from '../../store/slices/caseSlice'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'

const CreditDashboard = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { dashboardData, isLoading } = useSelector((state) => state.cases)

  useEffect(() => {
    const userRole = (user?.role || '').toLowerCase()
    const level = userRole === 'credit_team_l2' ? '2' : '1'
    dispatch(fetchWorkflowDashboard({ role: 'credit', level }))
  }, [dispatch, user])

  const columns = [
    {
      key: 'name',
      label: 'Customer Name',
      render: (_, row) => row.customer?.customerName || row.name || 'N/A'
    },
    {
      key: 'code',
      label: 'Customer Code',
      render: (_, row) => row.customer?.customerCode || 'N/A'
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} label={value?.replace(/_/g, ' ').toUpperCase()} />,
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
          <DataTable
            data={dashboardData?.handled || []}
            columns={columns}
            onRowClick={handleRowClick}
          />
        )}
      </div>
    </div>
  )
}

export default CreditDashboard

