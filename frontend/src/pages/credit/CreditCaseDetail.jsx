import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCaseById } from '../../store/slices/caseSlice'
import { creditService } from '../../services/creditService'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../utils/format'
import { FiFileText, FiCheck, FiX, FiDownload, FiUpload } from 'react-icons/fi'
import { workflowService } from '../../services/workflowService'

const CreditCaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { currentCase, isLoading } = useSelector((state) => state.cases)

  const [sanctionData, setSanctionData] = useState({
    sanctionAmount: '',
    tenure: '',
    interestRate: '',
    conditions: '',
  })

  const [remarks, setRemarks] = useState('')
  const [docRemarks, setDocRemarks] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById(id))
    }
  }, [id, dispatch])

  useEffect(() => {
    if (currentCase) {
      setSanctionData({
        sanctionAmount: currentCase.creditSanctions?.[0]?.sanctionAmount || '',
        tenure: currentCase.creditSanctions?.[0]?.tenure || '',
        interestRate: currentCase.creditSanctions?.[0]?.interestRate || '',
        conditions: currentCase.creditSanctions?.[0]?.conditions || '',
      })
      setRemarks(currentCase.creditSanctions?.[0]?.creditRemarks || '')
    }
  }, [currentCase])

  const handleVerifyDocument = async (docId, status) => {
    const remark = docRemarks[docId] || ''
    if (!remark.trim()) {
      alert('Please add remarks for verification')
      return
    }
    try {
      await workflowService.verifyDocument(docId, status, remark)
      alert('Document status updated')
      dispatch(fetchCaseById(id))
    } catch (error) {
      alert('Verification failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleSaveSanction = async () => {
    if (!remarks.trim()) {
      alert('Please add remarks')
      return
    }

    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()

      if (userRole === 'credit_team_l2') {
        const sanctionPayload = {
          customerId: id,
          sanctionAmount: parseFloat(sanctionData.sanctionAmount),
          tenure: parseInt(sanctionData.tenure),
          interestRate: parseFloat(sanctionData.interestRate),
          conditions: sanctionData.conditions,
          creditRemarks: remarks,
        }

        // Save sanction details
        await creditService.createSanction(sanctionPayload)
        // Advance workflow to CEO
        await workflowService.approveCreditL2(id, true, remarks)
      } else {
        // Credit L1 only approves
        await workflowService.approveCreditL1(id, true, remarks)
      }

      alert('Approval processed successfully')
      navigate('/credit/dashboard')
    } catch (error) {
      alert('Failed: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!currentCase) {
    return <div>Case not found</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/credit/dashboard')}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Case Details</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-medium">{currentCase.name || currentCase.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mobile Number</p>
                <p className="font-medium">{currentCase.mobile || currentCase.mobileNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">PAN Number</p>
                <p className="font-medium">{currentCase.pan || currentCase.panNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Aadhaar Number</p>
                <p className="font-medium">{currentCase.aadhaar || currentCase.aadhaarNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Electricity Bill</p>
                <p className="font-medium">{currentCase.electricityBillNo || currentCase.electricityBillNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">RM Name</p>
                <p className="font-medium">{currentCase.rm?.name || currentCase.rmName || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Uploaded Documents</h2>
              {(user?.role === 'credit_team_l1') && (
                <DocumentUploader
                  customerId={id}
                  onUploadSuccess={() => dispatch(fetchCaseById(id))}
                />
              )}
            </div>
            {currentCase.documents && currentCase.documents.length > 0 ? (
              <div className="space-y-4">
                {currentCase.documents.map((doc) => (
                  <div key={doc.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <FiFileText className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
                          <p className="text-xs text-gray-500 uppercase">{doc.documentType}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL}/documents/download/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                          title="Download"
                        >
                          <FiDownload className="h-4 w-4" />
                        </a>
                        {doc.status === 'approved' ? (
                          <span className="badge bg-green-100 text-green-800">Approved</span>
                        ) : doc.status === 'rejected' ? (
                          <span className="badge bg-red-100 text-red-800">Rejected</span>
                        ) : (
                          <span className="badge bg-yellow-100 text-yellow-800">Pending</span>
                        )}
                      </div>
                    </div>

                    {(user?.role === 'credit_team_l1' || user?.role === 'credit_team_l2') && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          placeholder="Verification remarks..."
                          value={docRemarks[doc.id] || doc.remarks || ''}
                          onChange={(e) => setDocRemarks({ ...docRemarks, [doc.id]: e.target.value })}
                          className="w-full text-xs input-field"
                          rows={1}
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleVerifyDocument(doc.id, 'approved')}
                            className="flex-1 py-1 px-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center space-x-1"
                          >
                            <FiCheck className="h-3 w-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                            className="flex-1 py-1 px-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center space-x-1"
                          >
                            <FiX className="h-3 w-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {doc.remarks && (user?.role !== 'credit_team_l1' && user?.role !== 'credit_team_l2') && (
                      <p className="text-xs text-gray-600 mt-2 italic px-2 py-1 bg-white rounded border border-gray-100">
                        Remarks: {doc.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No documents uploaded</p>
            )}
          </div>


          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Internal Remarks</h2>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="input-field"
              rows={4}
              placeholder="Enter internal remarks..."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Limit</h2>
            <div className={`space-y-4 ${user?.role === 'credit_team_l1' ? 'opacity-70 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sanction Amount (₹)
                </label>
                <input
                  type="number"
                  value={sanctionData.sanctionAmount}
                  onChange={(e) => setSanctionData({ ...sanctionData, sanctionAmount: e.target.value })}
                  className="input-field"
                  placeholder="Enter amount"
                  disabled={user?.role === 'credit_team_l1'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenure (months)
                </label>
                <input
                  type="number"
                  value={sanctionData.tenure}
                  onChange={(e) => setSanctionData({ ...sanctionData, tenure: e.target.value })}
                  className="input-field"
                  placeholder="Enter tenure"
                  disabled={user?.role === 'credit_team_l1'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sanctionData.interestRate}
                  onChange={(e) => setSanctionData({ ...sanctionData, interestRate: e.target.value })}
                  className="input-field"
                  placeholder="Enter interest rate"
                  disabled={user?.role === 'credit_team_l1'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Conditions
                </label>
                <textarea
                  value={sanctionData.conditions}
                  onChange={(e) => setSanctionData({ ...sanctionData, conditions: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Enter conditions..."
                  disabled={user?.role === 'credit_team_l1'}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveSanction}
            disabled={isSubmitting}
            className="w-full btn-primary flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <FiCheck className="h-5 w-5" />
                <span>Save & Submit for Approval</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreditCaseDetail

