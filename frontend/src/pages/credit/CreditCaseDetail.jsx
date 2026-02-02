import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCaseById } from '../../store/slices/caseSlice'
import { creditService } from '../../services/creditService'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../utils/format'
import { FiFileText, FiCheck } from 'react-icons/fi'

const CreditCaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { currentCase, isLoading } = useSelector((state) => state.cases)
  
  const [sanctionData, setSanctionData] = useState({
    sanctionAmount: '',
    tenure: '',
    interestRate: '',
    conditions: '',
  })
  
  const [remarks, setRemarks] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById(id))
    }
  }, [id, dispatch])

  useEffect(() => {
    if (currentCase) {
      setSanctionData({
        sanctionAmount: currentCase.sanctionAmount || '',
        tenure: currentCase.tenure || '',
        interestRate: currentCase.interestRate || '',
        conditions: currentCase.conditions || '',
      })
      setRemarks(currentCase.creditRemarks || '')
    }
  }, [currentCase])

  const handleSaveSanction = async () => {
    setIsSubmitting(true)
    try {
      const sanctionPayload = {
        customerId: id,
        sanctionAmount: parseFloat(sanctionData.sanctionAmount),
        tenure: parseInt(sanctionData.tenure),
        interestRate: parseFloat(sanctionData.interestRate),
        conditions: sanctionData.conditions,
        creditRemarks: remarks,
      }
      
      await creditService.createSanction(sanctionPayload)
      alert('Sanction created and submitted for approval successfully')
      navigate('/credit/dashboard')
    } catch (error) {
      alert('Failed to save: ' + (error.message || error))
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Uploaded Documents</h2>
            {currentCase.documents && currentCase.documents.length > 0 ? (
              <div className="space-y-2">
                {currentCase.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FiFileText className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.fileName}</p>
                        <p className="text-xs text-gray-500">{doc.documentType}</p>
                      </div>
                    </div>
                    {doc.verified && (
                      <span className="badge bg-green-100 text-green-800">Verified</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No documents uploaded</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Verification Checklist</h2>
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>PAN verified</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>Aadhaar verified</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>Electricity bill verified</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" className="rounded" />
                <span>KYC documents verified</span>
              </label>
            </div>
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
            <div className="space-y-4">
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

