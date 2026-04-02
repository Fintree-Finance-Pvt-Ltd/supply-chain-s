import { useState, useEffect } from 'react'
import { operationsService } from '../../services/operationsService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { toast } from 'react-toastify'
import { formatDate } from '../../utils/format'

const RepaymentUpload = () => {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' or 'history'
  const [isLoading, setIsLoading] = useState(false)
  const [historyData, setHistoryData] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  // Dropdown data
  const [partners, setPartners] = useState([])
  const [lans, setLans] = useState([])
  const [isLoadingPartners, setIsLoadingPartners] = useState(false)
  const [isLoadingLans, setIsLoadingLans] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    partnerId: '',
    partnerName: '',
    lan: '',
    collectionDate: '',
    collectionUtr: '',
    collectionAmount: ''
  })

  // Load partners on mount
  useEffect(() => {
    loadPartners()
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, filterStatus])

  // Load LANs when partner changes
  useEffect(() => {
    if (formData.partnerId) {
      // Get LANs by partner ID
      loadLans(parseInt(formData.partnerId))
    } else {
      setLans([])
    }
  }, [formData.partnerId])

  const loadPartners = async () => {
    try {
      setIsLoadingPartners(true)
      const response = await operationsService.getLenders()
      setPartners(response.data || [])
    } catch (error) {
      console.error('Error loading partners:', error)
    } finally {
      setIsLoadingPartners(false)
    }
  }

  const loadLans = async (partnerId) => {
    try {
      setIsLoadingLans(true)
      const response = await operationsService.getLansByLender(partnerId)
      setLans(response.data || [])
    } catch (error) {
      console.error('Error loading LANs:', error)
      toast.error('Failed to load LANs')
    } finally {
      setIsLoadingLans(false)
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
    
    if (name === 'partnerId') {
      const selectedPartner = partners.find(p => p.id === parseInt(value))
      setFormData(prev => ({
        ...prev,
        partnerId: value,
        partnerName: selectedPartner ? selectedPartner.name : '',
        lan: '' // Reset LAN when partner changes
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleUpload = async () => {
    // Validate current form
    if (!formData.partnerId || !formData.lan || !formData.collectionDate || !formData.collectionUtr || !formData.collectionAmount) {
      toast.error('Please fill all fields')
      return
    }

    const amount = parseFloat(formData.collectionAmount)
    if (amount <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    const repaymentData = [{
      lan: formData.lan,
      collection_date: formData.collectionDate,
      collection_utr: formData.collectionUtr,
      collection_amount: amount
    }]

    try {
      setIsUploading(true)
      const response = await operationsService.uploadRepayments(repaymentData)
      
      if (response.success) {
        toast.success('Repayment uploaded successfully')
        setFormData({
          partnerId: '',
          partnerName: '',
          lan: '',
          collectionDate: '',
          collectionUtr: '',
          collectionAmount: ''
        })
        setLans([])
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
      render: (value) => value ? `₹${parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'
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
          
          {/* Step 1: Select Partner and LAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name <span className="text-red-500">*</span></label>
              <select
                name="partnerId"
                value={formData.partnerId}
                onChange={handleInputChange}
                disabled={isLoadingPartners}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Partner</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {isLoadingPartners && <span className="text-xs text-gray-500">Loading...</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LAN <span className="text-red-500">*</span></label>
              <select
                name="lan"
                value={formData.lan}
                onChange={handleInputChange}
                disabled={!formData.partnerId || isLoadingLans}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select LAN</option>
                {lans.map(l => (
                  <option key={l.lanId} value={l.lanId}>{l.lanId}</option>
                ))}
              </select>
              {isLoadingLans && <span className="text-xs text-gray-500">Loading...</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collection Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="collectionDate"
                value={formData.collectionDate}
                onChange={handleInputChange}
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