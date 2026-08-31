import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiTruck,
  FiUsers,
} from 'react-icons/fi'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'react-toastify'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../constants/roles'
import { workflowService } from '../../services/workflowService'
import { supplierService } from '../../services/supplierService'
import { formatCurrency, formatDate } from '../../utils/format'

const chartColors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0f766e']

const normalizeStatus = (value) => String(value || 'unknown').toLowerCase()

const formatLabel = (value) =>
  String(value || 'Unknown')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const toArray = (value) => (Array.isArray(value) ? value : [])

const getUserRoles = (user) => {
  const roles = user?.roles?.map((role) => role.name || role).filter(Boolean) || []
  if (user?.role && !roles.includes(user.role)) roles.push(user.role)
  return roles
}

const getInvoiceRouteForRoles = (roles) => {
  if (roles.includes(ROLES.OPERATIONS_TEAM_L1)) return '/invoice-discounting/ops-l1'
  if (roles.includes(ROLES.OPERATIONS_TEAM_L2)) return '/invoice-discounting/ops-l2'
  if (roles.includes(ROLES.OPERATIONS_HEAD)) return '/invoice-discounting/ops-head'
  return '/operations/dashboard'
}

const getOPS1InvoiceWorkQueue = async () => {
  const [verificationResult, disbursementResult] = await Promise.all([
    workflowService.getOPS1PendingInvoices(),
    workflowService.getDisbursementEntryInvoices(),
  ])

  return {
    data: {
      data: [
        ...toArray(verificationResult.data?.data),
        ...toArray(disbursementResult.data?.data),
      ],
    },
  }
}

const getInvoiceLoaderForRoles = (roles) => {
  if (roles.includes(ROLES.OPERATIONS_TEAM_L1)) return getOPS1InvoiceWorkQueue
  if (roles.includes(ROLES.OPERATIONS_TEAM_L2)) return workflowService.getFinalOPS2PendingInvoices
  if (roles.includes(ROLES.OPERATIONS_HEAD)) return workflowService.getOPSHeadPendingInvoices
  return null
}

const getCaseName = (row) =>
  row.customer?.customerName ||
  row.customer?.companyName ||
  row.customer?.name ||
  row.customerName ||
  row.companyName ||
  'Customer case'

const getSupplierName = (row) => row.supplierName || row.name || 'Supplier case'

const getInvoiceName = (row) =>
  row.customer?.companyName ||
  row.customer?.customerName ||
  row.customerName ||
  row.supplier?.supplierName ||
  row.supplierName ||
  'Invoice case'

const getAgeDays = (dateValue) => {
  if (!dateValue) return 0
  const created = new Date(dateValue).getTime()
  if (Number.isNaN(created)) return 0
  return Math.max(0, Math.floor((Date.now() - created) / 86400000))
}

const KpiCard = ({ label, value, helper, icon: Icon, tone = 'blue' }) => {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 break-words text-3xl font-bold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

const ChartPanel = ({ title, subtitle, children, icon: Icon }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <Icon className="h-5 w-5 text-blue-700" />
    </div>
    <div className="h-72">{children}</div>
  </section>
)

const EmptyChart = ({ label }) => (
  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
    {label}
  </div>
)

const OperationsWorkbench = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const isPendingPage = location.pathname === '/operations/pending'
  const userRoles = useMemo(() => getUserRoles(user), [user])
  const invoiceRoute = useMemo(() => getInvoiceRouteForRoles(userRoles), [userRoles])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [customerDashboard, setCustomerDashboard] = useState({ pending: [], handled: [] })
  const [supplierRows, setSupplierRows] = useState([])
  const [invoiceRows, setInvoiceRows] = useState([])
  const [filters, setFilters] = useState({ search: '', type: 'all', stage: 'all' })

  const loadDashboard = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      const invoiceLoader = getInvoiceLoaderForRoles(userRoles)
      const requests = [
        workflowService.getOperationsDashboard(),
        supplierService.getOperationsDashboard(),
        invoiceLoader ? invoiceLoader() : Promise.resolve({ data: { data: [] } }),
      ]

      const [customerResult, supplierResult, invoiceResult] = await Promise.allSettled(requests)

      if (customerResult.status === 'fulfilled') {
        setCustomerDashboard(customerResult.value.data?.data || { pending: [], handled: [] })
      } else {
        console.error('Customer operations dashboard failed:', customerResult.reason)
        toast.error('Failed to load customer operations queue')
      }

      if (supplierResult.status === 'fulfilled') {
        setSupplierRows(toArray(supplierResult.value.data?.data))
      } else {
        console.error('Supplier operations dashboard failed:', supplierResult.reason)
        toast.error('Failed to load supplier queue')
      }

      if (invoiceResult.status === 'fulfilled') {
        setInvoiceRows(toArray(invoiceResult.value.data?.data))
      } else if (invoiceLoader) {
        console.error('Invoice operations dashboard failed:', invoiceResult.reason)
        toast.error('Failed to load invoice queue')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [userRoles.join('|')])

  const customerPending = useMemo(
    () => toArray(customerDashboard.pending).filter((row) => row.workflowType !== 'INVOICE_DISCOUNTING'),
    [customerDashboard],
  )

  const customerHandled = useMemo(
    () => toArray(customerDashboard.handled).filter((row) => row.workflowType !== 'INVOICE_DISCOUNTING'),
    [customerDashboard],
  )

  const pendingQueue = useMemo(() => {
    const customers = customerPending.map((row) => ({
      id: `customer-${row.id || row.customerId}`,
      raw: row,
      type: 'customer',
      typeLabel: 'Customer',
      name: getCaseName(row),
      reference: row.customer?.customerCode || row.customerCode || `CUST-${row.customerId || row.id || '-'}`,
      stage: row.currentStatus || row.status,
      stageLabel: formatLabel(row.currentStatus || row.status),
      receivedAt: row.updatedAt || row.createdAt,
      amount: row.amount || row.sanctionAmount || null,
      route: row.customerId ? `/operations/case/${row.customerId}` : null,
    }))

    const suppliers = supplierRows.map((row) => ({
      id: `supplier-${row.id}`,
      raw: row,
      type: 'supplier',
      typeLabel: 'Supplier',
      name: getSupplierName(row),
      reference: row.supplierCode || row.gstNumber || `SUP-${row.id || '-'}`,
      stage: row.status,
      stageLabel: formatLabel(row.status),
      receivedAt: row.updatedAt || row.createdAt,
      amount: null,
      route: row.id ? `/operations/suppliers/${row.id}` : null,
    }))

    const invoices = invoiceRows.map((row) => ({
      id: `invoice-${row.id}`,
      raw: row,
      type: 'invoice',
      typeLabel: 'Invoice',
      name: getInvoiceName(row),
      reference: row.invoiceNumber || `INV-${row.id || '-'}`,
      stage: row.status,
      stageLabel: formatLabel(row.status),
      receivedAt: row.updatedAt || row.createdAt || row.invoiceDate,
      amount: row.invoiceAmount || row.amount || null,
      route: invoiceRoute,
    }))

    return [...customers, ...suppliers, ...invoices].map((row) => ({
      ...row,
      ageDays: getAgeDays(row.receivedAt),
    }))
  }, [customerPending, supplierRows, invoiceRows, invoiceRoute])

  const stageOptions = useMemo(() => {
    const stages = new Map()
    pendingQueue.forEach((row) => {
      if (row.stage) stages.set(normalizeStatus(row.stage), row.stageLabel)
    })
    return Array.from(stages.entries()).map(([value, label]) => ({ value, label }))
  }, [pendingQueue])

  const filteredQueue = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return pendingQueue.filter((row) => {
      const matchesSearch =
        !search ||
        [row.name, row.reference, row.stageLabel, row.typeLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      const matchesType = filters.type === 'all' || row.type === filters.type
      const matchesStage = filters.stage === 'all' || normalizeStatus(row.stage) === filters.stage
      return matchesSearch && matchesType && matchesStage
    })
  }, [filters, pendingQueue])

  const workstreamChart = useMemo(
    () => [
      { name: 'Customer', pending: customerPending.length },
      { name: 'Supplier', pending: supplierRows.length },
      { name: 'Invoice', pending: invoiceRows.length },
    ],
    [customerPending.length, supplierRows.length, invoiceRows.length],
  )

  const stageChart = useMemo(() => {
    const grouped = new Map()
    pendingQueue.forEach((row) => {
      const label = row.stageLabel || 'Unknown'
      grouped.set(label, (grouped.get(label) || 0) + 1)
    })
    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [pendingQueue])

  const handledRows = useMemo(
    () =>
      customerHandled
        .slice(0, 8)
        .map((row) => ({
          ...row,
          customerName: getCaseName(row),
          reference: row.customer?.customerCode || row.customerCode || `CUST-${row.customerId || row.id || '-'}`,
        })),
    [customerHandled],
  )

  const slaWatchCount = pendingQueue.filter((row) => row.ageDays >= 2).length

  const pendingColumns = [
    {
      key: 'typeLabel',
      label: 'Workstream',
      render: (value, row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.type === 'customer'
              ? 'bg-blue-50 text-blue-700'
              : row.type === 'supplier'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          {value}
        </span>
      ),
    },
    { key: 'name', label: 'Name' },
    { key: 'reference', label: 'Reference' },
    {
      key: 'stage',
      label: 'Stage',
      render: (value, row) => <StatusBadge status={value || row.stageLabel} label={row.stageLabel} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => (value ? formatCurrency(value) : '-'),
    },
    {
      key: 'receivedAt',
      label: 'Received',
      render: (value) => formatDate(value),
    },
    {
      key: 'ageDays',
      label: 'Age',
      render: (value) => `${value || 0}d`,
    },
  ]

  const handledColumns = [
    { key: 'customerName', label: 'Customer' },
    { key: 'reference', label: 'Reference' },
    {
      key: 'currentStatus',
      label: 'Stage',
      render: (value) => <StatusBadge status={value} label={formatLabel(value)} />,
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (value) => formatDate(value),
    },
  ]

  const openQueueRow = (row) => {
    if (row.route) navigate(row.route)
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <FiCheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            Operations workbench
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Daily Operations Queue</h1>
          <p className="mt-1 text-sm text-slate-500">Customer checks, supplier onboarding, and invoice verification pending with Operations.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/operations/loan-search"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FiCreditCard className="h-4 w-4" />
            Loan Search
          </Link>
          <Link
            to="/operations/suppliers"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FiTruck className="h-4 w-4" />
            Suppliers
          </Link>
          <Link
            to={invoiceRoute}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FiFileText className="h-4 w-4" />
            Invoices
          </Link>
          <button
            type="button"
            onClick={() => loadDashboard({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open Queue" value={pendingQueue.length} helper={`${filteredQueue.length} after filters`} icon={FiActivity} tone="blue" />
        <KpiCard label="Customer Checks" value={customerPending.length} helper="Onboarding cases awaiting action" icon={FiUsers} tone="emerald" />
        <KpiCard label="Supplier Checks" value={supplierRows.length} helper="Supplier onboarding items" icon={FiTruck} tone="amber" />
        <KpiCard label="SLA Watch" value={slaWatchCount} helper="Items aged 2 days or more" icon={FiAlertTriangle} tone="rose" />
      </section>

      {!isPendingPage && (
        <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel title="Queue By Workstream" subtitle="Pending work assigned to Operations." icon={FiActivity}>
            {pendingQueue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workstreamChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="pending" radius={[6, 6, 0, 0]} fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No open queue." />
            )}
          </ChartPanel>

          <ChartPanel title="Stage Split" subtitle="Current operational stages in the open queue." icon={FiClock}>
            {stageChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stageChart} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={2}>
                    {stageChart.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No stage data." />
            )}
          </ChartPanel>
        </section>
      )}

      <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Operational Worklist</h2>
              <p className="text-sm text-slate-500">Filtered queue for maker-checker and verification activity.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                  <FiSearch className="h-3.5 w-3.5" />
                  Search
                </span>
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Name, reference, stage"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                  <FiFilter className="h-3.5 w-3.5" />
                  Workstream
                </span>
                <select
                  value={filters.type}
                  onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All workstreams</option>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="invoice">Invoice</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
                  <FiFilter className="h-3.5 w-3.5" />
                  Stage
                </span>
                <select
                  value={filters.stage}
                  onChange={(event) => setFilters((prev) => ({ ...prev, stage: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All stages</option>
                  {stageOptions.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <DataTable data={filteredQueue} columns={pendingColumns} onRowClick={openQueueRow} />
      </section>

      {!isPendingPage && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Recently Handled Customer Checks</h2>
              <p className="text-sm text-slate-500">Latest completed or moved operational cases.</p>
            </div>
            <Link to="/operations/pending" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">
              Open pending view
              <FiArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <DataTable data={handledRows} columns={handledColumns} />
        </section>
      )}
    </div>
  )
}

export default OperationsWorkbench
