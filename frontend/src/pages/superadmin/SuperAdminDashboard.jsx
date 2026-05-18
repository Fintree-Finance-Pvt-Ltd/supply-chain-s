import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  FiActivity,
  FiAlertCircle,
  FiArrowUpRight,
  FiBarChart2,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiFolder,
  FiPackage,
  FiRefreshCw,
  FiShield,
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

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(toNumber(value))))

const formatStatus = (value) =>
  value
    ? value
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : 'Unknown'

const formatDateTime = (value) => {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return '-'
  }
}

const toneClasses = {
  blue: {
    icon: 'bg-blue-50 text-blue-700 ring-blue-100',
    value: 'text-blue-700',
    bar: 'bg-blue-600',
    dot: 'bg-blue-500',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    value: 'text-emerald-700',
    bar: 'bg-emerald-600',
    dot: 'bg-emerald-500',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 ring-amber-100',
    value: 'text-amber-700',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-700 ring-rose-100',
    value: 'text-rose-700',
    bar: 'bg-rose-600',
    dot: 'bg-rose-500',
  },
  indigo: {
    icon: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    value: 'text-indigo-700',
    bar: 'bg-indigo-600',
    dot: 'bg-indigo-500',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700 ring-slate-200',
    value: 'text-slate-900',
    bar: 'bg-slate-700',
    dot: 'bg-slate-500',
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

const MiniMetric = ({ label, value, helper }) => (
  <div className="px-4 py-3">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className="mt-1 text-xl font-bold text-slate-950">{value}</p>
    <p className="mt-1 text-sm text-slate-500">{helper}</p>
  </div>
)

const ProgressBar = ({ value, tone = 'blue' }) => {
  const classes = toneClasses[tone] || toneClasses.blue
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${classes.bar}`} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  )
}

const StatusPill = ({ status, completed, rejected }) => {
  const className = completed
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : rejected
    ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200'

  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      <span className="truncate">{formatStatus(status)}</span>
    </span>
  )
}

const EmptyState = ({ label }) => (
  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
    {label}
  </div>
)

const SuperAdminDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [analytics, setAnalytics] = useState(null)

  const loadDashboard = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)

      const response = await api.get('/superadmin/dashboard')
      if (response.data.success) {
        setAnalytics(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching super admin dashboard:', error)
      toast.error('Failed to fetch super admin dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const overview = analytics?.overview || {}
  const business = analytics?.businessOverview || {}
  const financial = analytics?.financialSnapshot || {}
  const pipeline = analytics?.workflowPipeline || []
  const recentCases = analytics?.recentCases || []
  const bucketStats = analytics?.bucketStats || []
  const topPerformers = analytics?.topPerformers || []
  const partnerSanctions = analytics?.partnerSanctionStats || []

  const operatingCompletionRate = useMemo(() => {
    const completed = toNumber(business.completedWorkflows)
    const rejected = toNumber(business.rejectedWorkflows)
    const active = toNumber(business.activeWorkflows)
    const total = completed + rejected + active
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }, [business])

  const partnerSanctionTotal = useMemo(
    () => partnerSanctions.reduce((sum, partner) => sum + toNumber(partner.sanctionCount), 0),
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
          <p className="mt-4 text-sm font-medium text-slate-600">Loading command center</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-2 py-2 sm:px-0">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <FiShield className="h-3.5 w-3.5 text-blue-600" />
            Super Admin
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/superadmin/analytics"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FiBarChart2 className="h-4 w-4" />
            Analytics
          </Link>
          <Link
            to="/superadmin/cases"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FiFolder className="h-4 w-4" />
            All Cases
          </Link>
          <button
            type="button"
            onClick={() => loadDashboard({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <MiniMetric
            label="Workflow health"
            value={`${operatingCompletionRate}%`}
            helper={`${formatNumber(business.activeWorkflows)} active, ${formatNumber(business.completedWorkflows)} completed`}
          />
          <MiniMetric
            label="Task queue"
            value={formatNumber(overview.pendingTasks)}
            helper={`${formatNumber(overview.activeTasks)} in progress, ${formatNumber(overview.overdueTasks)} overdue`}
          />
          <MiniMetric
            label="Limit utilization"
            value={`${clampPercent(financial.utilizationRate)}%`}
            helper={`${formatCurrency(financial.utilizedLimit)} utilized`}
          />
          <MiniMetric
            label="Avg completion"
            value={formatMinutes(overview.averageCompletionTime)}
            helper={`${formatNumber(overview.completedTasks)} tracked tasks closed`}
          />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Customers"
          value={formatNumber(business.totalCustomers)}
          caption={`${formatNumber(business.kycVerifiedCustomers)} KYC verified`}
          icon={FiUsers}
          tone="blue"
        />
        <MetricCard
          title="Suppliers"
          value={formatNumber(business.totalSuppliers)}
          caption={`${formatNumber(business.activeSuppliers)} in active onboarding`}
          icon={FiTruck}
          tone="emerald"
        />
        <MetricCard
          title="Invoice Book"
          value={formatCurrency(financial.totalInvoiceAmount)}
          caption={`${formatNumber(business.activeInvoices)} invoices in motion`}
          icon={FiFileText}
          tone="indigo"
        />
        <MetricCard
          title="Sanctioned Book"
          value={formatCurrency(financial.sanctionedBook)}
          caption={`${formatNumber(financial.loanAccounts)} active loan accounts`}
          icon={FiDollarSign}
          tone="amber"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Workflow Pipeline</h2>
              <p className="text-sm text-slate-500">Customer, supplier, and invoice cases by operational stage.</p>
            </div>
            <FiActivity className="h-5 w-5 text-blue-600" />
          </div>

          {pipeline.length > 0 ? (
            <div className="space-y-5">
              {pipeline.map((item, index) => (
                <div key={item.workflowType || index}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">
                        {formatNumber(item.active)} active, {formatNumber(item.completed)} completed, {formatNumber(item.rejected)} rejected
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {formatNumber(item.total)} total
                    </span>
                  </div>
                  <ProgressBar value={item.completionRate} tone={index === 0 ? 'blue' : index === 1 ? 'emerald' : 'amber'} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No workflow data available yet." />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Financial Exposure</h2>
              <p className="text-sm text-slate-500">Limit, disbursement, and outstanding invoice view.</p>
            </div>
            <FiTrendingUp className="h-5 w-5 text-emerald-600" />
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Utilized limit</span>
                <span className="font-bold text-slate-950">{clampPercent(financial.utilizationRate)}%</span>
              </div>
              <ProgressBar value={financial.utilizationRate} tone="emerald" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border-l-2 border-emerald-500 pl-3">
                <p className="text-slate-500">Disbursed</p>
                <p className="mt-1 font-bold text-slate-950">{formatCurrency(financial.disbursedInvoiceAmount)}</p>
              </div>
              <div className="border-l-2 border-amber-500 pl-3">
                <p className="text-slate-500">Outstanding</p>
                <p className="mt-1 font-bold text-slate-950">{formatCurrency(financial.outstandingInvoiceAmount)}</p>
              </div>
              <div className="border-l-2 border-blue-500 pl-3">
                <p className="text-slate-500">Approved sanctions</p>
                <p className="mt-1 font-bold text-slate-950">{formatNumber(financial.approvedSanctionCount)}</p>
              </div>
              <div className="border-l-2 border-rose-500 pl-3">
                <p className="text-slate-500">Avg invoice</p>
                <p className="mt-1 font-bold text-slate-950">{formatCurrency(financial.averageInvoiceAmount)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Partner Sanction Allocation</h2>
            <p className="text-sm text-slate-500">Loan accounts created from the sanction book by financing partner.</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-100 lg:self-auto">
            <FiDollarSign className="h-4 w-4" />
            {formatNumber(partnerSanctionTotal)} sanctions
          </div>
        </div>

        {partnerSanctions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Partner</th>
                  <th className="px-5 py-3 text-center">Sanctions</th>
                  <th className="px-5 py-3 text-right">Sanctioned</th>
                  <th className="px-5 py-3 text-right">Disbursed</th>
                  <th className="px-5 py-3">Book Share</th>
                  <th className="px-5 py-3 text-right">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partnerSanctions.map((partner, index) => (
                  <tr key={`${partner.partnerCode}-${index}`} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                          {partner.partnerCode || 'NA'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{partner.partnerName}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(partner.lastCreatedAt)} last created</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-10 justify-center rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                        {formatNumber(partner.sanctionCount)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-slate-950">
                      {formatCurrency(partner.sanctionedAmount)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-slate-700">
                      {formatCurrency(partner.disbursedAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <ProgressBar value={(toNumber(partner.sanctionedAmount) / topPartnerSanctionAmount) * 100} tone={index % 2 === 0 ? 'amber' : 'blue'} />
                        <span className="w-10 text-right text-xs font-semibold text-slate-500">
                          {clampPercent((toNumber(partner.sanctionedAmount) / topPartnerSanctionAmount) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-sm font-bold text-slate-950">{clampPercent(partner.utilizationRate)}%</p>
                      <p className="text-xs text-slate-500">{formatCurrency(partner.utilizedLimit)} used</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState label="No partner sanction data available yet." />
          </div>
        )}
      </section>



      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Top Performers</h2>
              <p className="text-sm text-slate-500">Reward points and closed task output.</p>
            </div>
            <FiCheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          {topPerformers.length > 0 ? (
            <div className="space-y-3">
              {topPerformers.slice(0, 5).map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.userName}</p>
                      <p className="text-xs text-slate-500">{formatNumber(user.tasksCompleted)} tasks closed</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-950">{formatNumber(user.totalPoints)} pts</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No performer data available." />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Bucket Performance</h2>
              <p className="text-sm text-slate-500">Completion rate by task bucket.</p>
            </div>
            <FiPackage className="h-5 w-5 text-amber-600" />
          </div>
          {bucketStats.length > 0 ? (
            <div className="space-y-4">
              {bucketStats.slice(0, 5).map((bucket, index) => {
                const completionRate = bucket.totalTasks > 0 ? (bucket.completedTasks / bucket.totalTasks) * 100 : 0
                return (
                  <div key={bucket.bucketName || index}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{formatStatus(bucket.bucketName)}</span>
                      <span className="text-xs font-semibold text-slate-500">{formatNumber(bucket.totalTasks)} tasks</span>
                    </div>
                    <ProgressBar value={completionRate} tone={index % 2 === 0 ? 'amber' : 'indigo'} />
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState label="No bucket data available." />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Execution Signals</h2>
              <p className="text-sm text-slate-500">Task timing and risk markers.</p>
            </div>
            <FiClock className="h-5 w-5 text-rose-600" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <FiBriefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatNumber(overview.completedTasks)} completed tasks</p>
                <p className="text-xs text-slate-500">Across all tracked team workflows</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <FiActivity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatNumber(overview.activeTasks)} active tasks</p>
                <p className="text-xs text-slate-500">{formatNumber(overview.pendingTasks)} waiting in queue</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                <FiAlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatNumber(overview.overdueTasks)} overdue tasks</p>
                <p className="text-xs text-slate-500">Needs supervisory attention</p>
              </div>
            </div>
          </div>
        </div>
      </section>
            <section className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Recent Case Movement</h2>
            <p className="text-sm text-slate-500">Latest customer, supplier, and invoice workflow updates.</p>
          </div>
          <Link to="/superadmin/cases" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">
            View all cases
            <FiArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {recentCases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Case</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Assigned</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="max-w-[220px] truncate font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500">{formatStatus(item.workflowType)}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{item.reference}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatStatus(item.assignedStage)}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{item.assignedTo || 'Unassigned'}</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                      {item.amount ? formatCurrency(item.amount, false) : '-'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{formatDateTime(item.updatedAt)}</td>
                    <td className="px-5 py-4">
                      <StatusPill status={item.status} completed={item.isCompleted} rejected={item.isRejected} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState label="No recent workflow movement found." />
          </div>
        )}
      </section>
    </div>
  )
}

export default SuperAdminDashboard
