import { useEffect, useMemo, useState } from 'react'
import {
  FiAward,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiTrendingUp,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import { performanceService } from '../../services/performanceService'
import { ROLE_LABELS } from '../../constants/roles'

const STAGE_OPTIONS = [
  { value: '', label: 'All Stages' },
  { value: 'credit_l1', label: 'Credit L1' },
  { value: 'credit_l2', label: 'Credit L2' },
  { value: 'ps_l1', label: 'PS L1' },
  { value: 'ps_l2', label: 'PS L2' },
  { value: 'ops_l1', label: 'Operations L1' },
  { value: 'ops_l2', label: 'Operations L2' },
  { value: 'ops_head', label: 'Operations Head' },
  { value: 'rm', label: 'RM' },
]

const DEFAULT_FILTERS = {
  startDate: '',
  endDate: '',
  stage: '',
  userId: '',
  limit: 20,
  offset: 0,
  sortBy: 'efficiencyScore',
  sortOrder: 'DESC',
}

const getRoleBadgeColor = (role) => {
  const colors = {
    credit_team_l1: 'bg-blue-50 text-blue-700 ring-blue-100',
    credit_team_l2: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    credit_head: 'bg-violet-50 text-violet-700 ring-violet-100',
    operations_team_l1: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    operations_team_l2: 'bg-teal-50 text-teal-700 ring-teal-100',
    operations_head: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    relationship_manager: 'bg-amber-50 text-amber-700 ring-amber-100',
    ceo: 'bg-rose-50 text-rose-700 ring-rose-100',
    md: 'bg-purple-50 text-purple-700 ring-purple-100',
  }
  return colors[role] || 'bg-slate-100 text-slate-700 ring-slate-200'
}

const getScoreColor = (score = 0) => {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (score >= 60) return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (score >= 40) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-rose-50 text-rose-700 ring-rose-200'
}

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0))

const formatTime = (minutes) => {
  const value = Number(minutes || 0)
  if (!value) return 'N/A'
  if (value < 60) return `${Math.round(value)}m`
  const hours = Math.floor(value / 60)
  const mins = Math.round(value % 60)
  if (hours < 24) return `${hours}h ${mins}m`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return `${days}d ${remainingHours}h`
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

const getCompletionRate = (completed, total) => {
  if (!total) return 0
  return Math.round((completed / total) * 100)
}

const TOP_PERFORMER_ROLES = new Set([
  'operations_team_l1',
  'operations_team_l2',
  'operations_head',
  'credit_team_l1',
  'credit_team_l2',
  'credit_head',
])

const TOP_PERFORMER_EXCLUDED_ROLES = new Set([
  'relationship_manager',
  'ceo',
  'md',
  'admin',
  'superadmin',
])

const isRelationshipManager = (user) =>
  (user?.roles || [user?.primaryRole]).includes('relationship_manager')

const isCreditOpsPerformer = (user) => {
  const roles = user?.roles || [user?.primaryRole].filter(Boolean)
  return roles.some((role) => TOP_PERFORMER_ROLES.has(role)) &&
    !roles.some((role) => TOP_PERFORMER_EXCLUDED_ROLES.has(role)) &&
    Number(user?.totalRewards || user?.totalPoints || 0) > 0
}

const MetricCard = ({ title, value, caption, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{caption}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${tones[tone] || tones.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

const ProgressBar = ({ value }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
)

const UserPerformance = () => {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [userList, setUserList] = useState([])
  const [total, setTotal] = useState(0)
  const [users, setUsers] = useState([])
  const [userDetail, setUserDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)

  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  useEffect(() => {
    loadSummary()
    loadUsers()
  }, [])

  useEffect(() => {
    loadUserList()
  }, [filters])

  const loadSummary = async () => {
    try {
      const data = await performanceService.getSummary()
      setSummary(data)
    } catch (error) {
      console.error('Failed to load summary:', error)
    }
  }

  const loadUsers = async () => {
    try {
      const data = await performanceService.getUsers()
      setUsers(data)
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const loadUserList = async () => {
    setLoading(true)
    try {
      const params = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        stage: filters.stage || undefined,
        userId: filters.userId || undefined,
        limit: filters.limit,
        offset: filters.offset,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }
      const data = await performanceService.getUserList(params)
      setUserList(data.data || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Failed to load user list:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshPage = async () => {
    setRefreshing(true)
    await Promise.all([loadSummary(), loadUsers(), loadUserList()])
    setRefreshing(false)
  }

  const loadUserDetail = async (userId) => {
    setDetailLoading(true)
    setShowDetail(true)
    try {
      const params = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        stage: filters.stage || undefined,
      }
      const data = await performanceService.getUserDetail(userId, params)
      setUserDetail(data)
    } catch (error) {
      console.error('Failed to load user detail:', error)
      setUserDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  const applyFilters = (nextFilters) => {
    setFilters({ ...nextFilters, offset: 0 })
  }

  const activeFilterCount = useMemo(
    () => ['startDate', 'endDate', 'stage', 'userId'].filter((key) => filters[key]).length,
    [filters]
  )
  const summaryTopPerformers = useMemo(
    () => (summary?.topPerformers || []).filter(isCreditOpsPerformer),
    [summary]
  )

  const pageStart = total === 0 ? 0 : filters.offset + 1
  const pageEnd = Math.min(filters.offset + filters.limit, total)

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-2 py-2 sm:px-0">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <FiTrendingUp className="h-3.5 w-3.5 text-blue-600" />
            Super Admin
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">User Performance Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Track every active operations, credit, management, and RM user, including team members with no assigned timing rows yet.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshPage}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Performance Users"
          value={formatNumber(summary?.totalUsersTracked)}
          caption={`${formatNumber(total)} users match current filters`}
          icon={FiUsers}
          tone="blue"
        />
        <MetricCard
          title="Completed Cases"
          value={formatNumber(summary?.totalCompletedCases)}
          caption="Completed workflow cases in database"
          icon={FiCheckCircle}
          tone="emerald"
        />
        <MetricCard
          title="Rewards Distributed"
          value={formatNumber(summary?.totalRewardsDistributed)}
          caption="Total reward points awarded"
          icon={FiAward}
          tone="amber"
        />
        <MetricCard
          title="Avg Completion Time"
          value={formatTime(summary?.avgCompletionTime)}
          caption="Average time for completed workflow cases"
          icon={FiClock}
          tone="indigo"
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Top Performers</h2>
              <p className="text-sm text-slate-500">Credit, ops, and non-RM users by calculated efficiency score.</p>
            </div>
            <FiStar className="h-5 w-5 text-amber-500" />
          </div>
          {summaryTopPerformers.length ? (
            <div className="space-y-3">
              {summaryTopPerformers.map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.userName}</p>
                      <p className="text-xs text-slate-500">
                        {formatNumber(user.completedCases)} completed, {formatNumber(user.totalRewards)} pts
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getScoreColor(user.efficiencyScore)}`}>
                      {Number(user.efficiencyScore || 0).toFixed(1)}
                    </span>
                    {isRelationshipManager(user) && Number(user.rmPoints || 0) > 0 && (
                      <p className="mt-1 text-xs font-semibold text-amber-600">{formatNumber(user.rmPoints)} RM pts</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No ranking data available.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Performance Overview</h2>
            <p className="text-sm text-slate-500">
              {formatNumber(total)} users found. Showing {formatNumber(pageStart)} to {formatNumber(pageEnd)}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilterModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <FiFilter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-blue-700">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {filters.sortOrder === 'DESC' ? 'Highest first' : 'Lowest first'}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="mt-3 text-sm font-medium text-slate-600">Loading performance users</p>
          </div>
        ) : userList.length === 0 ? (
          <div className="p-10 text-center">
            <FiSearch className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">No users match these filters</p>
            <p className="mt-1 text-sm text-slate-500">Clear filters to return to the full performance roster.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3 text-right">Workload</th>
                  <th className="px-5 py-3 text-right">Rewards</th>
                  <th className="px-5 py-3 text-right">RM Points</th>
                  <th className="px-5 py-3 text-right">Avg Time</th>
                  <th className="px-5 py-3">Completion</th>
                  <th className="px-5 py-3 text-center">Score</th>
                  <th className="px-5 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userList.map((user) => {
                  const completionRate = getCompletionRate(user.completedCases, user.totalCases)

                  return (
                    <tr key={user.userId} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">{user.userName}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex max-w-[220px] flex-wrap gap-1.5">
                          {(user.roles?.length ? user.roles : [user.primaryRole]).slice(0, 3).map((role) => (
                            <span key={role} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getRoleBadgeColor(role)}`}>
                              {ROLE_LABELS[role] || formatLabel(role)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="font-bold text-slate-950">{formatNumber(user.completedCases)} / {formatNumber(user.totalCases)}</p>
                        <p className="text-xs text-slate-500">{formatNumber(user.pendingCases)} pending</p>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-amber-600">{formatNumber(user.totalRewards)}</td>
                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        {isRelationshipManager(user) ? formatNumber(user.rmPoints) : '-'}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-slate-700">{formatTime(user.avgCompletionTime)}</td>
                      <td className="px-5 py-4">
                        <div className="min-w-[130px]">
                          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                            <span>{completionRate}%</span>
                            <span>{formatNumber(user.inProgressCases)} active</span>
                          </div>
                          <ProgressBar value={completionRate} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center rounded-lg px-3 py-1 text-sm font-bold ring-1 ${getScoreColor(user.efficiencyScore)}`}>
                          {Number(user.efficiencyScore || 0).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => loadUserDetail(user.userId)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                        >
                          <FiEye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > filters.limit && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Showing {formatNumber(pageStart)} to {formatNumber(pageEnd)} of {formatNumber(total)} users
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={filters.offset === 0}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={filters.offset + filters.limit >= total}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {showDetail && (
        <UserDetailDrawer
          user={userDetail}
          loading={detailLoading}
          onClose={() => {
            setShowDetail(false)
            setUserDetail(null)
          }}
        />
      )}

      {showFilterModal && (
        <FilterModal
          filters={filters}
          users={users}
          activeFilterCount={activeFilterCount}
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
  )
}

const FilterModal = ({ filters, users, activeFilterCount, onApply, onClear, onClose }) => {
  const [draftFilters, setDraftFilters] = useState(filters)

  const updateDraft = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applyDraft = () => {
    onApply(draftFilters)
    onClose()
  }

  const clearDraft = () => {
    onClear()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 mt-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
              <FiFilter className="h-3.5 w-3.5" />
              {activeFilterCount ? `${activeFilterCount} active` : 'No active filters'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
            <input
              type="date"
              value={draftFilters.startDate}
              onChange={(event) => updateDraft('startDate', event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
            <input
              type="date"
              value={draftFilters.endDate}
              onChange={(event) => updateDraft('endDate', event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Stage</label>
            <select
              value={draftFilters.stage}
              onChange={(event) => updateDraft('stage', event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">User</label>
            <select
              value={draftFilters.userId}
              onChange={(event) => updateDraft('userId', event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sort By</label>
            <select
              value={draftFilters.sortBy}
              onChange={(event) => updateDraft('sortBy', event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="efficiencyScore">Score</option>
              <option value="completedCases">Completed</option>
              <option value="totalCases">Total Cases</option>
              <option value="totalRewards">Rewards</option>
              <option value="avgCompletionTime">Avg Time</option>
              <option value="userName">Name</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Order</label>
            <select
              value={draftFilters.sortOrder}
              onChange={(event) => updateDraft('sortOrder', event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="DESC">Highest first</option>
              <option value="ASC">Lowest first</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={clearDraft}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FiX className="h-4 w-4" />
            Clear Filters
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyDraft}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const UserDetailDrawer = ({ user, loading, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">User Detail</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{user?.userName || 'Loading'}</h2>
            <p className="text-sm text-slate-500">{user?.email || ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          </div>
        ) : !user ? (
          <div className="p-10 text-center text-slate-500">Unable to load user detail.</div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-700">Overall Performance Score</p>
                  <p className="mt-1 text-4xl font-bold text-blue-950">{Number(user.efficiencyScore || 0).toFixed(1)}</p>
                </div>
                <div className={`flex h-16 w-16 items-center justify-center rounded-full ring-1 ${getScoreColor(user.efficiencyScore)}`}>
                  <FiBarChart2 className="h-7 w-7" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <MetricLite label="Total Cases" value={formatNumber(user.totalCases)} />
              <MetricLite label="Completed" value={formatNumber(user.completedCases)} tone="text-emerald-700" />
              <MetricLite label="Pending" value={formatNumber(user.pendingCases)} tone="text-amber-700" />
              <MetricLite label="Rewards" value={formatNumber(user.totalRewards)} tone="text-amber-700" />
              <MetricLite label="RM Points" value={isRelationshipManager(user) ? formatNumber(user.rmPoints) : '-'} tone="text-blue-700" />
            </div>

            <div>
              <h3 className="mb-3 font-bold text-slate-950">Roles</h3>
              <div className="flex flex-wrap gap-2">
                {(user.roles || []).map((role) => (
                  <span key={role} className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${getRoleBadgeColor(role)}`}>
                    {ROLE_LABELS[role] || formatLabel(role)}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">Average Completion Time</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{formatTime(user.avgCompletionTime)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">Total Time Spent</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{formatTime(user.totalCompletionTime)}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-bold text-slate-950">Stage Performance</h3>
              {user.stagePerformance?.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {user.stagePerformance.map((stage) => (
                    <div key={stage.stage} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-950">{stage.stageLabel || formatLabel(stage.stage)}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                          {formatNumber(stage.completedCases)} done
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <MetricMini label="Assigned" value={formatNumber(stage.totalAssigned)} />
                        <MetricMini label="Pending" value={formatNumber(stage.pendingCases)} />
                        <MetricMini label="Avg Time" value={formatTime(stage.avgCompletionTime)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No stage activity found for the current filters.
                </div>
              )}
            </div>

            {user.recentCases?.length > 0 && (
              <div>
                <h3 className="mb-3 font-bold text-slate-950">Recent Completed Cases</h3>
                <div className="space-y-2">
                  {user.recentCases.map((task) => (
                    <div key={`${task.taskId}-${task.bucket}`} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{task.taskId}</p>
                        <p className="text-sm text-slate-500">{formatLabel(task.taskType)} / {formatLabel(task.bucket)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-950">{formatTime(task.completionTimeMinutes)}</p>
                        <p className="text-xs font-semibold text-amber-600">+{formatNumber(task.rewardsEarned)} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const MetricLite = ({ label, value, tone = 'text-slate-950' }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 text-center">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
  </div>
)

const MetricMini = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
  </div>
)

export default UserPerformance
