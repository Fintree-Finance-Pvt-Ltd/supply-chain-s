import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  FiActivity,
  FiArrowUpRight,
  FiAward,
  FiBriefcase,
  FiDollarSign,
  FiFileText,
  FiFolder,
  FiRefreshCw,
  FiSearch,
  FiTrendingUp,
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
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import TablePagination from '../../components/TablePagination'
import api from '../../services/api'
import { loanServicingService } from '../../services/loanServicingService'
import { ROLE_LABELS } from '../../constants/roles'
import { formatCurrency, formatDate } from '../../utils/format'

const chartColors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0f766e']
const PAGE_SIZES = [10, 25, 50]
const RECENT_CASES_LIMIT = 5
const CASHFLOW_POINTS = 14
const SEARCH_DEBOUNCE_MS = 300

const toNumber = (value) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(toNumber(value))

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(toNumber(value))

const formatLabel = (value) =>
  String(value || 'Unknown')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const getLan = (row) => row.lan || row.loanAccount?.lanId || row.loanAccount?.lan || '-'

const getPeriodParams = (days) => (days === 'all' ? { period: 'all' } : { days })

const CREDIT_PERFORMER_ROLES = new Set(['credit_team_l1', 'credit_team_l2', 'credit_head'])
const OPS_PERFORMER_ROLES = new Set(['operations_team_l1', 'operations_team_l2', 'operations_head'])
const TOP_PERFORMER_ROLES = new Set([...CREDIT_PERFORMER_ROLES, ...OPS_PERFORMER_ROLES])
const TOP_PERFORMER_EXCLUDED_ROLES = new Set(['relationship_manager', 'ceo', 'md', 'admin', 'superadmin'])

const isRelationshipManager = (user) => (user?.roles || []).includes('relationship_manager')

const hasPerformerRole = (user, roleSet) => (user?.roles || []).some((role) => roleSet.has(role))

const isCreditOpsDepartmentUser = (user) => {
  const roles = user?.roles || []
  return roles.some((role) => TOP_PERFORMER_ROLES.has(role)) &&
    !roles.some((role) => TOP_PERFORMER_EXCLUDED_ROLES.has(role))
}

const isCreditOpsPerformer = (user) => isCreditOpsDepartmentUser(user) && toNumber(user?.totalPoints) > 0

const getDepartmentPerformers = (explicit, fallback, roleSet) =>
  (explicit || fallback.filter((user) => hasPerformerRole(user, roleSet)))
    .filter((user) => isCreditOpsDepartmentUser(user) && hasPerformerRole(user, roleSet))

// Merge the per-day totals from both reports ('YYYY-MM-DD' keys), keeping only the most recent active days.
const mergeCashflowByDate = (disbursedDaily = [], collectedDaily = []) => {
  const map = new Map()

  const addValue = (dayKey, key, value) => {
    if (!dayKey) return
    const current = map.get(dayKey) || { dayKey, date: formatDate(dayKey, 'dd MMM'), disbursed: 0, collected: 0 }
    current[key] += toNumber(value)
    map.set(dayKey, current)
  }

  disbursedDaily.forEach((point) => addValue(point.date, 'disbursed', point.amount))
  collectedDaily.forEach((point) => addValue(point.date, 'collected', point.amount))

  return Array.from(map.values())
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .slice(-CASHFLOW_POINTS)
}

const Card = ({ className = '', children }) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>
)

const CardHeader = ({ title, subtitle, right }) => (
  <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {right}
  </div>
)

const MetricCard = ({ label, value, helper, icon: Icon, tone = 'blue' }) => {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  )
}

const ChartCard = ({ title, subtitle, children, footer }) => (
  <Card>
    <CardHeader title={title} subtitle={subtitle} />
    <div className="h-64 px-3 pt-4">{children}</div>
    {footer}
  </Card>
)

const EmptyState = ({ label }) => (
  <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-400">{label}</div>
)

const PerformerList = ({ title, items, roleSet, showRmPoints = false, emptyLabel }) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <span className="text-xs text-slate-400">{formatNumber(items.length)} users</span>
    </div>
    {items.length === 0 ? (
      <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">{emptyLabel}</p>
    ) : (
      <ol className="divide-y divide-slate-100">
        {items.slice(0, 5).map((user, index) => {
          const role = showRmPoints ? user.roles?.[0] : (user.roles || []).find((r) => roleSet.has(r))
          return (
            <li key={`${user.userId}-${index}`} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{user.userName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {role ? ROLE_LABELS[role] || formatLabel(role) : '—'} · {formatNumber(user.tasksCompleted)} tasks
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-slate-900">{formatNumber(user.totalPoints)} pts</p>
                {showRmPoints && (
                  <p className="text-xs tabular-nums text-amber-600">{formatNumber(user.rmPoints)} RM</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    )}
  </div>
)

const ReportTable = ({ rows, columns, loading, emptyLabel = 'No records found.' }) => {
  if (rows.length === 0) {
    return loading ? (
      <div className="flex min-h-[120px] items-center justify-center">
        <LoadingSpinner />
      </div>
    ) : (
      <EmptyState label={emptyLabel} />
    )
  }

  return (
    <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-50' : ''}`}>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={row.id || index} className="hover:bg-slate-50/70">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-2.5 text-slate-700 ${
                    col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DpdBadge = ({ value }) => {
  const dpd = toNumber(value)
  const tone = dpd === 0 ? 'text-slate-500' : dpd <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tone}`}>{dpd}</span>
}

const inputClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

const SuperAdminCommandCenter = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [disbursements, setDisbursements] = useState(null)
  const [collections, setCollections] = useState(null)
  const [activeTab, setActiveTab] = useState('portfolio')
  const [filters, setFilters] = useState({ days: '30', startDate: '', endDate: '' })
  const [lanSearch, setLanSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [table, setTable] = useState({ tab: null, rows: [], pagination: null })
  const [tableLoading, setTableLoading] = useState(true)
  const [tableReloadKey, setTableReloadKey] = useState(0)
  const tableRequestRef = useRef(0)

  // Totals and charts only; the table below fetches its own page.
  const loadDashboard = async ({ silent = false, refresh = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      const reportFilters = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        summaryOnly: true,
      }

      const [analyticsRes, portfolioRes, disbursementRes, collectionRes] = await Promise.all([
        api.get('/superadmin/dashboard', { params: getPeriodParams(filters.days) }),
        loanServicingService.getPortfolioReport({ summaryOnly: true, refresh: refresh || undefined }),
        loanServicingService.getDisbursementReport(reportFilters),
        loanServicingService.getCollectionReport(reportFilters),
      ])

      setAnalytics(analyticsRes.data?.data || null)
      setPortfolio(portfolioRes.data || null)
      setDisbursements(disbursementRes.data || null)
      setCollections(collectionRes.data || null)
      // Re-read the table only after a forced snapshot refresh has finished.
      if (refresh) setTableReloadKey((key) => key + 1)
    } catch (error) {
      console.error('Super admin command center failed:', error)
      toast.error(error.response?.data?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboard({ silent: analytics !== null })
  }, [filters.days, filters.startDate, filters.endDate])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(lanSearch.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [lanSearch])

  useEffect(() => {
    const requestId = ++tableRequestRef.current
    const pageParams = { page, limit: pageSize, search: debouncedSearch || undefined }
    const dateParams = { startDate: filters.startDate || undefined, endDate: filters.endDate || undefined }
    const requests = {
      portfolio: () => loanServicingService.getPortfolioReport(pageParams),
      pos: () => loanServicingService.getPortfolioReport({ ...pageParams, view: 'pos' }),
      disbursements: () => loanServicingService.getDisbursementReport({ ...pageParams, ...dateParams }),
      collections: () => loanServicingService.getCollectionReport({ ...pageParams, ...dateParams }),
    }

    setTableLoading(true)
    requests[activeTab]()
      .then((response) => {
        if (requestId !== tableRequestRef.current) return
        setTable({ tab: activeTab, rows: response.data?.rows || [], pagination: response.data?.pagination || null })
      })
      .catch((error) => {
        if (requestId !== tableRequestRef.current) return
        console.error('Super admin table failed:', error)
        toast.error(error.response?.data?.message || 'Failed to load records')
      })
      .finally(() => {
        if (requestId === tableRequestRef.current) setTableLoading(false)
      })
  }, [activeTab, page, pageSize, debouncedSearch, filters.startDate, filters.endDate, tableReloadKey])

  const changeTab = (tabId) => {
    setActiveTab(tabId)
    setPage(1)
  }

  const changePageSize = (size) => {
    setPageSize(size)
    setPage(1)
  }

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    if (key !== 'days') setPage(1)
  }

  const business = analytics?.businessOverview || {}
  const financial = analytics?.financialSnapshot || {}
  const period = analytics?.periodActivity || {}
  const recentCases = (analytics?.recentCases || []).slice(0, RECENT_CASES_LIMIT)
  const topPerformers = (analytics?.topPerformers || []).filter(isCreditOpsPerformer)
  const creditPerformers = getDepartmentPerformers(analytics?.creditPerformers, topPerformers, CREDIT_PERFORMER_ROLES)
  const opsPerformers = getDepartmentPerformers(analytics?.opsPerformers, topPerformers, OPS_PERFORMER_ROLES)
  const rmPerformers = (analytics?.rmPerformers || []).filter(isRelationshipManager)
  const periodLabel = period.label || (filters.days === 'all' ? 'All time' : `Last ${filters.days} days`)

  const sanctioned = toNumber(portfolio?.sanctionedAmount ?? financial.sanctionedBook)
  const disbursed = toNumber(portfolio?.totalDisbursed ?? financial.disbursedBook)
  // POS = principal outstanding; total due adds accrued interest and penal charges.
  const pos = toNumber(portfolio?.principalOutstanding ?? financial.utilizedLimit)
  // Utilization is the share of the sanctioned limit currently drawn (POS), not lifetime disbursals.
  const utilizationRate = sanctioned > 0 ? Math.round((pos / sanctioned) * 100) : toNumber(financial.utilizationRate)

  const exposureChart = [
    { name: 'Sanctioned', amount: sanctioned },
    { name: 'Disbursed', amount: disbursed },
    { name: 'POS', amount: pos },
    { name: 'Collected', amount: toNumber(portfolio?.totalCollected) },
  ]

  const statusChart = useMemo(
    () =>
      (portfolio?.statusBreakdown || [])
        .map((item) => ({ name: formatLabel(item.status), value: toNumber(item.principalOutstanding) }))
        .filter((item) => item.value > 0),
    [portfolio],
  )

  const statusTotal = statusChart.reduce((sum, item) => sum + item.value, 0)

  const cashflowChart = useMemo(
    () => mergeCashflowByDate(disbursements?.daily, collections?.daily),
    [disbursements, collections],
  )

  const statusColumn = {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value} label={formatLabel(value)} />,
  }
  const lanColumn = {
    key: 'lan',
    label: 'LAN',
    render: (_, row) => <span className="font-medium text-slate-900">{getLan(row)}</span>,
  }
  const money = (key, label) => ({ key, label, align: 'right', render: (value) => formatCurrency(value) })

  const portfolioColumns = [
    lanColumn,
    money('sanctionedAmount', 'Sanctioned'),
    money('totalDisbursed', 'Disbursed'),
    money('principalOutstanding', 'POS'),
    money('totalOutstanding', 'Total Due'),
    money('totalCollected', 'Collected'),
    { key: 'dpd', label: 'DPD', align: 'right', render: (value) => <DpdBadge value={value} /> },
    statusColumn,
  ]

  const disbursementColumns = [
    lanColumn,
    { key: 'invoice', label: 'Invoice', render: (_, row) => row.invoice?.invoiceNumber || row.invoiceId || '-' },
    { key: 'disbursementDate', label: 'Date', render: (value) => formatDate(value) },
    { key: 'disbursementUtr', label: 'UTR' },
    money('disbursementAmount', 'Amount'),
    { key: 'dueDate', label: 'Due', render: (value) => formatDate(value) },
    statusColumn,
  ]

  const collectionColumns = [
    lanColumn,
    { key: 'repaymentDate', label: 'Date', render: (value) => formatDate(value) },
    { key: 'utr', label: 'UTR' },
    money('amount', 'Received'),
    money('allocatedAmount', 'Allocated'),
    money('unappliedAmount', 'Unapplied'),
    statusColumn,
  ]

  const tabs = [
    { id: 'portfolio', label: 'Portfolio', title: 'Portfolio Accounts', count: portfolio?.accounts, columns: portfolioColumns },
    { id: 'pos', label: 'POS', title: 'POS Accounts', count: portfolio?.posAccounts, columns: portfolioColumns },
    { id: 'disbursements', label: 'Disbursements', title: 'Disbursement Book', count: disbursements?.count, columns: disbursementColumns },
    { id: 'collections', label: 'Collections', title: 'Collections Book', count: collections?.count, columns: collectionColumns },
  ]
  const activeTable = tabs.find((tab) => tab.id === activeTab)
  // Never render one tab's rows with another tab's columns while the new page is loading.
  const tableRows = table.tab === activeTab ? table.rows : []
  const tablePagination = table.tab === activeTab ? table.pagination : null

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + global filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Super Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Portfolio, cash movement and team performance at a glance.</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-semibold uppercase text-slate-500">Performance period</span>
            <select
              value={filters.days}
              onChange={(event) => updateFilter('days', event.target.value)}
              className={inputClass}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-semibold uppercase text-slate-500">Cash from</span>
            <input
              type="date"
              value={filters.startDate}
              max={filters.endDate || undefined}
              onChange={(event) => updateFilter('startDate', event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[11px] font-semibold uppercase text-slate-500">Cash to</span>
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(event) => updateFilter('endDate', event.target.value)}
              className={inputClass}
            />
          </label>
          <Link
            to="/superadmin/cases"
            className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FiFolder className="h-4 w-4" />
            All Cases
          </Link>
          <button
            type="button"
            onClick={() => loadDashboard({ silent: true, refresh: true })}
            disabled={refreshing}
            className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Sanctioned" value={formatCompactCurrency(sanctioned)} helper={`${formatNumber(portfolio?.accounts)} loan accounts`} icon={FiBriefcase} tone="blue" />
        <MetricCard label="Disbursed" value={formatCompactCurrency(disbursed)} helper={`${utilizationRate}% utilization`} icon={FiDollarSign} tone="emerald" />
        <MetricCard
          label="POS"
          value={formatCompactCurrency(pos)}
          helper={`${formatCompactCurrency(portfolio?.totalOutstanding)} total due · ${formatCompactCurrency(portfolio?.overdueAmount)} overdue`}
          icon={FiTrendingUp}
          tone="rose"
        />
        <MetricCard label="Collected" value={formatCompactCurrency(portfolio?.totalCollected)} helper={`${formatNumber(collections?.count)} receipts`} icon={FiActivity} tone="amber" />
        <MetricCard label="Active Cases" value={formatNumber(business.activeWorkflows)} helper={`${formatNumber(business.completedWorkflows)} completed`} icon={FiFileText} tone="slate" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Book Exposure" subtitle="Sanctioned vs disbursed vs principal outstanding">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={exposureChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={64} fontSize={12} />
              <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {exposureChart.map((entry, index) => (
                  <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cash Movement" subtitle={`Disbursed vs collected · last ${CASHFLOW_POINTS} active days`}>
          {cashflowChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={64} fontSize={12} />
                <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="disbursed" name="Disbursed" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="collected" name="Collected" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No cash movement in this range." />
          )}
        </ChartCard>

        <ChartCard title="POS by Status" subtitle="Principal outstanding split by account status">
          {statusChart.length > 0 ? (
            <div className="flex h-full items-center gap-2">
              <div className="h-full w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                      {statusChart.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-1/2 space-y-2 pr-2 text-sm">
                {statusChart.map((item, index) => (
                  <li key={item.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: chartColors[index % chartColors.length] }} />
                      <span className="truncate text-slate-600">{item.name}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-slate-900">
                      {statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState label="No outstanding balance." />
          )}
        </ChartCard>
      </div>

      {/* Accounts table with tabs, search and pagination */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{activeTable.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatNumber(tablePagination?.total ?? activeTable.count)} {debouncedSearch ? 'matching records' : 'records'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => changeTab(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs text-slate-400">{formatNumber(tab.count)}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={lanSearch}
                onChange={(event) => setLanSearch(event.target.value)}
                placeholder="Search LAN"
                className={`${inputClass} w-full pl-9 sm:w-56`}
              />
            </div>
          </div>
        </div>
        <ReportTable rows={tableRows} columns={activeTable.columns} loading={tableLoading} />
        {tableRows.length > 0 && (
          <TablePagination
            pagination={tablePagination}
            pageSizes={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={tableLoading}
          />
        )}
      </Card>

      {/* Team performance */}
      <Card>
        <CardHeader
          title="Top Performers"
          subtitle={`Points earned · ${periodLabel}`}
          right={<FiAward className="h-5 w-5 text-amber-500" />}
        />
        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-3">
          <PerformerList title="Relationship Managers" items={rmPerformers} showRmPoints emptyLabel="No RM points yet." />
          <PerformerList title="Credit" items={creditPerformers} roleSet={CREDIT_PERFORMER_ROLES} emptyLabel="No credit points yet." />
          <PerformerList title="Operations" items={opsPerformers} roleSet={OPS_PERFORMER_ROLES} emptyLabel="No operations points yet." />
        </div>
      </Card>

      {/* Recent cases */}
      <Card>
        <CardHeader
          title="Recent Case Movement"
          subtitle={`Latest ${RECENT_CASES_LIMIT} workflow updates`}
          right={
            <Link to="/superadmin/cases" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">
              View all
              <FiArrowUpRight className="h-4 w-4" />
            </Link>
          }
        />
        {recentCases.length === 0 ? (
          <EmptyState label="No recent case activity." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentCases.map((item, index) => (
              <li key={item.id || index} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.title || '-'}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[item.reference, item.assignedStage && formatLabel(item.assignedStage), formatDate(item.updatedAt)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.amount ? (
                    <span className="text-sm font-medium tabular-nums text-slate-700">{formatCurrency(item.amount)}</span>
                  ) : null}
                  <StatusBadge status={item.status} label={formatLabel(item.status)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default SuperAdminCommandCenter
