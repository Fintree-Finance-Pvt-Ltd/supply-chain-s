import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { FiCalendar, FiRefreshCw } from 'react-icons/fi'
import { caseManagementService } from '../../services/caseManagementService'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'
import { ROLES } from '../../constants/roles'

const toDateInput = (date) => date.toISOString().slice(0, 10)

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const eventTone = (type) => (
  type === 'SANCTION_EXPIRY'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-emerald-100 text-emerald-800'
)

const formatDate = (value) => (
  value ? new Date(value).toLocaleDateString('en-IN') : '-'
)

const CaseCalendar = () => {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [relationshipManagers, setRelationshipManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingRms, setLoadingRms] = useState(false)
  const [filters, setFilters] = useState({
    startDate: toDateInput(new Date()),
    endDate: toDateInput(addDays(new Date(), 120)),
    rmId: '',
  })

  const roles = useMemo(() => (
    [
      ...(user?.roles || []).map((role) => role?.name || role),
      user?.role,
      user?.defaultRole,
    ].filter(Boolean)
  ), [user])

  const canStartRenewal = roles.some((role) => [
    ROLES.OPERATIONS_TEAM_L1,
    ROLES.OPERATIONS_TEAM_L2,
    ROLES.OPERATIONS_HEAD,
    ROLES.MD,
  ].includes(role))
  const isRelationshipManager = roles.includes(ROLES.RELATIONSHIP_MANAGER)
  const currentUserId = user?.id || user?.userId
  const effectiveRmId = isRelationshipManager && currentUserId
    ? String(currentUserId)
    : filters.rmId

  const loadEvents = async () => {
    setLoading(true)
    try {
      const data = await caseManagementService.getCalendarEvents({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        rmId: effectiveRmId || undefined,
      })
      setEvents(data)
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  const loadRelationshipManagers = async () => {
    setLoadingRms(true)
    try {
      const data = await caseManagementService.getCalendarRelationshipManagers()
      setRelationshipManagers(data)
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load RMs')
    } finally {
      setLoadingRms(false)
    }
  }

  useEffect(() => {
    loadRelationshipManagers()
  }, [])

  useEffect(() => {
    loadEvents()
  }, [effectiveRmId])

  const handleStartRenewal = async (event) => {
    try {
      await caseManagementService.startRenewal(event.customerId, 'Renewal initiated from shared calendar')
      toast.success('Renewal sent to RM')
      loadEvents()
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to start renewal')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shared Calendar</h1>
          <p className="mt-1 text-gray-600">Sanction expiries and collection due dates</p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          className="btn-secondary inline-flex items-center justify-center gap-2"
        >
          <FiRefreshCw />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Relationship Manager</label>
            <select
              value={effectiveRmId || ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, rmId: event.target.value }))}
              className="input-field"
              disabled={isRelationshipManager || loadingRms}
            >
              {!isRelationshipManager && <option value="">All RMs</option>}
              {isRelationshipManager && currentUserId && !relationshipManagers.some((rm) => String(rm.id) === String(currentUserId)) && (
                <option value={currentUserId}>
                  {user?.name || user?.email || `RM #${currentUserId}`}
                </option>
              )}
              {relationshipManagers.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.name}{rm.email ? ` - ${rm.email}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={loadEvents} className="btn-primary w-full">
              Apply
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8">
            <LoadingSpinner />
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <FiCalendar className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            No calendar events found for the selected range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">RM</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Lender</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatDate(event.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${eventTone(event.type)}`}>
                        {event.type === 'SANCTION_EXPIRY' ? 'Sanction Expiry' : 'Collection Due'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{event.customerName || 'N/A'}</p>
                      <p className="text-xs text-gray-500">Case #{event.customerId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{event.rmName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{event.lender || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {event.invoiceNumber || `#${event.referenceId}`}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{event.daysUntil}</td>
                    <td className="px-4 py-3 text-right">
                      {event.type === 'SANCTION_EXPIRY' && event.actionAvailable && canStartRenewal ? (
                        <button
                          type="button"
                          onClick={() => handleStartRenewal(event)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Send for Renewal
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default CaseCalendar
