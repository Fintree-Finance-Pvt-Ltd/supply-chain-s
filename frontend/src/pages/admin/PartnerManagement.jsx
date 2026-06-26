import { useEffect, useMemo, useState } from 'react'
import { FiCheck, FiEdit2, FiPlus, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import LoadingSpinner from '../../components/LoadingSpinner'
import { partnerService } from '../../services/partnerService'

const PARTNER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
}

const initialFormData = {
  name: '',
  code: '',
  lanPrefix: '',
  status: PARTNER_STATUS.ACTIVE,
}

const normalizeUppercase = (value) => value.trim().toUpperCase()

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const PartnerManagement = () => {
  const [partners, setPartners] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingPartnerId, setUpdatingPartnerId] = useState(null)
  const [editingPartner, setEditingPartner] = useState(null)
  const [formData, setFormData] = useState(initialFormData)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const loadPartners = async () => {
    try {
      setIsLoading(true)
      const response = await partnerService.getAllPartners()
      setPartners(Array.isArray(response?.partners) ? response.partners : [])
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to fetch partners'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPartners()
  }, [])

  const activeCount = partners.filter((partner) => partner.status === PARTNER_STATUS.ACTIVE).length
  const inactiveCount = partners.filter((partner) => partner.status === PARTNER_STATUS.INACTIVE).length

  const filteredPartners = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return partners.filter((partner) => {
      const matchesStatus = statusFilter === 'ALL' || partner.status === statusFilter
      const matchesSearch =
        !query ||
        [partner.name, partner.code, partner.lanPrefix]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))

      return matchesStatus && matchesSearch
    })
  }, [partners, searchTerm, statusFilter])

  const handleFieldChange = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: field === 'code' || field === 'lanPrefix' ? value.toUpperCase() : value,
    }))
  }

  const resetForm = () => {
    setEditingPartner(null)
    setFormData(initialFormData)
  }

  const handleEdit = (partner) => {
    setEditingPartner(partner)
    setFormData({
      name: partner.name || '',
      code: partner.code || '',
      lanPrefix: partner.lanPrefix || '',
      status: partner.status || PARTNER_STATUS.ACTIVE,
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const payload = {
      name: formData.name.trim(),
      code: normalizeUppercase(formData.code),
      lanPrefix: normalizeUppercase(formData.lanPrefix),
      status: formData.status,
    }

    if (!payload.name || !payload.code || !payload.lanPrefix) {
      toast.error('Name, code, and LAN prefix are required')
      return
    }

    try {
      setIsSaving(true)

      if (editingPartner) {
        await partnerService.updatePartner(editingPartner.id, {
          name: payload.name,
          lanPrefix: payload.lanPrefix,
          status: payload.status,
        })
        toast.success('Partner updated successfully')
      } else {
        await partnerService.createPartner(payload)
        toast.success('Partner created successfully')
      }

      resetForm()
      await loadPartners()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save partner'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (partner) => {
    const nextStatus =
      partner.status === PARTNER_STATUS.ACTIVE ? PARTNER_STATUS.INACTIVE : PARTNER_STATUS.ACTIVE

    try {
      setUpdatingPartnerId(partner.id)
      await partnerService.updatePartner(partner.id, { status: nextStatus })
      toast.success(`Partner marked ${nextStatus.toLowerCase()}`)
      await loadPartners()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update partner access'))
    } finally {
      setUpdatingPartnerId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Partner Management</h1>
          <p className="text-gray-600 mt-2">Add lending partners and control active access.</p>
        </div>
        <button
          type="button"
          onClick={loadPartners}
          disabled={isLoading}
          className="btn-secondary"
        >
          <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-600">Total Partners</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{partners.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Active Access</p>
          <p className="mt-1 text-3xl font-bold text-green-700">{activeCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Inactive Access</p>
          <p className="mt-1 text-3xl font-bold text-red-700">{inactiveCount}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{editingPartner ? 'Edit Partner' : 'Add Partner'}</h2>
          <p className="card-subtitle">Partner records are saved in the partners table.</p>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Partner Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              className="input-field"
              placeholder="Fintree Finance"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(event) => handleFieldChange('code', event.target.value)}
              className="input-field"
              placeholder="FFPL"
              disabled={Boolean(editingPartner)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LAN Prefix</label>
            <input
              type="text"
              value={formData.lanPrefix}
              onChange={(event) => handleFieldChange('lanPrefix', event.target.value)}
              className="input-field"
              placeholder="FFPL"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Access</label>
            <select
              value={formData.status}
              onChange={(event) => handleFieldChange('status', event.target.value)}
              className="input-field"
            >
              <option value={PARTNER_STATUS.ACTIVE}>Active</option>
              <option value={PARTNER_STATUS.INACTIVE}>Inactive</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 lg:col-span-5 sm:flex-row sm:justify-end">
            {editingPartner && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            )}
            <button type="submit" disabled={isSaving} className="btn-primary">
              <FiPlus className="h-4 w-4" />
              {isSaving ? 'Saving...' : editingPartner ? 'Save Partner' : 'Add Partner'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="card-title">Partners</h2>
            <p className="card-subtitle">Inactive partners are hidden from active lender selections.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <FiSearch className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-field pl-9 sm:w-64"
                placeholder="Search partners"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input-field sm:w-44"
            >
              <option value="ALL">All access</option>
              <option value={PARTNER_STATUS.ACTIVE}>Active</option>
              <option value={PARTNER_STATUS.INACTIVE}>Inactive</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="table-container mt-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="table-header">
                <tr>
                  <th>Partner</th>
                  <th>Code</th>
                  <th>LAN Prefix</th>
                  <th>Access</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-sm text-gray-500">
                      No partners found
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner) => {
                    const isActive = partner.status === PARTNER_STATUS.ACTIVE
                    const isUpdating = updatingPartnerId === partner.id

                    return (
                      <tr key={partner.id} className="table-row">
                        <td className="font-medium text-gray-900">{partner.name}</td>
                        <td>{partner.code}</td>
                        <td>{partner.lanPrefix}</td>
                        <td>
                          <span className={isActive ? 'status-active' : 'status-inactive'}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{formatDate(partner.createdAt)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(partner)}
                              className="action-button action-button-primary"
                              title="Edit partner"
                              aria-label="Edit partner"
                            >
                              <FiEdit2 className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(partner)}
                              disabled={isUpdating}
                              className={
                                isActive
                                  ? 'action-button action-button-danger'
                                  : 'action-button action-button-success'
                              }
                              title={isActive ? 'Inactivate partner access' : 'Activate partner access'}
                              aria-label={isActive ? 'Inactivate partner access' : 'Activate partner access'}
                            >
                              {isUpdating ? (
                                <FiRefreshCw className="h-5 w-5 animate-spin" />
                              ) : isActive ? (
                                <FiX className="h-5 w-5" />
                              ) : (
                                <FiCheck className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default PartnerManagement
