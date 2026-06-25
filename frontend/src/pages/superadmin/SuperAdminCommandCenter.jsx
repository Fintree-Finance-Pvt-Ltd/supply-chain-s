import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  FiActivity,
  FiAlertCircle,
  FiArrowUpRight,
  FiBarChart2,
  FiBriefcase,
  FiDollarSign,
  FiFileText,
  FiFilter,
  FiFolder,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
} from 'react-icons/fi'
import {
  Area,
  AreaChart,
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
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import api from '../../services/api'
import { loanServicingService } from '../../services/loanServicingService'
import { formatCurrency, formatDate } from '../../utils/format'

const chartColors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0f766e']

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

const groupCashflowByDate = (disbursements = [], collections = []) => {
  const map = new Map()

  const addValue = (dateValue, key, value) => {
    const label = formatDate(dateValue, 'dd MMM')
    const current = map.get(label) || { date: label, disbursed: 0, collected: 0 }
    current[key] += toNumber(value)
    map.set(label, current)
  }

  disbursements.forEach((row) => addValue(row.disbursementDate, 'disbursed', row.disbursementAmount))
  collections.forEach((row) => addValue(row.repaymentDate, 'collected', row.amount))

  return Array.from(map.values()).slice(0, 10).reverse()
}

const MetricCard = ({ label, value, helper, icon: Icon, tone = 'blue' }) => {
  const toneMap = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

const ChartPanel = ({ title, subtitle, icon: Icon, children }) => (
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

const SuperAdminCommandCenter = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [portfolio, setPortfolio] = useState(null)
  const [disbursements, setDisbursements] = useState(null)
  const [collections, setCollections] = useState(null)
  const [activeTab, setActiveTab] = useState('portfolio')
  const [filters, setFilters] = useState({ days: '30', startDate: '', endDate: '', lan: '' })

  const loadDashboard = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      const reportFilters = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      }

      const [analyticsRes, portfolioRes, disbursementRes, collectionRes] = await Promise.all([
        api.get('/superadmin/dashboard', { params: { days: filters.days } }),
        loanServicingService.getPortfolioReport(),
        loanServicingService.getDisbursementReport(reportFilters),
        loanServicingService.getCollectionReport(reportFilters),
      ])

      setAnalytics(analyticsRes.data?.data || null)
      setPortfolio(portfolioRes.data || null)
      setDisbursements(disbursementRes.data || null)
      setCollections(collectionRes.data || null)
    } catch (error) {
      console.error('Super admin command center failed:', error)
      toast.error(error.response?.data?.message || 'Failed to load command center')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const financial = analytics?.financialSnapshot || {}
  const business = analytics?.businessOverview || {}
  const monthlyTrend = analytics?.monthlyTrend || []
  const workflowPipeline = analytics?.workflowPipeline || []
  const recentCases = analytics?.recentCases || []

  const cleanLan = filters.lan.trim().toLowerCase()
  const portfolioRows = useMemo(() => {
    const rows = portfolio?.rows || []
    if (!cleanLan) return rows
    return rows.filter((row) => getLan(row).toLowerCase().includes(cleanLan))
  }, [portfolio, cleanLan])

  const disbursementRows = useMemo(() => {
    const rows = disbursements?.rows || []
    if (!cleanLan) return rows
    return rows.filter((row) => getLan(row).toLowerCase().includes(cleanLan))
  }, [disbursements, cleanLan])

  const collectionRows = useMemo(() => {
    const rows = collections?.rows || []
    if (!cleanLan) return rows
    return rows.filter((row) => getLan(row).toLowerCase().includes(cleanLan))
  }, [collections, cleanLan])

  const posRows = useMemo(
    () => portfolioRows.filter((row) => toNumber(row.totalOutstanding) > 0).sort((a, b) => toNumber(b.totalOutstanding) - toNumber(a.totalOutstanding)),
    [portfolioRows],
  )

  const utilizationRate = useMemo(() => {
    const sanctioned = toNumber(portfolio?.sanctionedAmount || financial.sanctionedBook)
    const disbursed = toNumber(portfolio?.totalDisbursed || financial.disbursedBook)
    return sanctioned > 0 ? Math.round((disbursed / sanctioned) * 100) : toNumber(financial.utilizationRate)
  }, [portfolio, financial])

  const exposureChart = useMemo(
    () => [
      { name: 'Sanctioned', amount: toNumber(portfolio?.sanctionedAmount || financial.sanctionedBook) },
      { name: 'Disbursed', amount: toNumber(portfolio?.totalDisbursed || financial.disbursedBook) },
      { name: 'POS', amount: toNumber(portfolio?.totalOutstanding) },
      { name: 'Collections', amount: toNumber(portfolio?.totalCollected) },
    ],
    [portfolio, financial],
  )

  const statusChart = useMemo(() => {
    const grouped = new Map()
    portfolioRows.forEach((row) => {
      const key = formatLabel(row.status)
      grouped.set(key, (grouped.get(key) || 0) + toNumber(row.totalOutstanding))
    })
    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }))
  }, [portfolioRows])

  const cashflowChart = useMemo(
    () => groupCashflowByDate(disbursementRows, collectionRows),
    [disbursementRows, collectionRows],
  )

  const workflowChart = useMemo(
    () =>
      workflowPipeline.map((item) => ({
        name: item.label,
        active: toNumber(item.active),
        completed: toNumber(item.completed),
        rejected: toNumber(item.rejected),
      })),
    [workflowPipeline],
  )

  const portfolioColumns = [
    { key: 'lan', label: 'LAN', render: (_, row) => getLan(row) },
    { key: 'sanctionedAmount', label: 'Sanctioned', render: (value) => formatCurrency(value) },
    { key: 'totalDisbursed', label: 'Disbursed', render: (value) => formatCurrency(value) },
    { key: 'totalOutstanding', label: 'POS', render: (value) => formatCurrency(value) },
    { key: 'totalCollected', label: 'Collected', render: (value) => formatCurrency(value) },
    { key: 'dpd', label: 'DPD', render: (value) => value || 0 },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={formatLabel(value)} /> },
  ]

  const disbursementColumns = [
    { key: 'lan', label: 'LAN', render: (_, row) => getLan(row) },
    { key: 'invoiceId', label: 'Invoice ID' },
    { key: 'disbursementDate', label: 'Date', render: (value) => formatDate(value) },
    { key: 'disbursementUtr', label: 'UTR' },
    { key: 'disbursementAmount', label: 'Amount', render: (value) => formatCurrency(value) },
    { key: 'dueDate', label: 'Due Date', render: (value) => formatDate(value) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={formatLabel(value)} /> },
  ]

  const collectionColumns = [
    { key: 'lan', label: 'LAN', render: (_, row) => getLan(row) },
    { key: 'repaymentDate', label: 'Date', render: (value) => formatDate(value) },
    { key: 'utr', label: 'UTR' },
    { key: 'amount', label: 'Collection', render: (value) => formatCurrency(value) },
    { key: 'allocatedAmount', label: 'Allocated', render: (value) => formatCurrency(value) },
    { key: 'unappliedAmount', label: 'Unapplied', render: (value) => formatCurrency(value) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={formatLabel(value)} /> },
  ]

  const recentColumns = [
    { key: 'title', label: 'Case' },
    { key: 'reference', label: 'Reference' },
    { key: 'assignedStage', label: 'Stage', render: (value) => formatLabel(value) },
    { key: 'amount', label: 'Amount', render: (value) => (value ? formatCurrency(value) : '-') },
    { key: 'updatedAt', label: 'Updated', render: (value) => formatDate(value) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={formatLabel(value)} /> },
  ]

  const activeTable = {
    portfolio: { title: 'Portfolio Accounts', rows: portfolioRows, columns: portfolioColumns },
    pos: { title: 'POS Accounts', rows: posRows, columns: portfolioColumns },
    disbursements: { title: 'Disbursement Book', rows: disbursementRows, columns: disbursementColumns },
    collections: { title: 'Collections Book', rows: collectionRows, columns: collectionColumns },
  }[activeTab]

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <FiShield className="h-3.5 w-3.5 text-blue-700" />
            Super Admin
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Super Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Portfolio, POS, collections, sanctions, and workflow movement in one control view.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/superadmin/cases"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FiFolder className="h-4 w-4" />
            All Cases
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

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Period</span>
            <select
              value={filters.days}
              onChange={(event) => setFilters((prev) => ({ ...prev, days: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">From</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">To</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-slate-500">
              <FiFilter className="h-3.5 w-3.5" />
              LAN
            </span>
            <input
              type="search"
              value={filters.lan}
              onChange={(event) => setFilters((prev) => ({ ...prev, lan: event.target.value }))}
              placeholder="Filter LAN"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Portfolio" value={formatCompactCurrency(portfolio?.sanctionedAmount)} helper={`${formatNumber(portfolio?.accounts)} loan accounts`} icon={FiBriefcase} tone="blue" />
        <MetricCard label="POS" value={formatCompactCurrency(portfolio?.totalOutstanding)} helper={`${formatCompactCurrency(portfolio?.overdueAmount)} overdue`} icon={FiTrendingUp} tone="rose" />
        <MetricCard label="Disbursed" value={formatCompactCurrency(portfolio?.totalDisbursed)} helper={`${utilizationRate}% utilization`} icon={FiDollarSign} tone="emerald" />
        <MetricCard label="Collections" value={formatCompactCurrency(portfolio?.totalCollected)} helper={`${formatNumber(collections?.count)} receipts`} icon={FiActivity} tone="amber" />
        <MetricCard label="Workflow Queue" value={formatNumber(business.activeWorkflows)} helper={`${formatNumber(business.completedWorkflows)} completed`} icon={FiFileText} tone="slate" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel title="Book Exposure" subtitle="Sanctioned, disbursed, POS and collections." icon={FiBarChart2}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={exposureChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={72} />
              <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Cash Movement" subtitle="Disbursements and collections in the selected date range." icon={FiActivity}>
          {cashflowChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value) => formatCurrency(value)} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="disbursed" name="Disbursed" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No cash movement for this filter." />
          )}
        </ChartPanel>

        <ChartPanel title="POS By Status" subtitle="Outstanding exposure split by account status." icon={FiAlertCircle}>
          {statusChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={2}>
                  {statusChart.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No POS status data." />
          )}
        </ChartPanel>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel title="Origination Trend" subtitle="Invoice value over recent months." icon={FiTrendingUp}>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="invoiceAmountGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatCompactCurrency} tickLine={false} axisLine={false} width={72} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="invoiceAmount" name="Invoice value" stroke="#2563eb" fill="url(#invoiceAmountGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No origination trend data." />
          )}
        </ChartPanel>

        <ChartPanel title="Workflow Mix" subtitle="Active, completed, and rejected cases by workflow." icon={FiFileText}>
          {workflowChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workflowChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="active" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                <Bar dataKey="completed" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                <Bar dataKey="rejected" stackId="a" fill="#dc2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No workflow data." />
          )}
        </ChartPanel>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{activeTable.title}</h2>
            <p className="text-sm text-slate-500">{formatNumber(activeTable.rows.length)} records after filters</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'portfolio', label: 'Portfolio' },
              { id: 'pos', label: 'POS' },
              { id: 'disbursements', label: 'Disbursements' },
              { id: 'collections', label: 'Collections' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <DataTable data={activeTable.rows} columns={activeTable.columns} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Recent Case Movement</h2>
            <p className="text-sm text-slate-500">Latest workflow changes across customers, suppliers, and invoices.</p>
          </div>
          <Link to="/superadmin/cases" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">
            View all cases
            <FiArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <DataTable data={recentCases} columns={recentColumns} />
      </section>
    </div>
  )
}

export default SuperAdminCommandCenter
