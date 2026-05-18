import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  FiActivity,
  FiAward,
  FiBarChart2,
  FiCheckCircle,
  FiDollarSign,
  FiFileText,
  FiLayers,
  FiPieChart,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
  FiTruck,
  FiUsers,
} from 'react-icons/fi'
import api from '../../services/api'

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
  if (!value) return 'N/A'
  if (value >= 1440) return `${Math.round(value / 1440)}d`
  if (value >= 60) return `${Math.round(value / 60)}h`
  return `${Math.round(value)}m`
}

const formatLabel = (value) =>
  value
    ? value
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Unknown'

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(toNumber(value))))

const toneClasses = {
  blue: {
    icon: 'bg-blue-50 text-blue-700 ring-blue-100',
    value: 'text-blue-700',
    bar: 'bg-blue-600',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    value: 'text-emerald-700',
    bar: 'bg-emerald-600',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 ring-amber-100',
    value: 'text-amber-700',
    bar: 'bg-amber-500',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-700 ring-rose-100',
    value: 'text-rose-700',
    bar: 'bg-rose-600',
  },
  indigo: {
    icon: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    value: 'text-indigo-700',
    bar: 'bg-indigo-600',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700 ring-slate-200',
    value: 'text-slate-900',
    bar: 'bg-slate-700',
  },
}

const MetricCard = ({ title, value, caption, icon: Icon, tone = 'slate' }) => {
  const classes = toneClasses[tone] || toneClasses.slate

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`mt-2 break-words text-2xl font-bold ${classes.value}`}>{value}</p>
          <p className="mt-2 text-sm text-slate-500">{caption}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${classes.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

const ProgressBar = ({ value, tone = 'blue' }) => {
  const classes = toneClasses[tone] || toneClasses.blue
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${classes.bar}`} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  )
}

const EmptyState = ({ label }) => (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
    {label}
  </div>
)

const StatusPanel = ({ title, icon: Icon, items = [], tone = 'blue', showAmount = false }) => {
  const total = items.reduce((sum, item) => sum + toNumber(item.count), 0)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{formatNumber(total)} total records</p>
        </div>
        <Icon className={`h-5 w-5 ${toneClasses[tone]?.value || 'text-slate-700'}`} />
      </div>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.slice(0, 6).map((item) => {
            const percent = total > 0 ? (item.count / total) * 100 : 0
            return (
              <div key={item.status}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-semibold text-slate-800">{item.label || formatLabel(item.status)}</span>
                  <span className="shrink-0 font-bold text-slate-950">
                    {showAmount && item.amount ? formatCurrency(item.amount) : formatNumber(item.count)}
                  </span>
                </div>
                <ProgressBar value={percent} tone={tone} />
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState label="No status data available." />
      )}
    </div>
  )
}

const RankingPanel = ({ title, icon: Icon, items = [], metric, tone = 'blue', emptyLabel }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">Top {Math.min(items.length, 5)} users</p>
      </div>
      <Icon className={`h-5 w-5 ${toneClasses[tone]?.value || 'text-slate-700'}`} />
    </div>

    {items.length > 0 ? (
      <div className="space-y-3">
        {items.slice(0, 5).map((item, index) => (
          <div key={`${item.userId}-${index}`} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${toneClasses[tone]?.icon || toneClasses.slate.icon}`}>
                {item.rank || index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{item.userName}</p>
                <p className="text-xs text-slate-500">{formatNumber(item.tasksCompleted)} tasks</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-bold text-slate-950">{metric(item)}</span>
          </div>
        ))}
      </div>
    ) : (
      <EmptyState label={emptyLabel || 'No ranking data available.'} />
    )}
  </div>
)

const MonthlyTrend = ({ data = [] }) => {
  const maxAmount = Math.max(...data.map((item) => toNumber(item.invoiceAmount)), 1)
  const maxCount = Math.max(...data.map((item) => toNumber(item.customers) + toNumber(item.suppliers) + toNumber(item.invoices)), 1)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Monthly Origination Trend</h2>
          <p className="text-sm text-slate-500">New customers, suppliers, invoices, and booked invoice value.</p>
        </div>
        <FiBarChart2 className="h-5 w-5 text-blue-700" />
      </div>

      {data.length > 0 ? (
        <div className="flex h-64 items-end gap-3 overflow-x-auto pb-2">
          {data.map((item) => {
            const amountHeight = Math.max(6, (toNumber(item.invoiceAmount) / maxAmount) * 100)
            const count = toNumber(item.customers) + toNumber(item.suppliers) + toNumber(item.invoices)
            const countHeight = Math.max(6, (count / maxCount) * 100)

            return (
              <div key={item.period} className="flex min-w-[72px] flex-1 flex-col items-center gap-2">
                <div className="flex h-44 w-full items-end justify-center gap-2 rounded-lg bg-slate-50 px-2 py-2">
                  <div className="w-4 rounded-t-md bg-blue-600" style={{ height: `${amountHeight}%` }} title={formatCurrency(item.invoiceAmount, false)} />
                  <div className="w-4 rounded-t-md bg-emerald-500" style={{ height: `${countHeight}%` }} title={`${formatNumber(count)} records`} />
                </div>
                <p className="text-xs font-semibold text-slate-700">{item.label}</p>
                <p className="text-center text-xs text-slate-500">{formatCurrency(item.invoiceAmount)}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState label="No monthly trend data available." />
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          Invoice value
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Record count
        </span>
      </div>
    </div>
  )
}

const Analytics = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [timeRange, setTimeRange] = useState('30')

  const fetchAnalytics = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      const response = await api.get(`/superadmin/dashboard?days=${timeRange}`)
      if (response.data.success) {
        setAnalytics(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to fetch analytics data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const overview = analytics?.overview || {}
  const business = analytics?.businessOverview || {}
  const financial = analytics?.financialSnapshot || {}
  const period = analytics?.periodActivity || {}
  const statusBreakdowns = analytics?.statusBreakdowns || {}
  const monthlyTrend = analytics?.monthlyTrend || []
  const roleDistribution = analytics?.roleDistribution || []
  const bucketStats = analytics?.bucketStats || []
  const l1l2 = analytics?.l1L2Comparison || {}
  const partnerSanctions = analytics?.partnerSanctionStats || []

  const roleTotal = useMemo(
    () => roleDistribution.reduce((sum, role) => sum + toNumber(role.userCount), 0),
    [roleDistribution]
  )
  const taskClosureRate = useMemo(() => {
    const completed = toNumber(overview.completedTasks)
    const active = toNumber(overview.activeTasks)
    const pending = toNumber(overview.pendingTasks)
    const total = completed + active + pending
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }, [overview])
  const stageMaxTime = Math.max(toNumber(l1l2.l1Stats?.avgTime), toNumber(l1l2.l2Stats?.avgTime), 1)
  const partnerSanctionTotal = useMemo(
    () => partnerSanctions.reduce((sum, partner) => sum + toNumber(partner.sanctionCount), 0),
    [partnerSanctions]
  )
  const activePartnerAccounts = useMemo(
    () => partnerSanctions.reduce((sum, partner) => sum + toNumber(partner.activeAccounts), 0),
    [partnerSanctions]
  )
  const topPartnerSanctionAmount = useMemo(
    () => Math.max(...partnerSanctions.map((partner) => toNumber(partner.sanctionedAmount)), 1),
    [partnerSanctions]
  )

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f8fb]">
        <div className="rounded-lg border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading analytics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-2 py-2 sm:px-0">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <FiPieChart className="h-3.5 w-3.5 text-blue-600" />
            Analytics
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Supply Chain Analytics</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Compare operating flow, exposure, status mix, and user performance across the finance lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { value: '7', label: '7D' },
              { value: '30', label: '30D' },
              { value: '90', label: '90D' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeRange(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  timeRange === option.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => fetchAnalytics({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={`New Customers (${period.days || timeRange}D)`}
          value={formatNumber(period.newCustomers)}
          caption={`${formatNumber(business.totalCustomers)} customers all time`}
          icon={FiUsers}
          tone="blue"
        />
        <MetricCard
          title={`New Suppliers (${period.days || timeRange}D)`}
          value={formatNumber(period.newSuppliers)}
          caption={`${formatNumber(business.activeSuppliers)} active supplier cases`}
          icon={FiTruck}
          tone="emerald"
        />
        <MetricCard
          title={`Invoice Value (${period.days || timeRange}D)`}
          value={formatCurrency(period.invoiceAmount)}
          caption={`${formatNumber(period.newInvoices)} new invoices`}
          icon={FiFileText}
          tone="indigo"
        />
        <MetricCard
          title="Utilization"
          value={`${clampPercent(financial.utilizationRate)}%`}
          caption={`${formatCurrency(financial.utilizedLimit)} of ${formatCurrency(financial.sanctionedBook)}`}
          icon={FiDollarSign}
          tone="amber"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Sanction Book Analytics</h2>
              <p className="text-sm text-slate-500">Approved sanctions, loan accounts, and available exposure.</p>
            </div>
            <FiDollarSign className="h-5 w-5 text-amber-700" />
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-600">Limit utilization</span>
                <span className="font-bold text-slate-950">{clampPercent(financial.utilizationRate)}%</span>
              </div>
              <ProgressBar value={financial.utilizationRate} tone="amber" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border-l-2 border-amber-500 pl-3">
                <p className="text-slate-500">Sanctioned book</p>
                <p className="mt-1 font-bold text-slate-950">{formatCurrency(financial.sanctionedBook)}</p>
              </div>
              <div className="border-l-2 border-emerald-500 pl-3">
                <p className="text-slate-500">Utilized limit</p>
                <p className="mt-1 font-bold text-slate-950">{formatCurrency(financial.utilizedLimit)}</p>
              </div>
              <div className="border-l-2 border-blue-500 pl-3">
                <p className="text-slate-500">Loan account sanctions</p>
                <p className="mt-1 font-bold text-slate-950">{formatNumber(partnerSanctionTotal || financial.loanAccounts)}</p>
              </div>
              <div className="border-l-2 border-rose-500 pl-3">
                <p className="text-slate-500">Unutilized limit</p>
                <p className="mt-1 font-bold text-slate-950">{formatCurrency(financial.unutilizedLimit)}</p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Approved</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(financial.approvedSanctionCount)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Partners</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(partnerSanctions.length)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Active LANs</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(activePartnerAccounts)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Partner Sanction Mix</h2>
              <p className="text-sm text-slate-500">Sanctions created in loan accounts by partner.</p>
            </div>
            <FiBarChart2 className="h-5 w-5 text-blue-700" />
          </div>

          {partnerSanctions.length > 0 ? (
            <div className="space-y-4">
              {partnerSanctions.slice(0, 8).map((partner, index) => {
                const share = (toNumber(partner.sanctionedAmount) / topPartnerSanctionAmount) * 100
                return (
                  <div key={`${partner.partnerCode}-${index}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{partner.partnerName}</p>
                        <p className="text-xs text-slate-500">
                          {formatNumber(partner.sanctionCount)} sanctions, {formatNumber(partner.activeAccounts)} active accounts
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-slate-950">{formatCurrency(partner.sanctionedAmount)}</p>
                        <p className="text-xs text-slate-500">{clampPercent(partner.utilizationRate)}% utilized</p>
                      </div>
                    </div>
                    <ProgressBar value={share} tone={index % 2 === 0 ? 'blue' : 'amber'} />
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState label="No partner sanction analytics available." />
          )}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <MonthlyTrend data={monthlyTrend} />

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Operating Rhythm</h2>
              <p className="text-sm text-slate-500">Task velocity and exception load.</p>
            </div>
            <FiActivity className="h-5 w-5 text-emerald-700" />
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Task closure ratio</span>
                <span className="font-bold text-slate-950">{taskClosureRate}%</span>
              </div>
              <ProgressBar value={taskClosureRate} tone="emerald" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border-l-2 border-blue-500 pl-3">
                <p className="text-slate-500">Active tasks</p>
                <p className="mt-1 font-bold text-slate-950">{formatNumber(overview.activeTasks)}</p>
              </div>
              <div className="border-l-2 border-amber-500 pl-3">
                <p className="text-slate-500">Pending tasks</p>
                <p className="mt-1 font-bold text-slate-950">{formatNumber(overview.pendingTasks)}</p>
              </div>
              <div className="border-l-2 border-emerald-500 pl-3">
                <p className="text-slate-500">Completed</p>
                <p className="mt-1 font-bold text-slate-950">{formatNumber(overview.completedTasks)}</p>
              </div>
              <div className="border-l-2 border-rose-500 pl-3">
                <p className="text-slate-500">Overdue</p>
                <p className="mt-1 font-bold text-slate-950">{formatNumber(overview.overdueTasks)}</p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">L1 vs L2 average time</p>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600">L1 Processing</span>
                    <span className="font-bold text-slate-950">{formatMinutes(l1l2.l1Stats?.avgTime)}</span>
                  </div>
                  <ProgressBar value={(toNumber(l1l2.l1Stats?.avgTime) / stageMaxTime) * 100} tone="blue" />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600">L2 Processing</span>
                    <span className="font-bold text-slate-950">{formatMinutes(l1l2.l2Stats?.avgTime)}</span>
                  </div>
                  <ProgressBar value={(toNumber(l1l2.l2Stats?.avgTime) / stageMaxTime) * 100} tone="indigo" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <StatusPanel
          title="Customer Status Mix"
          icon={FiUsers}
          items={statusBreakdowns.customers || []}
          tone="blue"
        />
        <StatusPanel
          title="Supplier Status Mix"
          icon={FiTruck}
          items={statusBreakdowns.suppliers || []}
          tone="emerald"
        />
        <StatusPanel
          title="Invoice Status Mix"
          icon={FiFileText}
          items={statusBreakdowns.invoices || []}
          tone="indigo"
          showAmount
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Role Distribution</h2>
              <p className="text-sm text-slate-500">{formatNumber(roleTotal)} mapped active user roles.</p>
            </div>
            <FiLayers className="h-5 w-5 text-blue-700" />
          </div>

          {roleDistribution.length > 0 ? (
            <div className="space-y-4">
              {roleDistribution.slice(0, 8).map((role, index) => {
                const percent = roleTotal > 0 ? (role.userCount / roleTotal) * 100 : 0
                return (
                  <div key={`${role.roleName}-${index}`}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-slate-800">{formatLabel(role.roleName)}</span>
                      <span className="shrink-0 font-bold text-slate-950">{formatNumber(role.userCount)}</span>
                    </div>
                    <ProgressBar value={percent} tone={index % 2 === 0 ? 'blue' : 'emerald'} />
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState label="No role distribution available." />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Bucket Analytics</h2>
              <p className="text-sm text-slate-500">Task completion, pending queue, and average closure time.</p>
            </div>
            <FiCheckCircle className="h-5 w-5 text-emerald-700" />
          </div>

          {bucketStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead className="text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="pb-3">Bucket</th>
                    <th className="pb-3 text-right">Total</th>
                    <th className="pb-3 text-right">Pending</th>
                    <th className="pb-3 text-right">Avg Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bucketStats.slice(0, 7).map((bucket) => (
                    <tr key={bucket.bucketName}>
                      <td className="py-3">
                        <p className="font-semibold text-slate-900">{formatLabel(bucket.bucketName)}</p>
                        <p className="text-xs text-slate-500">{formatNumber(bucket.completedTasks)} completed</p>
                      </td>
                      <td className="py-3 text-right text-sm font-semibold text-slate-900">{formatNumber(bucket.totalTasks)}</td>
                      <td className="py-3 text-right text-sm text-slate-600">{formatNumber(bucket.pendingTasks)}</td>
                      <td className="py-3 text-right text-sm text-slate-600">{formatMinutes(bucket.avgCompletionTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No bucket analytics available." />
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <RankingPanel
          title="Fastest Closers"
          icon={FiTrendingUp}
          items={analytics?.fastestClosers || []}
          metric={(item) => formatMinutes(item.avgCompletionTime)}
          tone="emerald"
          emptyLabel="No completion-time ranking available."
        />
        <RankingPanel
          title="Productivity Ranking"
          icon={FiAward}
          items={analytics?.productivityRanking || []}
          metric={(item) => `${formatNumber(item.totalPoints)} pts`}
          tone="blue"
          emptyLabel="No productivity ranking available."
        />
        <RankingPanel
          title="Needs Coaching"
          icon={FiTrendingDown}
          items={analytics?.slowestClosers || []}
          metric={(item) => formatMinutes(item.avgCompletionTime)}
          tone="rose"
          emptyLabel="No slow-closure ranking available."
        />
      </section>
    </div>
  )
}

export default Analytics
