import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { workflowService } from '../../services/workflowService'
import { customerService } from '../../services/customerService'
import { caseManagementService } from '../../services/caseManagementService'
import api from '../../services/api'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import CustomerFullDetails from '../../components/CustomerFullDetails'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'
import { FiCheck, FiX, FiFileText, FiDownload, FiLock, FiEye, FiPauseCircle, FiPlayCircle } from 'react-icons/fi'
import DocumentUploader from '../../components/DocumentUploader'
import { documentService } from '../../services/documentService'

const DETAIL_SECTIONS = [
  'documents',
  'kyc',
  'coApplicants',
  'addresses',
  'contactPersons',
  'history',
  'sanctions',
]

const OperationsCaseScreen = () => {
  const { id } = useParams() // customerId
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)

  const [customer, setCustomer] = useState(null)
  const [verification, setVerification] = useState({
    documentsVerified: false,
    esignVerified: false,
    enachVerified: false,
  })
  const [bankData, setBankData] = useState({
    bankAccountNo: '',
    bankIfscCode: '',
    bankName: '',
    bankBranch: '',
    bankType: 'savings',
  })
  const [remarks, setRemarks] = useState('')
  const [docRemarks, setDocRemarks] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const response = await customerService.getCustomerWithSections(id, DETAIL_SECTIONS)
        if (response.data) {
          setCustomer(response.data)
          // Pre-fill bank data
          setBankData({
            bankAccountNo: response.data.bankAccountNo || '',
            bankIfscCode: response.data.bankIfscCode || '',
            bankName: response.data.bankName || '',
            bankBranch: response.data.bankBranch || '',
            bankType: response.data.bankType || 'savings',
          })
          // Pre-fill if needed, but usually fresh for ops
        }
      } catch (error) {
        console.error('Error loading operations check:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      loadData()
    }
  }, [id])

  const handleVerifyDocument = async (docId, status) => {
    const remark = docRemarks[docId] || ''
    // Remarks made optional
    // if (!remark.trim()) {
    //   alert('Please add remarks for verification')
    //   return
    // }
    try {
      await workflowService.verifyDocument(docId, status, remark)
      toast.success('Document status updated')
      const response = await customerService.getCustomerWithSections(id, DETAIL_SECTIONS)
      setCustomer(response.data)
    } catch (error) {
      toast.error('Verification failed')
    }
  }

  const handleUpdateBankDetails = async () => {
    try {
      await workflowService.updateBankDetails(id, bankData)
      toast.success('Bank details updated successfully')
    } catch (error) {
      toast.error('Failed to update bank details: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleUpload = async (file, type) => {
    try {
      await documentService.uploadDocument(id, file, type)
      toast.success('Document uploaded successfully')

      // Simulate OCR for Cheque
      if (type === 'cheque') {
        toast.info('Simulating OCR: Fetching bank details from cheque...')
        setTimeout(() => {
          setBankData({
            bankAccountNo: '9876543210',
            bankIfscCode: 'ICIC0001234',
            bankName: 'ICICI BANK',
            bankBranch: 'MUMBAI BRANCH',
          })
          toast.success('OCR Successful: Bank details auto-filled')
        }, 1500)
      }

      // Refresh customer data
      const response = await customerService.getCustomerWithSections(id, DETAIL_SECTIONS)
      setCustomer(response.data)
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleApprove = async () => {
    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()
      if (userRole === 'operations_head') {
        await workflowService.approveOpsHead(id, remarks)
      } else {
        await workflowService.approveOpsL1(id, true, remarks)
      }
      toast.success('Operations approval processed successfully')
      navigate('/operations/dashboard')
    } catch (error) {
      toast.error('Failed to update: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.info('Please add rejection reason')
      return
    }

    setIsSubmitting(true)
    try {
      await workflowService.approveOpsL1(id, false, remarks)
      toast.success('Operations check rejected')
      navigate('/operations/dashboard')
    } catch (error) {
      toast.error('Failed to reject: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const refreshCustomer = async () => {
    const response = await customerService.getCustomerWithSections(id, DETAIL_SECTIONS)
    setCustomer(response.data)
  }

  const handleHoldCase = async () => {
    const reason = window.prompt('Reason for putting this case on hold?') || ''
    if (!reason.trim()) return

    setIsSubmitting(true)
    try {
      await caseManagementService.holdCase(id, reason)
      toast.success('Case placed on hold')
      await refreshCustomer()
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to hold case')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResumeCase = async () => {
    const note = window.prompt('Resume remarks?') || ''

    setIsSubmitting(true)
    try {
      await caseManagementService.resumeCase(id, note)
      toast.success('Case resumed')
      await refreshCustomer()
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to resume case')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!customer) {
    return <div>Customer not found</div>
  }

  const formattedApprovals = (customer.statusHistory || []).map(action => ({
    approverName: action.changedByUser?.name || 'Workflow System',
    approverRole: action.changedByUser?.defaultRole?.replace(/_/g, ' ').toUpperCase() || 'System',
    status: action.status,
    approvedAt: action.createdAt,
    comments: action.remarks,
    sanctionAmount: action.sanctionAmount,
    tenure: action.tenure,
    interestRate: action.interestRate,
    penalCharges: action.penalCharges,
    processingFees: action.processingFees,
  }))

  const isReadOnly = (customer.status === 'completed') ||
    (customer.status === 'disbursed') ||
    (customer.status === 'rejected') ||
    (user?.role === 'operations_team_l1' && customer.status !== 'md_approved' && customer.status !== 'ops_l1_review') ||
    (user?.role === 'operations_head' && customer.status !== 'ops_l2_verified' && customer.status !== 'ops_l1_approved');
  const canManageLifecycle = ['operations_team_l1', 'operations_team_l2', 'operations_head'].includes((user?.role || '').toLowerCase())
  const isOnHold = customer.lifecycleStatus === 'on_hold' || customer.status === 'on_hold'

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/operations/dashboard')}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Operations Verification</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CustomerFullDetails customer={customer} />

          {/* Sanction Details (Read Only) */}
          <div className="card border-l-4 border-indigo-500">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Details</h2>
            {customer?.creditSanctions && customer.creditSanctions.length > 0 ? (
              <div className="space-y-4">
                {customer.creditSanctions.map((sanction, index) => (
                  <div key={sanction.id} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-indigo-700">
                        {sanction.partner || `Partner ${index + 1}`}
                      </h3>
                      <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full">
                        {sanction.status || 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="p-2 bg-white rounded">
                        <p className="text-xs text-indigo-600 uppercase font-bold">Sanction Amount</p>
                        <p className="text-lg font-bold">₹{sanction.sanctionAmount}</p>
                      </div>
                      <div className="p-2 bg-white rounded">
                        <p className="text-xs text-indigo-600 uppercase font-bold">Tenure</p>
                        <p className="text-lg font-bold">{sanction.tenure} Months</p>
                      </div>
                      <div className="p-2 bg-white rounded">
                        <p className="text-xs text-indigo-600 uppercase font-bold">Interest Rate</p>
                        <p className="text-lg font-bold">{sanction.interestRate}%</p>
                      </div>
                      <div className="p-2 bg-white rounded">
                        <p className="text-xs text-indigo-600 uppercase font-bold">Penal Charges</p>
                        <p className="text-lg font-bold">{sanction.penalCharges}%</p>
                      </div>
                      <div className="p-2 bg-white rounded">
                        <p className="text-xs text-indigo-600 uppercase font-bold">Processing Fees</p>
                        <p className="text-lg font-bold">{sanction.processingFees}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No sanction details available.</p>
            )}
          </div>

          {/* Post-Sanction Review - Bank Details & OCR */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Post-Sanction Review – Bank Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Bank Account No</label>
                <input
                  type="text"
                  value={bankData.bankAccountNo}
                  onChange={(e) => setBankData({ ...bankData, bankAccountNo: e.target.value })}
                  className="input-field"
                  placeholder="Enter Account No"
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={bankData.bankIfscCode}
                  onChange={(e) => setBankData({ ...bankData, bankIfscCode: e.target.value })}
                  className="input-field"
                  placeholder="Enter IFSC"
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankData.bankName}
                  onChange={(e) => setBankData({ ...bankData, bankName: e.target.value })}
                  className="input-field"
                  placeholder="Enter Bank Name"
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Bank Branch</label>
                <input
                  type="text"
                  value={bankData.bankBranch}
                  onChange={(e) => setBankData({ ...bankData, bankBranch: e.target.value })}
                  className="input-field"
                  placeholder="Enter Branch"
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-bold mb-1">Account Type</label>
                <select
                  value={bankData.bankType}
                  onChange={(e) => setBankData({ ...bankData, bankType: e.target.value })}
                  className="input-field"
                  disabled={isReadOnly}
                >
                  <option value="savings">Savings</option>
                  <option value="current">Current</option>
                  <option value="overdraft">Overdraft</option>
                </select>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700">
              <p className="font-bold flex items-center">
                💡 Tip: Upload a 'Cheque' below to automatically fetch these details via OCR.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Document Verification</h2>
              {(user?.role === 'operations_team_l1' && !isReadOnly) && (
                <DocumentUploader
                  onUpload={handleUpload}
                  documentTypes={[
                    { value: 'live_photo', label: 'Live Photo' },
                    { value: 'shop_photo', label: 'Shop Photo' },
                    { value: 'cheque', label: 'Cheque' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              )}
            </div>
            <div className="space-y-4">
              {customer?.documents?.map(doc => (
                <div key={doc.id} className="p-4 bg-white rounded border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <FiFileText className="text-gray-400" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium">{doc.fileName}</p>
                          {doc.applicantType === 'co-applicant' ? (
                            <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">CO-APP {doc.applicantIndex || ''}</span>
                          ) : (
                            <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">APPLICANT</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 uppercase font-bold">{doc.documentType}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Helper for MIME type */}
                      {(() => {
                        const getMimeType = (fileName) => {
                          const ext = fileName?.toLowerCase().split('.').pop() || '';
                          const mimeTypes = {
                            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                            gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
                            svg: 'image/svg+xml', pdf: 'application/pdf',
                            doc: 'application/msword',
                            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          };
                          return mimeTypes[ext] || 'application/octet-stream';
                        };
                        return (
                          <>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await api.get(`/documents/download/${doc.id}?mode=inline`, {
                                    responseType: 'blob',
                                  });
                                  const blob = new Blob([response.data], { type: getMimeType(doc.fileName) });
                                  const blobUrl = URL.createObjectURL(blob);
                                  window.open(blobUrl, '_blank');
                                } catch (error) {
                                  console.error('Failed to preview document:', error);
                                  toast.error('Failed to preview document');
                                }
                              }}
                              className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                              title="Preview"
                            >
                              <FiEye />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await api.get(`/documents/download/${doc.id}?mode=attachment`, {
                                    responseType: 'blob',
                                  });
                                  const blob = new Blob([response.data], { type: getMimeType(doc.fileName) });
                                  const blobUrl = URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = blobUrl;
                                  link.download = doc.fileName || 'document';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                } catch (error) {
                                  console.error('Failed to download document:', error);
                                  toast.error('Failed to download document');
                                }
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Download"
                            >
                              <FiDownload />
                            </button>
                          </>
                        );
                      })()}
                      {doc.status === 'approved' ? (
                        <span className="badge bg-green-100 text-green-800">Verified</span>
                      ) : doc.status === 'rejected' ? (
                        <span className="badge bg-red-100 text-red-800">Rejected</span>
                      ) : (
                        <span className="badge bg-yellow-100 text-yellow-800 text-[10px]">Pending</span>
                      )}
                    </div>
                  </div>
                  {(user?.role === 'operations_team_l1' && !isReadOnly && doc.status === 'pending') && (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Verification remarks (optional)..."
                        value={docRemarks[doc.id] || doc.remarks || ''}
                        onChange={(e) => setDocRemarks({ ...docRemarks, [doc.id]: e.target.value })}
                        className="w-full text-xs input-field"
                        rows={1}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'approved')}
                          className="py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-bold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                          className="py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Verification Checklist</h2>
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={verification.documentsVerified}
                  onChange={(e) => setVerification({ ...verification, documentsVerified: e.target.checked })}
                  className="rounded"
                  disabled={isReadOnly}
                />
                <span>Documents verified</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={verification.esignVerified}
                  onChange={(e) => setVerification({ ...verification, esignVerified: e.target.checked })}
                  className="rounded"
                  disabled={isReadOnly}
                />
                <span>eSign verified</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={verification.enachVerified}
                  onChange={(e) => setVerification({ ...verification, enachVerified: e.target.checked })}
                  className="rounded"
                  disabled={isReadOnly}
                />
                <span>eNACH verified</span>
              </label>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Operations Remarks</h2>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="input-field"
              rows={4}
              placeholder={isReadOnly ? "Remarks fixed in read-only mode" : "Enter operations remarks..."}
              readOnly={isReadOnly}
            />
          </div>
        </div>

        <div className="space-y-6">
          {formattedApprovals.length > 0 && (
            <div className="card">
              <ApprovalTimeline approvals={formattedApprovals} />
            </div>
          )}

          {canManageLifecycle && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Case Control</h2>
              <div className="space-y-3">
                {isOnHold ? (
                  <button
                    type="button"
                    onClick={handleResumeCase}
                    disabled={isSubmitting}
                    className="w-full btn-primary flex items-center justify-center space-x-2"
                  >
                    <FiPlayCircle className="h-5 w-5" />
                    <span>Resume Case</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleHoldCase}
                    disabled={isSubmitting}
                    className="w-full btn-secondary flex items-center justify-center space-x-2"
                  >
                    <FiPauseCircle className="h-5 w-5" />
                    <span>Put On Hold</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="card">
            {!isReadOnly ? (
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting || !verification.documentsVerified || !verification.esignVerified || !verification.enachVerified}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <FiCheck className="h-5 w-5" />
                      <span>Approve</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="w-full btn-danger flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <FiX className="h-5 w-5" />
                      <span>Reject</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Read Only Mode</p>
                <p className="text-xs text-gray-400 mt-1">Case has been verified or is not at your stage.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OperationsCaseScreen

