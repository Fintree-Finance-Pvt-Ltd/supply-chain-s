import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  FiActivity,
  FiAward,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
  FiTruck,
  FiUsers,
} from 'react-icons/fi'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import LoadingSpinner from '../../components/LoadingSpinner'
import TablePagination from '../../components/TablePagination'
import api from '../../services/api'
import { ROLE_LABELS } from '../../constants/roles'
import { formatDate } from '../../utils/format'

const PARTNER_PAGE_SIZE = 8
const PARTNER_EXPORT_LIMIT = 50

const PERIOD_OPTIONS = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: '180', label: '180D' },
  { value: 'all', label: 'All' },
]

const pipelineColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0f766e', '#dc2626']

const toNumber = (value) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(toNumber(value))

const formatCurrency = (value, compact = true) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(toNumber(value))

const formatMinutes = (minutes) => {
  const value = toNumber(minutes)
  if (!value) return '—'
  if (value >= 1440) return `${(value / 1440).toFixed(1)}d`
  if (value >= 60) return `${(value / 60).toFixed(1)}h`
  return `${Math.round(value)}m`
}

const formatLabel = (value) =>
  value
    ? String(value)
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Unknown'

const percentOf = (part, total) => (toNumber(total) > 0 ? (toNumber(part) / toNumber(total)) * 100 : 0)

const formatPercent = (value) => `${Math.round(toNumber(value))}%`

const clampPercent = (value) => Math.min(100, Math.max(0, toNumber(value)))

const getPeriodParams = (timeRange) => (timeRange === 'all' ? { period: 'all' } : { days: timeRange })

const downloadCsv = (filename, sections) => {
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = sections.flatMap(({ title, headers, rows }) => [
    escape(title),
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
    '',
  ])
  const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/* ---------- Building blocks ---------- */

const toneClasses = {
  blue: { icon: 'bg-blue-50 text-blue-700', bar: 'bg-blue-600' },
  emerald: { icon: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-600' },
  amber: { icon: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500' },
  rose: { icon: 'bg-rose-50 text-rose-700', bar: 'bg-rose-600' },
  indigo: { icon: 'bg-indigo-50 text-indigo-700', bar: 'bg-indigo-600' },
  slate: { icon: 'bg-slate-100 text-slate-700', bar: 'bg-slate-600' },
}

const Card = ({ className = '', children }) => (
  <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>
)

const CardHeader = ({ title, subtitle, scope, right }) => (
  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {scope && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {scope}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {right}
  </div>
)

const SectionTitle = ({ children, hint }) => (
  <div className="flex items-baseline justify-between gap-3">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
    {hint && <span className="text-xs text-slate-400">{hint}</span>}
  </div>
)

const MetricCard = ({ title, value, caption, icon: Icon, tone = 'slate' }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses[tone].icon}`}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    <p className="mt-1 truncate text-xs text-slate-500">{caption}</p>
  </div>
)

const ProgressBar = ({ value, tone = 'blue', className = 'h-2' }) => (
  <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${className}`}>
    <div className={`h-full rounded-full ${toneClasses[tone].bar}`} style={{ width: `${clampPercent(value)}%` }} />
  </div>
)

const Stat = ({ label, value, accent }) => (
  <div className={`border-l-2 pl-3 ${accent}`}>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
  </div>
)

const EmptyState = ({ label }) => (
  <div className="flex min-h-[120px] items-center justify-center px-5 py-6 text-center text-sm text-slate-400">{label}</div>
)

const StatusPanel = ({ title, icon: Icon, items = [], tone, showAmount = false }) => {
  const total = items.reduce((sum, item) => sum + toNumber(item.count), 0)

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`${formatNumber(total)} records`}
        right={<Icon className="h-5 w-5 text-slate-400" />}
      />
      {items.length > 0 ? (
        <ul className="space-y-3 p-5">
          {items.map((item) => (
            <li key={item.status}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-slate-700">{item.label || formatLabel(item.status)}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-slate-900">{formatNumber(item.count)}</span>
                  {showAmount && toNumber(item.amount) > 0 && (
                    <span className="ml-2 text-xs text-slate-500">{formatCurrency(item.amount)}</span>
                  )}
                  <span className="ml-2 inline-block w-10 text-right text-xs text-slate-400">
                    {formatPercent(percentOf(item.count, total))}
                  </span>
                </span>
              </div>
              <ProgressBar value={percentOf(item.count, total)} tone={tone} className="h-1.5" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState label="No status data available." />
      )}
    </Card>
  )
}

const RankingPanel = ({ title, subtitle, icon: Icon, iconClass, items = [], metric, emptyLabel, countLabel = 'tasks closed' }) => (
  <Card>
    <CardHeader title={title} subtitle={subtitle} scope="All time" right={<Icon className={`h-5 w-5 ${iconClass}`} />} />
    {items.length > 0 ? (
      <ol className="divide-y divide-slate-100">
        {items.slice(0, 5).map((item, index) => (
          <li key={`${item.userId}-${index}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{item.userName}</p>
                <p className="text-xs text-slate-500">{formatNumber(item.tasksCompleted)} {countLabel}</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{metric(item)}</span>
          </li>
        ))}
      </ol>
    ) : (
      <EmptyState label={emptyLabel} />
    )}
  </Card>
)

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-900">{label}</p>
      <p className="text-slate-600">Invoice value: <span className="font-semibold text-slate-900">{formatCurrency(row.invoiceAmount, false)}</span></p>
      <p className="text-slate-600">Invoices: <span className="font-semibold text-slate-900">{formatNumber(row.invoices)}</span></p>
      <p className="text-slate-600">New customers: <span className="font-semibold text-slate-900">{formatNumber(row.customers)}</span></p>
      <p className="text-slate-600">New suppliers: <span className="font-semibold text-slate-900">{formatNumber(row.suppliers)}</span></p>
    </div>
  )
}

const PipelineTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-900">{row.name}</p>
      <p className="text-slate-600">Open cases: <span className="font-semibold text-slate-900">{formatNumber(row.openCases)}</span></p>
      <p className="text-slate-600">Stuck: <span className="font-semibold text-rose-700">{formatNumber(row.staleCases)}</span></p>
    </div>
  )
}

const CasePipelineCard = ({ pipeline }) => {
  const totalOpen = toNumber(pipeline?.totalOpen)
  const totalStale = toNumber(pipeline?.totalStale)
  const chartData = (pipeline?.departments || [])
    .map((dept) => ({
      name: dept.label || formatLabel(dept.key),
      openCases: toNumber(dept.openCases),
      staleCases: toNumber(dept.staleCases),
    }))
    .filter((dept) => dept.openCases > 0)

  return (
    <Card>
      <CardHeader
        title="Case Pipeline"
        subtitle={`Open cases by department; stuck means no movement for over ${pipeline?.staleAfterDays ?? 3} days`}
        scope="Live"
        right={<FiActivity className="h-5 w-5 text-slate-400" />}
      />
      {totalOpen > 0 && chartData.length > 0 ? (
        <div className="space-y-4 p-5">
          <div className="relative h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="openCases"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="86%"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={entry.name} fill={pipelineColors[index % pipelineColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PipelineTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-bold tabular-nums text-slate-900">{formatNumber(totalOpen)}</span>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Open</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Open cases" value={formatNumber(totalOpen)} accent="border-blue-500" />
              <Stat label="Stuck cases" value={formatNumber(totalStale)} accent="border-rose-500" />
            </div>
            <ul className="space-y-2">
              {chartData.map((item, index) => (
                <li key={item.name} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: pipelineColors[index % pipelineColors.length] }} />
                      <span className="truncate font-medium text-slate-700">{item.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-900">{formatNumber(item.openCases)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{formatPercent(percentOf(item.openCases, totalOpen))} of open cases</span>
                    <span className={item.staleCases > 0 ? 'font-semibold text-rose-700' : 'text-slate-400'}>
                      {formatNumber(item.staleCases)} stuck
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <EmptyState label="No open cases in the live pipeline." />
      )}
    </Card>
  )
}

/* ---------- Page ---------- */

const Analytics = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [timeRange, setTimeRange] = useState('30')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [partnerPage, setPartnerPage] = useState(1)
  const [partnerData, setPartnerData] = useState({ rows: [], totals: {}, pagination: null })
  const [partnerLoading, setPartnerLoading] = useState(true)
  const [partnerReloadKey, setPartnerReloadKey] = useState(0)

  const fetchAnalytics = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      const response = await api.get('/superadmin/dashboard', { params: getPeriodParams(timeRange) })
      if (response.data.success) {
        setAnalytics(response.data.data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error(error.response?.data?.message || 'Failed to fetch analytics data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics({ silent: analytics !== null })
  }, [timeRange])

  useEffect(() => {
    let cancelled = false
    setPartnerLoading(true)
    api
      .get('/superadmin/analytics/partners', { params: { page: partnerPage, limit: PARTNER_PAGE_SIZE } })
      .then((response) => {
        if (!cancelled && response.data.success) setPartnerData(response.data.data)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error fetching partner sanction mix:', error)
        toast.error(error.response?.data?.message || 'Failed to fetch partner sanction mix')
      })
      .finally(() => {
        if (!cancelled) setPartnerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [partnerPage, partnerReloadKey])

  const refreshAll = () => {
    fetchAnalytics({ silent: true })
    setPartnerReloadKey((key) => key + 1)
  }

  const overview = analytics?.overview || {}
  const business = analytics?.businessOverview || {}
  const financial = analytics?.financialSnapshot || {}
  const period = analytics?.periodActivity || {}
  const statusBreakdowns = analytics?.statusBreakdowns || {}
  const monthlyTrend = analytics?.monthlyTrend || []
  const casePipeline = analytics?.casePipeline || {}
  const bucketStats = analytics?.bucketStats || []
  const l1l2 = analytics?.l1L2Comparison || {}
  const partnerSanctions = partnerData.rows || []
  const partnerPagination = partnerData.pagination
  const fastestClosers = analytics?.fastestClosers || []
  const productivityRanking = analytics?.productivityRanking || []

  // With few users the fastest and slowest lists overlap; only flag people who aren't already top performers.
  const slowestClosers = useMemo(() => {
    const fastestIds = new Set(fastestClosers.slice(0, 5).map((item) => item.userId))
    return (analytics?.slowestClosers || []).filter((item) => !fastestIds.has(item.userId))
  }, [analytics, fastestClosers])

  const periodLabel = period.label || (timeRange === 'all' ? 'All time' : `Last ${timeRange} days`)

  const decidedWorkflows = toNumber(period.completedWorkflows) + toNumber(period.rejectedWorkflows)
  const approvalRate = percentOf(period.completedWorkflows, decidedWorkflows)

  // activeTasks / pendingTasks are open cases (in team queues / with others); overdueTasks are the stuck ones.
  const openCases = toNumber(overview.activeTasks) + toNumber(overview.pendingTasks)
  const movingRate = percentOf(openCases - toNumber(overview.overdueTasks), openCases)
  const bucketStepTotal = bucketStats.reduce((sum, bucket) => sum + toNumber(bucket.completedTasks), 0)
  const stageMaxTime = Math.max(toNumber(l1l2.l1Stats?.avgTime), toNumber(l1l2.l2Stats?.avgTime), 1)

  const sanctionedBook = toNumber(financial.sanctionedBook)
  // Share of book is measured against the same loan-account total the partner rows are built from.
  const partnerBookTotal = toNumber(partnerData.totals?.sanctionedAmount) || sanctionedBook

  // All three steps are invoice value so the percentages compare like with like.
  const invoiceFunnel = [
    { label: 'Total invoiced', value: financial.totalInvoiceAmount, tone: 'slate' },
    { label: 'In pipeline', value: financial.outstandingInvoiceAmount, tone: 'amber' },
    { label: 'Financed', value: financial.financedInvoiceAmount, tone: 'emerald' },
  ]

  const exportReport = async () => {
    let allPartners = partnerSanctions
    try {
      const response = await api.get('/superadmin/analytics/partners', { params: { page: 1, limit: PARTNER_EXPORT_LIMIT } })
      allPartners = response.data?.data?.rows || partnerSanctions
    } catch (error) {
      console.error('Error fetching partners for export:', error)
    }

    downloadCsv(`supply-chain-analytics-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`, [
      {
        title: `Period activity (${periodLabel})`,
        headers: ['Metric', 'Value'],
        rows: [
          ['New customers', toNumber(period.newCustomers)],
          ['New suppliers', toNumber(period.newSuppliers)],
          ['New invoices', toNumber(period.newInvoices)],
          ['Invoice value', toNumber(period.invoiceAmount)],
          ['Disbursed amount', toNumber(period.disbursedAmount)],
          ['Workflows approved', toNumber(period.completedWorkflows)],
          ['Workflows rejected', toNumber(period.rejectedWorkflows)],
        ],
      },
      {
        title: 'Credit book (all time)',
        headers: ['Metric', 'Value'],
        rows: [
          ['Sanctioned book', sanctionedBook],
          ['Disbursed book', toNumber(financial.disbursedBook)],
          ['Utilized limit', toNumber(financial.utilizedLimit)],
          ['Unutilized limit', toNumber(financial.unutilizedLimit)],
          ['Utilization %', toNumber(financial.utilizationRate)],
          ['Loan accounts', toNumber(financial.loanAccounts)],
          ['Total invoiced', toNumber(financial.totalInvoiceAmount)],
          ['Invoices in pipeline', toNumber(financial.outstandingInvoiceAmount)],
          ['Invoices financed (invoice value)', toNumber(financial.financedInvoiceAmount)],
          ['Amount disbursed', toNumber(financial.disbursedInvoiceAmount)],
        ],
      },
      {
        title: 'Monthly origination',
        headers: ['Month', 'Customers', 'Suppliers', 'Invoices', 'Invoice value'],
        rows: monthlyTrend.map((m) => [m.label, m.customers, m.suppliers, m.invoices, m.invoiceAmount]),
      },
      {
        title: 'Partner sanction mix',
        headers: ['Partner', 'Code', 'Loan accounts', 'Active', 'Sanctioned', 'Disbursed', 'Utilization %'],
        rows: allPartners.map((p) => [
          p.partnerName, p.partnerCode, p.sanctionCount, p.activeAccounts, p.sanctionedAmount, p.disbursedAmount, p.utilizationRate,
        ]),
      },
      {
        title: 'Bucket performance',
        headers: ['Bucket', 'Roles', 'Team', 'Steps closed', 'In queue', 'Avg handling (min)'],
        rows: bucketStats.map((b) => [
          b.bucketName, (b.roles || []).join(' / '), b.userCount, b.completedTasks, b.pendingTasks, Math.round(toNumber(b.avgCompletionTime)),
        ]),
      },
    ])
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Supply Chain Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Origination, credit book, pipeline and team efficiency
            {lastUpdated && <span className="text-slate-400"> · Updated {formatDate(lastUpdated, 'dd MMM, hh:mm a')}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeRange(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  timeRange === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FiDownload className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Period activity — the only section driven by the period selector */}
      <div className="space-y-3">
        <SectionTitle hint="Changes with the period selector">Activity · {periodLabel}</SectionTitle>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            title="New Customers"
            value={formatNumber(period.newCustomers)}
            caption={`${formatNumber(business.totalCustomers)} total customers`}
            icon={FiUsers}
            tone="blue"
          />
          <MetricCard
            title="New Suppliers"
            value={formatNumber(period.newSuppliers)}
            caption={`${formatNumber(business.totalSuppliers)} total suppliers`}
            icon={FiTruck}
            tone="emerald"
          />
          <MetricCard
            title="Invoices Raised"
            value={formatCurrency(period.invoiceAmount)}
            caption={`${formatNumber(period.newInvoices)} invoices`}
            icon={FiFileText}
            tone="indigo"
          />
          <MetricCard
            title="Disbursed"
            value={formatCurrency(period.disbursedAmount)}
            caption={`${formatCurrency(financial.disbursedBook)} disbursed all time`}
            icon={FiDollarSign}
            tone="amber"
          />
          <MetricCard
            title="Approval Rate"
            value={decidedWorkflows > 0 ? formatPercent(approvalRate) : '—'}
            caption={`${formatNumber(period.completedWorkflows)} approved · ${formatNumber(period.rejectedWorkflows)} rejected`}
            icon={FiCheckCircle}
            tone={approvalRate >= 70 || decidedWorkflows === 0 ? 'emerald' : 'rose'}
          />
        </div>
      </div>

      {/* Credit book */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Sanction Book" subtitle="Limits sanctioned vs utilized" scope="All time" />
          <div className="space-y-5 p-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-slate-600">Limit utilization</span>
                <span className="text-xl font-bold tabular-nums text-slate-900">{formatPercent(financial.utilizationRate)}</span>
              </div>
              <ProgressBar value={financial.utilizationRate} tone="amber" className="h-2.5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Sanctioned" value={formatCurrency(sanctionedBook)} accent="border-blue-500" />
              <Stat label="Disbursed" value={formatCurrency(financial.disbursedBook)} accent="border-emerald-500" />
              <Stat label="Utilized limit" value={formatCurrency(financial.utilizedLimit)} accent="border-amber-500" />
              <Stat label="Available limit" value={formatCurrency(financial.unutilizedLimit)} accent="border-slate-400" />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500">Loan A/Cs</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{formatNumber(financial.loanAccounts)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500">Approved</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{formatNumber(financial.approvedSanctionCount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-500">Avg ROI</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                  {toNumber(financial.averageInterestRate) ? `${toNumber(financial.averageInterestRate).toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Invoice Funnel" subtitle="How much invoice value gets financed" scope="All time" />
          <div className="space-y-4 p-5">
            {invoiceFunnel.map((step) => (
              <div key={step.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm text-slate-600">{step.label}</span>
                  <span className="tabular-nums">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(step.value)}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {formatPercent(percentOf(step.value, financial.totalInvoiceAmount))}
                    </span>
                  </span>
                </div>
                <ProgressBar value={percentOf(step.value, financial.totalInvoiceAmount)} tone={step.tone} className="h-2.5" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <Stat label="Avg invoice size" value={formatCurrency(financial.averageInvoiceAmount)} accent="border-indigo-500" />
              <Stat
                label="Invoices financed"
                value={`${formatNumber(business.disbursedInvoices)} / ${formatNumber(business.totalInvoices)}`}
                accent="border-emerald-500"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Operating Rhythm" subtitle="Where open cases wait and how fast teams move them" scope="Live" right={<FiActivity className="h-5 w-5 text-slate-400" />} />
          <div className="space-y-5 p-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-slate-600">Open cases moving</span>
                <span className="text-xl font-bold tabular-nums text-slate-900">
                  {openCases > 0 ? formatPercent(movingRate) : '—'}
                </span>
              </div>
              <ProgressBar value={movingRate} tone="emerald" className="h-2.5" />
              <p className="mt-1.5 text-xs text-slate-500">
                {formatNumber(openCases)} open · avg {formatMinutes(overview.averageCompletionTime)} per step
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="In team queues" value={formatNumber(overview.activeTasks)} accent="border-blue-500" />
              <Stat label="With RM / others" value={formatNumber(overview.pendingTasks)} accent="border-amber-500" />
              <Stat label="Steps closed" value={formatNumber(overview.completedTasks)} accent="border-emerald-500" />
              <Stat label="No movement 3d+" value={formatNumber(overview.overdueTasks)} accent="border-rose-500" />
            </div>
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              {[
                { label: 'L1 avg time', stats: l1l2.l1Stats, tone: 'blue' },
                { label: 'L2 avg time', stats: l1l2.l2Stats, tone: 'indigo' },
              ].map(({ label, stats, tone }) => (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {label} <span className="text-slate-400">· {formatNumber(stats?.taskCount)} steps</span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">{formatMinutes(stats?.avgTime)}</span>
                  </div>
                  <ProgressBar value={percentOf(stats?.avgTime, stageMaxTime)} tone={tone} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly Origination" subtitle="Invoice value (bars) and invoice count (line)" scope="Last 6 months" />
          <div className="h-72 px-3 py-4">
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis yAxisId="amount" tickFormatter={(v) => formatCurrency(v)} tickLine={false} axisLine={false} width={64} fontSize={12} />
                  <YAxis yAxisId="count" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} width={32} fontSize={12} />
                  <Tooltip content={<TrendTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="amount" dataKey="invoiceAmount" name="Invoice value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Line yAxisId="count" type="monotone" dataKey="invoices" name="Invoices" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="No origination data in the last 6 months." />
            )}
          </div>
        </Card>

        <CasePipelineCard pipeline={casePipeline} />
      </div>

      {/* Partner mix */}
      <Card>
        <CardHeader
          title="Partner Sanction Mix"
          subtitle={`${formatNumber(partnerPagination?.total)} partners, largest sanctioned limit first`}
          scope="All time"
        />
        {partnerSanctions.length === 0 && partnerLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : partnerSanctions.length > 0 ? (
          <>
            <div className={`overflow-x-auto transition-opacity ${partnerLoading ? 'opacity-50' : ''}`}>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Partner</th>
                    <th className="px-4 py-2.5 text-right">Loan A/Cs</th>
                    <th className="px-4 py-2.5 text-right">Sanctioned</th>
                    <th className="px-4 py-2.5 text-right">Disbursed</th>
                    <th className="w-48 px-4 py-2.5 text-left">Utilization</th>
                    <th className="px-5 py-2.5 text-right">Share of book</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerSanctions.map((partner, index) => (
                    <tr key={`${partner.partnerCode}-${index}`} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{partner.partnerName}</p>
                        <p className="text-xs text-slate-500">{partner.partnerCode}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {formatNumber(partner.sanctionCount)}
                        <span className="block text-xs text-slate-400">{formatNumber(partner.activeAccounts)} active</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">{formatCurrency(partner.sanctionedAmount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(partner.disbursedAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={partner.utilizationRate}
                            tone={toNumber(partner.utilizationRate) >= 90 ? 'rose' : 'amber'}
                            className="h-1.5"
                          />
                          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-600">
                            {formatPercent(partner.utilizationRate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                        {formatPercent(percentOf(partner.sanctionedAmount, partnerBookTotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination pagination={partnerPagination} onPageChange={setPartnerPage} disabled={partnerLoading} />
          </>
        ) : (
          <EmptyState label="No partner sanction data available." />
        )}
      </Card>

      {/* Status mix */}
      <div className="space-y-3">
        <SectionTitle hint="All time">Status Mix</SectionTitle>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <StatusPanel title="Customers" icon={FiUsers} items={statusBreakdowns.customers || []} tone="blue" />
          <StatusPanel title="Suppliers" icon={FiTruck} items={statusBreakdowns.suppliers || []} tone="emerald" />
          <StatusPanel title="Invoices" icon={FiFileText} items={statusBreakdowns.invoices || []} tone="indigo" showAmount />
        </div>
      </div>

      {/* Team efficiency */}
      <div className="space-y-3">
        <SectionTitle hint="All time">Team Efficiency</SectionTitle>

        <Card>
          <CardHeader
            title="Bucket Performance"
            subtitle="Case steps closed, cases waiting and average time a case sits with each work bucket"
            right={<FiClock className="h-5 w-5 text-slate-400" />}
          />
          {bucketStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left">Bucket</th>
                    <th className="px-4 py-2.5 text-right">Team</th>
                    <th className="px-4 py-2.5 text-right">Steps Closed</th>
                    <th className="px-4 py-2.5 text-right">In Queue</th>
                    <th className="w-48 px-4 py-2.5 text-left">Share of Steps</th>
                    <th className="px-5 py-2.5 text-right">Avg Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bucketStats.map((bucket) => {
                    const share = percentOf(bucket.completedTasks, bucketStepTotal)
                    return (
                      <tr key={bucket.bucketName} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{bucket.bucketName}</p>
                          <p className="text-xs text-slate-500">
                            {(bucket.roles || []).map((role) => ROLE_LABELS[role] || formatLabel(role)).join(', ') || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatNumber(bucket.userCount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatNumber(bucket.completedTasks)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${toNumber(bucket.pendingTasks) > 0 ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                          {formatNumber(bucket.pendingTasks)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={share} tone="emerald" className="h-1.5" />
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-600">{formatPercent(share)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700">{formatMinutes(bucket.avgCompletionTime)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No bucket data available." />
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <RankingPanel
            title="Most Productive"
            subtitle="By points earned"
            icon={FiAward}
            iconClass="text-amber-500"
            items={productivityRanking}
            metric={(item) => `${formatNumber(item.totalPoints)} pts`}
            emptyLabel="No productivity data yet."
          />
          <RankingPanel
            title="Fastest Closers"
            subtitle="Shortest average time a case waits with them"
            icon={FiTrendingUp}
            iconClass="text-emerald-600"
            items={fastestClosers}
            metric={(item) => formatMinutes(item.avgCompletionTime)}
            countLabel="steps handled"
            emptyLabel="No closure-time data yet."
          />
          <RankingPanel
            title="Slowest Closers"
            subtitle="Longest average time a case waits with them"
            icon={FiTrendingDown}
            iconClass="text-rose-600"
            items={slowestClosers}
            metric={(item) => formatMinutes(item.avgCompletionTime)}
            countLabel="steps handled"
            emptyLabel="No slow closers outside the fastest list."
          />
        </div>
      </div>
    </div>
  )
}

export default Analytics
