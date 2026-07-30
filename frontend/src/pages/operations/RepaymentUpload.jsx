import { useEffect, useMemo, useState } from 'react'
import AsyncSelect from 'react-select/async'
import Select from 'react-select'
import { operationsService } from '../../services/operationsService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { toast } from 'react-toastify'
import { formatDate } from '../../utils/format'

const getCustomerDisplayName = (customer) =>
  customer?.companyName ||
  customer?.customerName ||
  customer?.customerCode ||
  (customer?.customerId ? `Customer #${customer.customerId}` : 'Selected company')

const getLoanAccounts = (customer) =>
  Array.isArray(customer?.loanAccounts) ? customer.loanAccounts : []

const buildCompanyOption = (customer) => ({
  value: customer.customerId,
  label: getCustomerDisplayName(customer),
  customer
})

const buildLanOption = (loanAccount, customer) => ({
  value: loanAccount.lanId,
  label: loanAccount.lanId,
  loanAccount,
  customer
})

const formatAmount = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'N/A'

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

const MONTH_NAMES = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
}

const formatDateParts = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return ''

  const date = new Date(year, month - 1, day)
  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day

  if (!isValidDate) return ''

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-')
}

const normalizeCollectionDate = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const yearFirstMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (yearFirstMatch) {
    return formatDateParts(
      Number(yearFirstMatch[1]),
      Number(yearFirstMatch[2]),
      Number(yearFirstMatch[3])
    )
  }

  const dayFirstMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (dayFirstMatch) {
    return formatDateParts(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]),
      Number(dayFirstMatch[1])
    )
  }

  const compactMatch = raw.match(/^(\d{8})$/)
  if (compactMatch) {
    const digits = compactMatch[1]
    const startsWithYear = Number(digits.slice(0, 4)) >= 1900
    return startsWithYear
      ? formatDateParts(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)))
      : formatDateParts(Number(digits.slice(4, 8)), Number(digits.slice(2, 4)), Number(digits.slice(0, 2)))
  }

  const dayMonthNameMatch = raw.match(/^(\d{1,2})[\s-]+([a-zA-Z]{3,9})[\s,-]+(\d{4})$/)
  if (dayMonthNameMatch) {
    return formatDateParts(
      Number(dayMonthNameMatch[3]),
      MONTH_NAMES[dayMonthNameMatch[2].toLowerCase()],
      Number(dayMonthNameMatch[1])
    )
  }

  const monthNameDayMatch = raw.match(/^([a-zA-Z]{3,9})[\s-]+(\d{1,2}),?[\s-]+(\d{4})$/)
  if (monthNameDayMatch) {
    return formatDateParts(
      Number(monthNameDayMatch[3]),
      MONTH_NAMES[monthNameDayMatch[1].toLowerCase()],
      Number(monthNameDayMatch[2])
    )
  }

  return ''
}

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#3b82f6' : '#9ca3af'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 12px'
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af'
  })
}

const formatCompanyOptionLabel = ({ customer, label }, { context }) => {
  if (context === 'value') return label

  const loanCount = getLoanAccounts(customer).length
  return (
    <div>
      <div className="font-medium text-gray-900">{label}</div>
      <div className="text-xs text-gray-500">
        {customer?.customerCode || `Customer #${customer?.customerId || '-'}`} - {loanCount} LAN{loanCount === 1 ? '' : 's'}
      </div>
    </div>
  )
}

const formatLanOptionLabel = ({ loanAccount, customer, label }, { context }) => {
  if (context === 'value') return label

  return (
    <div>
      <div className="font-medium text-gray-900">{label}</div>
      <div className="text-xs text-gray-500">
        {[getCustomerDisplayName(customer), loanAccount?.status].filter(Boolean).join(' - ')}
      </div>
    </div>
  )
}

const RepaymentUpload = () => {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' or 'history'
  const [isLoading, setIsLoading] = useState(false)
  const [historyData, setHistoryData] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [selectedLan, setSelectedLan] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    companyName: '',
    lan: '',
    collectionDate: '',
    collectionUtr: '',
    collectionAmount: ''
  })

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, filterStatus])

  const lanOptions = useMemo(() => {
    return getLoanAccounts(selectedCompany?.customer).map((loanAccount) =>
      buildLanOption(loanAccount, selectedCompany.customer)
    )
  }, [selectedCompany])

  const loadCompanyOptions = async (inputValue) => {
    const search = inputValue.trim()
    if (search.length < 2) return []

    try {
      const response = await operationsService.searchLoanCustomers({
        companyName: search,
        limit: 20
      })
      return (response.data || []).map(buildCompanyOption)
    } catch (error) {
      console.error('Error loading companies:', error)
      toast.error('Failed to search companies')
      return []
    }
  }

  const loadHistory = async () => {
    try {
      setIsLoading(true)
      const filters = {}
      if (filterStatus) filters.status = filterStatus
      const response = await operationsService.getRepaymentUploads(filters)
      setHistoryData(response.data || [])
      setHistoryTotal(response.total || 0)
    } catch (error) {
      console.error('Error loading history:', error)
      toast.error('Failed to load repayment history')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCollectionDateBlur = () => {
    const normalizedDate = normalizeCollectionDate(formData.collectionDate)
    if (!normalizedDate) return

    setFormData(prev => ({
      ...prev,
      collectionDate: normalizedDate
    }))
  }

  const handleCompanyChange = (option) => {
    const customer = option?.customer || null
    const nextLoanAccounts = getLoanAccounts(customer)
    const nextLan = nextLoanAccounts.length === 1
      ? buildLanOption(nextLoanAccounts[0], customer)
      : null

    setSelectedCompany(option || null)
    setSelectedLan(nextLan)
    setFormData(prev => ({
      ...prev,
      customerId: customer?.customerId || '',
      companyName: customer ? getCustomerDisplayName(customer) : '',
      lan: nextLan?.value || ''
    }))
  }

  const handleLanChange = (option) => {
    setSelectedLan(option || null)
    setFormData(prev => ({
      ...prev,
      lan: option?.value || ''
    }))
  }

  const handleUpload = async () => {
    // Validate current form
    if (!formData.companyName || !formData.lan || !formData.collectionDate || !formData.collectionUtr || !formData.collectionAmount) {
      toast.error('Please fill all fields')
      return
    }

    const amount = parseFloat(formData.collectionAmount)
    if (amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    const normalizedCollectionDate = normalizeCollectionDate(formData.collectionDate)
    if (!normalizedCollectionDate) {
      toast.error('Collection Date must be a valid date in DD-MM-YYYY format')
      return
    }

    const repaymentData = [{
      lan: formData.lan,
      collection_date: normalizedCollectionDate,
      collection_utr: formData.collectionUtr,
      collection_amount: amount
    }]

    try {
      setIsUploading(true)
      const response = await operationsService.uploadRepayments(repaymentData)
      
      if (response.success) {
        toast.success('Repayment uploaded successfully')
        setFormData({
          customerId: '',
          companyName: '',
          lan: '',
          collectionDate: '',
          collectionUtr: '',
          collectionAmount: ''
        })
        setSelectedCompany(null)
        setSelectedLan(null)
        setActiveTab('history')
        loadHistory()
      } else {
        // Show error details
        const errors = response.data?.filter(r => r.status === 'FAILED') || []
        if (errors.length > 0) {
          errors.forEach(err => {
            toast.error(`${err.lan}: ${err.errorMessage}`)
          })
        } else {
          toast.error(response.message || 'Upload failed')
        }
      }
    } catch (error) {
      console.error('Error uploading repayments:', error)
      toast.error(error.message || 'Failed to upload repayments')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRetry = async (id) => {
    try {
      const response = await operationsService.retryRepaymentUpload(id)
      if (response.success) {
        toast.success('Retry successful')
        loadHistory()
      } else {
        toast.error(response.message || 'Retry failed')
      }
    } catch (error) {
      console.error('Error retrying repayment:', error)
      toast.error(error.message || 'Failed to retry')
    }
  }

  const historyColumns = [
    {
      key: 'lan',
      label: 'LAN',
      render: (value) => value || 'N/A'
    },
    {
      key: 'collectionDate',
      label: 'Collection Date',
      render: (value) => value ? formatDate(value) : 'N/A'
    },
    {
      key: 'collectionUtr',
      label: 'UTR'
    },
    {
      key: 'collectionAmount',
      label: 'Amount',
      render: (value) => formatAmount(value)
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <StatusBadge 
          status={value} 
          label={value === 'UPLOADED' ? 'Uploaded' : value === 'FAILED' ? 'Failed' : 'Pending'} 
          variant={value === 'UPLOADED' ? 'success' : value === 'FAILED' ? 'danger' : 'warning'}
        />
      )
    },
    {
      key: 'errorMessage',
      label: 'Error',
      render: (value) => value || '-'
    },
    {
      key: 'retryCount',
      label: 'Retries',
      render: (value) => value || 0
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        row.status === 'FAILED' && (
          <button
            onClick={() => handleRetry(row.id)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        )
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Repayment Upload</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 font-medium ${activeTab === 'upload' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Repayments
        </button>
        <button
          className={`px-6 py-3 font-medium ${activeTab === 'history' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('history')}
        >
          Upload History
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="card space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Add Repayment Details</h2>
          
          {/* Step 1: Select Company and LAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-500">*</span></label>
              <AsyncSelect
                cacheOptions
                isClearable
                value={selectedCompany}
                loadOptions={loadCompanyOptions}
                onChange={handleCompanyChange}
                formatOptionLabel={formatCompanyOptionLabel}
                placeholder="Search company name"
                noOptionsMessage={({ inputValue }) =>
                  inputValue.trim().length < 2 ? 'Type at least 2 characters' : 'No companies found'
                }
                styles={selectStyles}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LAN <span className="text-red-500">*</span></label>
              <Select
                isClearable
                isSearchable
                value={selectedLan}
                options={lanOptions}
                onChange={handleLanChange}
                formatOptionLabel={formatLanOptionLabel}
                placeholder={selectedCompany ? 'Search or select LAN' : 'Select company first'}
                noOptionsMessage={() => selectedCompany ? 'No LANs found' : 'Select company first'}
                isDisabled={!selectedCompany}
                styles={selectStyles}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collection Date (DD-MM-YYYY) <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="collectionDate"
                value={formData.collectionDate}
                onChange={handleInputChange}
                onBlur={handleCollectionDateBlur}
                placeholder="DD-MM-YYYY"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collection UTR <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="collectionUtr"
                value={formData.collectionUtr}
                onChange={handleInputChange}
                placeholder="e.g., PsssPrrso111"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collection Amount <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="collectionAmount"
                value={formData.collectionAmount}
                onChange={handleInputChange}
                placeholder="e.g., 9542246.575"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 w-full disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
               {isUploading ? 'Uploading...' : 'Upload Utr'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="card space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Upload History</h2>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-600">Filter by Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="UPLOADED">Uploaded</option>
                <option value="FAILED">Failed</option>
              </select>
              <button
                onClick={loadHistory}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Refresh
              </button>
            </div>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <p className="text-sm text-gray-600">Total Records: {historyTotal}</p>
              <DataTable
                data={historyData}
                columns={historyColumns}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default RepaymentUpload
