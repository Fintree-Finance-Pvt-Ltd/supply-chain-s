import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'

const ManagementDashboard = () => {
  const navigate = useNavigate()

  const [dashboardData, setDashboardData] = useState({
    pending: [],
    handled: [],
  })

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadCases = async () => {
      try {
        setIsLoading(true)

        const response =
          await workflowService.getExecutiveDashboard()

        setDashboardData(
          response.data?.data || {
            pending: [],
            handled: [],
          },
        )
      } catch (error) {
        console.error(
          'Error loading executive cases:',
          error,
        )

        setDashboardData({
          pending: [],
          handled: [],
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadCases()
  }, [])

  /// CUSTOMER ONBOARDING
  const customerPending = (
    dashboardData.pending || []
  ).filter(
    (item) =>
      item.workflowType ===
      'CUSTOMER_ONBOARDING',
  )

  const customerHandled = (
    dashboardData.handled || []
  ).filter(
    (item) =>
      item.workflowType ===
      'CUSTOMER_ONBOARDING',
  )

  /// INVOICE DISCOUNTING
  const invoiceHandled = (
    dashboardData.handled || []
  ).filter(
    (item) =>
      item.workflowType ===
      'INVOICE_DISCOUNTING',
  )

  const columns = [
    {
      key: 'customerName',
      label: 'Customer Name',

      render: (_, row) =>
        row?.customer?.name?.trim() ||
        row?.customer?.companyName?.trim() ||
        'N/A',
    },

    {
      key: 'customerCode',
      label: 'Customer Code',

      render: (_, row) =>
        row.customer?.customerCode || 'N/A',
    },

    {
      key: 'currentStatus',
      label: 'Stage',

      render: (value) => (
        <StatusBadge
          status={value}
          label={value
            .replace(/_/g, ' ')
            .toUpperCase()}
        />
      ),
    },

    {
      key: 'updatedAt',
      label: 'Last Updated',

      render: (value) => formatDate(value),
    },
  ]

  const handleRowClick = (row) => {
    navigate(
      `/management/approval/${row.customerId}`,
    )
  }

  // const totalCases =
  //   customerPending.length +
  //   customerHandled.length

  // const completionRate =
  //   totalCases > 0
  //     ? Math.round(
  //         (customerHandled.length /
  //           totalCases) *
  //           100,
  //       )
  //     : 0



      /// REJECTED CASES
const rejectedCases = [
  ...(dashboardData.pending || []),
  ...(dashboardData.handled || []),
].filter((item) => item.isRejected === true)

/// TOTAL CASES
const totalCases =
  customerPending.length +
  customerHandled.length +
  invoiceHandled.length

/// COMPLETION %
const completionRate =
  totalCases > 0
    ? Math.round(
        (customerHandled.length / totalCases) *
          100,
      )
    : 0


  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Management Dashboard
        </h1>

        <p className="text-gray-600 mt-2">
          Review and manage customer onboarding
          & invoice discounting cases
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
  {/* PENDING */}
  <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-l-4 border-yellow-500">
    <p className="text-sm text-gray-600 font-medium">
      Pending Approvals
    </p>

    <p className="text-4xl font-bold text-yellow-600 mt-2">
      {customerPending.length}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      Awaiting your review
    </p>
  </div>

  {/* CUSTOMER COMPLETED */}
  <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
    <p className="text-sm text-gray-600 font-medium">
      Customer Cases
    </p>

    <p className="text-4xl font-bold text-green-600 mt-2">
      {customerHandled.length}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      Customer onboarding handled
    </p>
  </div>

  {/* INVOICE CASES */}
  <div className="card bg-gradient-to-br from-indigo-50 to-blue-50 border-l-4 border-indigo-500">
    <p className="text-sm text-gray-600 font-medium">
      Invoice Cases
    </p>

    <p className="text-4xl font-bold text-indigo-600 mt-2">
      {invoiceHandled.length}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      Invoice discounting handled
    </p>
  </div>

  {/* REJECTED CASES */}
  <div className="card bg-gradient-to-br from-red-50 to-rose-50 border-l-4 border-red-500">
    <p className="text-sm text-gray-600 font-medium">
      Rejected Cases
    </p>

    <p className="text-4xl font-bold text-red-600 mt-2">
      {rejectedCases.length}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      Total rejected workflows
    </p>
  </div>

  {/* TOTAL */}


  {/* COMPLETION RATE */}
 
</div>

      {/* PENDING CUSTOMER CASES */}
      <div className="card border-t-4 border-yellow-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-yellow-600">
            Pending Customer Cases
          </h2>

          <div className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-semibold">
            {customerPending.length} Pending
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : customerPending.length > 0 ? (
          <DataTable
            data={customerPending}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No pending customer cases</p>
          </div>
        )}
      </div>

      {/* HANDLED CUSTOMER CASES */}
      <div className="card border-t-4 border-green-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-green-600">
            Handled Customer Cases
          </h2>

          <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
            {customerHandled.length} Completed
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : customerHandled.length > 0 ? (
          <DataTable
            data={customerHandled}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No handled customer cases</p>
          </div>
        )}
      </div>

      {/* INVOICE DISCOUNTING */}
      <div className="card border-t-4 border-indigo-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-indigo-600">
            Invoice Discounting Cases
          </h2>

          <div className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
            {invoiceHandled.length} Processed
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : invoiceHandled.length > 0 ? (
          <DataTable
            data={invoiceHandled}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No invoice discounting cases yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ManagementDashboard