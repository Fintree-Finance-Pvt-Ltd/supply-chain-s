import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCaseById, clearCurrentCase, clearError } from '../../store/slices/caseSlice'
import { creditService } from '../../services/creditService'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../utils/format'
import { FiFileText, FiCheck, FiX, FiDownload, FiUpload, FiEye } from 'react-icons/fi'
import { workflowService } from '../../services/workflowService'
import { documentService } from '../../services/documentService'
import StatusBadge from '../../components/StatusBadge'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import CustomerFullDetails from '../../components/CustomerFullDetails'

const CreditCaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { currentCase, isLoading, error } = useSelector((state) => state.cases)

  // Dynamic partners from API
  const [partners, setPartners] = useState([])
  const [partnersLoading, setPartnersLoading] = useState(true)

  // Fallback to default if API fails
  const PARTNERS = partners.length > 0 ? partners : ['FFPL']

  // Store sanction data for each partner
  const [partnerSanctions, setPartnerSanctions] = useState(
    PARTNERS.reduce((acc, partner) => ({
      ...acc,
      [partner]: {
        sanctionAmount: '',
        tenure: '',
        interestRate: '',
        conditions: '',
        penalCharges: '',
        processingFees: '',
      }
    }), {})
  )

  const [remarks, setRemarks] = useState('')
  const [docRemarks, setDocRemarks] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById(id))
    }
    return () => {
      dispatch(clearCurrentCase())
      dispatch(clearError())
    }
  }, [id, dispatch])

  // Fetch partners from API
  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/partners/active', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          if (data.partners && data.partners.length > 0) {
            setPartners(data.partners.map(p => p.code))
          }
        }
      } catch (err) {
        console.error('Failed to fetch partners:', err)
      } finally {
        setPartnersLoading(false)
      }
    }
    fetchPartners()
  }, [])

  useEffect(() => {
    if (currentCase) {
      // Load existing sanction data for each partner from creditSanctions or sanctionLimitHistory
      // For Credit L2, load from sanctionLimitHistory which contains all partner sanctions from L1
      
      const existingSanctions = currentCase.creditSanctions?.[0] || {};
      const sanctionHistory = currentCase.sanctionLimitHistory || [];
      
      // Initialize all partners with default values
      const partnerSanctionsData = {};
      PARTNERS.forEach(partner => {
        partnerSanctionsData[partner] = {
          sanctionAmount: '',
          tenure: '',
          interestRate: '',
          conditions: '',
          penalCharges: '',
          processingFees: '',
        };
      });
      
      // Load from sanctionLimitHistory (partner-specific data from L1)
      if (sanctionHistory && sanctionHistory.length > 0) {
        sanctionHistory.forEach(limit => {
          const partner = limit.lender || 'FFPL';
          if (PARTNERS.includes(partner)) {
            partnerSanctionsData[partner] = {
              sanctionAmount: limit.sanctionAmount || '',
              tenure: limit.tenure || '',
              interestRate: limit.interestRate || '',
              conditions: limit.conditions || '',
              penalCharges: limit.penalCharges || '',
              processingFees: limit.processingFees || '',
            };
          }
        });
      } else if (existingSanctions.sanctionAmount) {
        // Fallback to creditSanctions for backward compatibility
        partnerSanctionsData['FFPL'] = {
          sanctionAmount: existingSanctions.sanctionAmount || '',
          tenure: existingSanctions.tenure || '',
          interestRate: existingSanctions.interestRate || '',
          conditions: existingSanctions.conditions || '',
          penalCharges: existingSanctions.penalCharges || '',
          processingFees: existingSanctions.processingFees || '',
        };
      }
      
      setPartnerSanctions(partnerSanctionsData);
      setRemarks(existingSanctions.creditRemarks || '')
    }
  }, [currentCase])

  // Define which roles can access (view and edit) sanction details
  const CAN_VIEW_SANCTION_ROLES = ['relationship_manager', 'credit_team_l1', 'credit_team_l2', 'ceo', 'md'];
  
  const canAccessSanctionDetails = () => {
    if (!user) return false;
    const role = (user.role || '').toLowerCase();
    return CAN_VIEW_SANCTION_ROLES.includes(role);
  };
  
  // Role-based field visibility helpers for sanction fields
  const canViewSanctionAmount = () => {
    const role = (user?.role || '').toLowerCase();
    return ['credit_team_l1', 'credit_team_l2', 'ceo', 'md'].includes(role);
  };
  
  const canEditSanctionAmount = () => {
    const role = (user?.role || '').toLowerCase();
    if (!currentCase) return false;
    const status = currentCase.status;
    // Credit L1 can edit in submitted or credit_l1_review status
    if (role === 'credit_team_l1' && (status === 'submitted' || status === 'credit_l1_review')) return true;
    // Credit L2 can edit in credit_l1_approved or credit_l2_review status
    if (role === 'credit_team_l2' && (status === 'credit_l1_approved' || status === 'credit_l2_review')) return true;
    // CEO can edit in credit_l2_approved or ceo_review status
    if (role === 'ceo' && (status === 'credit_l2_approved' || status === 'ceo_review')) return true;
    // MD can edit in various statuses
    if (role === 'md' && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true;
    // Allow editing for credit_l2 in any status (for modification purposes)
    if (role === 'credit_team_l2') return true;
    return false;
  };
  
  const canViewROI = () => {
    const role = (user?.role || '').toLowerCase();
    return ['ceo', 'md'].includes(role);
  };
  
  const canEditROI = () => {
    const role = (user?.role || '').toLowerCase();
    if (!currentCase) return false;
    const status = currentCase.status;
    // CEO can edit ROI in credit_l2_approved or ceo_review status
    if (role === 'ceo' && (status === 'credit_l2_approved' || status === 'ceo_review')) return true;
    // MD can edit ROI in various statuses
    if (role === 'md' && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true;
    // Allow CEO to edit ROI always
    if (role === 'ceo') return true;
    return false;
  };
  
  const canViewTenure = () => {
    const role = (user?.role || '').toLowerCase();
    return ['ceo', 'md'].includes(role);
  };
  
  const canEditTenure = () => {
    const role = (user?.role || '').toLowerCase();
    if (!currentCase) return false;
    const status = currentCase.status;
    // CEO can edit tenure in credit_l2_approved or ceo_review status
    if (role === 'ceo' && (status === 'credit_l2_approved' || status === 'ceo_review')) return true;
    // MD can edit tenure in various statuses
    if (role === 'md' && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true;
    // Allow CEO to edit tenure always
    if (role === 'ceo') return true;
    return false;
  };
  
  const isEditable = () => {
    if (!currentCase || !user) return false
    const role = (user.role || '').toLowerCase()
    const status = currentCase.status

    // For Credit L1 - can edit sanction amount in submitted or credit_l1_review status
    if (role === 'credit_team_l1' && (status === 'submitted' || status === 'credit_l1_review')) return true;
    // For Credit L2 - can edit sanction amount in credit_l1_approved or credit_l2_review status
    // Also allow credit_l2 to edit in other statuses for modification
    if (role === 'credit_team_l2') return true;
    // For CEO - can edit all sanction terms
    if (role === 'ceo') return true;
    // For RM - can edit in draft status
    if (role === 'relationship_manager' && (status === 'draft' || status === 'submitted')) return true;
    // For MD - can edit in md_pending_terms status
    if (role === 'md' && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true;
    
    return false
  }

  // For backward compatibility - determine if user can take any action on the case
  const canTakeAction = () => {
    if (!currentCase || !user) return false
    const role = (user.role || '').toLowerCase()
    const status = currentCase.status

    if (role === 'credit_team_l1' && (status === 'submitted' || status === 'credit_l1_review')) return true
    if (role === 'credit_team_l2' && (status === 'credit_l1_approved' || status === 'credit_l2_review')) return true
    if (role === 'ceo' && (status === 'credit_l2_approved' || status === 'ceo_review')) return true
    if (role === 'md' && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true
    if (role === 'operations_team_l1' && (status === 'md_approved' || status === 'ops_l1_review')) return true
    if (role === 'operations_head' && (status === 'ops_l1_approved' || status === 'ops_l2_review')) return true
    if (role === 'relationship_manager' && (status === 'draft' || status === 'rejected')) return true

    return false
  }

  const readOnly = !isEditable()

  const formattedApprovals = (currentCase?.statusHistory || []).map(action => ({
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

  const handleUpload = async (file, type) => {
    try {
      await documentService.uploadDocument(id, file, type)
      alert('Document uploaded successfully')
      dispatch(fetchCaseById(id))
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleUpdateDocType = async (docId, newType) => {
    try {
      // Assuming metadata update handles documentType change or we strictly need a specific endpoint.
      // Since documentService.updateDocumentMetadata takes (docId, meta), we try passing documentType.
      await documentService.updateDocumentMetadata(docId, { documentType: newType })
      alert('Document type updated')
      dispatch(fetchCaseById(id))
    } catch (error) {
      alert('Update failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const handleVerifyDocument = async (docId, status) => {
    const remark = docRemarks[docId] || ''
    // Remarks made optional as per requirement
    // if (!remark.trim()) {
    //   alert('Please add remarks for verification')
    //   return
    // }
    try {
      await workflowService.verifyDocument(docId, status, remark)
      alert('Document status updated')
      dispatch(fetchCaseById(id))
    } catch (error) {
      alert('Verification failed: ' + (error.response?.data?.message || error.message))
    }
  }

  // ... (handleSaveSanction remains similar but checks readOnly implied by disabling button)
  const handleSaveSanction = async () => {
    if (readOnly) return;
    // ... rest of logic
    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()

      // Build partner sanctions array - only include partners with sanction amount
      const sanctionsArray = PARTNERS
        .filter(partner => partnerSanctions[partner]?.sanctionAmount)
        .map(partner => ({
          partner,
          sanctionAmount: parseFloat(partnerSanctions[partner].sanctionAmount) || 0,
          tenure: parseInt(partnerSanctions[partner].tenure) || 0,
          interestRate: parseFloat(partnerSanctions[partner].interestRate) || 0,
          penalCharges: parseFloat(partnerSanctions[partner].penalCharges) || 0,
          processingFees: parseFloat(partnerSanctions[partner].processingFees) || 0,
          conditions: partnerSanctions[partner].conditions,
        }))

      const sanctionPayload = {
        partnerSanctions: sanctionsArray,
      }

      if (userRole === 'credit_team_l2') {
        // Credit L2 can modify sanctionAmount for all partners
        // Save sanction details - send partner sanctions array
        await workflowService.approveCreditL2(id, true, remarks, {
          partnerSanctions: sanctionsArray,
        })
      } else if (userRole === 'credit_team_l1') {
        // Credit L1 saves sanction and approves - send partner sanctions
        await workflowService.approveCreditL1(id, true, remarks, sanctionPayload)
      } else if (userRole === 'ceo') {
        // CEO approves with all partner sanction terms
        await workflowService.approveCEO(id, true, remarks, {
          partnerSanctions: sanctionsArray,
        })
      } else if (userRole === 'md') {
        // MD approves with final sanction terms
        await workflowService.approveMD(id, true, remarks, partnerSanctions['FFPL'])
      } else {
        throw new Error('Unauthorized role for this action')
      }

      alert('Approval processed successfully')
      navigate('/credit/dashboard')
    } catch (error) {
      alert('Failed: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const [previewedDocs, setPreviewedDocs] = useState(new Set())

  const handlePreview = (doc) => {
    setPreviewedDocs(prev => new Set(prev).add(doc.id))
    const fileUrl = `${import.meta.env.VITE_API_BASE_URL}/documents/download/${doc.id}`
    window.open(fileUrl, '_blank')
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600">Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => navigate('/credit/dashboard')}
          className="text-primary-600 hover:text-primary-700"
        >
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  if (!currentCase) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  const allDocsPreviewed = currentCase.documents?.every(doc => previewedDocs.has(doc.id)) || true

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/credit/dashboard')}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Case Details {readOnly && '(Read Only)'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CustomerFullDetails customer={currentCase} />

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Uploaded Documents</h2>
              {!readOnly && (user?.role === 'credit_team_l1') && (
                <DocumentUploader
                  onUpload={handleUpload}
                  documentTypes={[
                    { value: 'cam', label: 'CAM' },
                    { value: 'sanction_letter', label: 'Sanction Letter' },
                    { value: 'other', label: 'Other' },
                  ]}
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
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{doc.fileName}</p>
                            {doc.applicantType === 'co-applicant' ? (
                              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">CO-APP {doc.applicantIndex || ''}</span>
                            ) : (
                              <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">APPLICANT</span>
                            )}
                          </div>
                          {!readOnly && (user?.role === 'credit_team_l1' || user?.role === 'credit_team_l2') ? (
                            <select
                              value={doc.documentType}
                              onChange={(e) => handleUpdateDocType(doc.id, e.target.value)}
                              className="text-xs bg-transparent border-none p-0 text-primary-600 font-bold uppercase cursor-pointer hover:underline"
                            >
                              <option value="pan">PAN</option>
                              <option value="aadhaar">AADHAAR</option>
                              <option value="gst_certificate">GST CERTIFICATE</option>
                              <option value="bank_statement">BANK STATEMENT</option>
                              <option value="cam">CAM</option>
                              <option value="other">OTHER</option>
                            </select>
                          ) : (
                            <p className="text-xs text-gray-500 uppercase">{doc.documentType}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePreview(doc)}
                          className={`p-1 ${previewedDocs.has(doc.id) ? 'text-green-600' : 'text-primary-600'} hover:bg-primary-50 rounded flex items-center space-x-1`}
                          title="Preview"
                        >
                          <FiEye className="h-4 w-4" />
                          {previewedDocs.has(doc.id) && <span className="text-[10px] font-bold">VIEWED</span>}
                        </button>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>

                    {/* Metadata View (Issue/Expiry) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Issue Date</p>
                        <p className="text-xs text-gray-700">{doc.issueDate ? formatDate(doc.issueDate) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Expiry Date</p>
                        <p className="text-xs text-gray-700">{doc.expiryDate ? formatDate(doc.expiryDate) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">RM Remarks</p>
                        <p className="text-xs text-gray-700 truncate" title={doc.rmRemarks}>{doc.rmRemarks || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Credit Remarks</p>
                        <textarea
                          placeholder="Add your remarks..."
                          value={docRemarks[doc.id] || doc.remarks || ''}
                          onChange={(e) => setDocRemarks({ ...docRemarks, [doc.id]: e.target.value })}
                          className="w-full text-xs input-field"
                          rows={1}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {!readOnly && (user?.role === 'credit_team_l1' || user?.role === 'credit_team_l2') && doc.status === 'pending' && (
                      <div className="flex space-x-2 mt-4">
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'approved')}
                          disabled={!previewedDocs.has(doc.id)}
                          className={`flex-1 py-1 px-2 text-xs text-white rounded flex items-center justify-center space-x-1 ${!previewedDocs.has(doc.id) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                          title={!previewedDocs.has(doc.id) ? "Preview document before internal approval" : ""}
                        >
                          <FiCheck className="h-3 w-3" />
                          <span>{previewedDocs.has(doc.id) ? 'Approve Doc' : 'Preview to Approve'}</span>
                        </button>
                        <button
                          onClick={() => handleVerifyDocument(doc.id, 'rejected')}
                          className="flex-1 py-1 px-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center space-x-1"
                        >
                          <FiX className="h-3 w-3" />
                          <span>Reject Doc</span>
                        </button>
                      </div>
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
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Only show sanction details for RM and MD roles */}
          {canAccessSanctionDetails() && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Details</h2>
            
            {/* Show tabs for each partner when Credit L1, L2 or CEO */}
            {(user?.role === 'credit_team_l1' || user?.role === 'credit_team_l2' || user?.role === 'ceo') && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  {user?.role === 'credit_team_l1' ? 'Enter sanction limits for each partner:' : 
                   user?.role === 'credit_team_l2' ? 'View/modify sanction limits for each partner:' : 
                   'View/modify sanction limits for each partner:'}
                </p>
              </div>
            )}

            {/* Show partner-specific fields for Credit L1/L2/CEO */}
            {((user?.role === 'credit_team_l1' || user?.role === 'credit_team_l2' || user?.role === 'ceo') ? PARTNERS : ['FFPL']).map((partner) => (
              <div key={partner} className="mb-6 pb-6 border-b border-gray-200 last:border-0">
                <h3 className="text-lg font-medium text-gray-800 mb-3">{partner} Sanction</h3>
                <div className="space-y-4">
                  {/* Sanction Amount - Visible for Credit L1/L2, CEO, MD */}
                  {canViewSanctionAmount() && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sanction Amount (₹)</label>
                      <input
                        type="number"
                        value={partnerSanctions[partner]?.sanctionAmount || ''}
                        onChange={(e) => setPartnerSanctions({
                          ...partnerSanctions,
                          [partner]: { ...partnerSanctions[partner], sanctionAmount: e.target.value }
                        })}
                        className="input-field"
                        placeholder="Enter amount"
                        disabled={readOnly || !canEditSanctionAmount()}
                      />
                    </div>
                  )}
                  
                  {/* ROI/IRR - Visible and editable for CEO and MD only */}
                  {canViewROI() && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ROI / IRR (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={partnerSanctions[partner]?.interestRate || ''}
                        onChange={(e) => setPartnerSanctions({
                          ...partnerSanctions,
                          [partner]: { ...partnerSanctions[partner], interestRate: e.target.value }
                        })}
                        className="input-field"
                        placeholder="Enter ROI %"
                        disabled={readOnly || !canEditROI()}
                      />
                    </div>
                  )}
                  
                  {/* Tenure - Visible and editable for CEO and MD only */}
                  {canViewTenure() && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tenure (Months)</label>
                      <input
                        type="number"
                        value={partnerSanctions[partner]?.tenure || ''}
                        onChange={(e) => setPartnerSanctions({
                          ...partnerSanctions,
                          [partner]: { ...partnerSanctions[partner], tenure: e.target.value }
                        })}
                        className="input-field"
                        placeholder="Enter tenure in months"
                        disabled={readOnly || !canEditTenure()}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}

          {formattedApprovals.length > 0 && (
            <div className="card">
              <ApprovalTimeline approvals={formattedApprovals} />
            </div>
          )}

          <button
            onClick={handleSaveSanction}
            disabled={isSubmitting || readOnly || (!allDocsPreviewed && currentCase.documents?.length > 0)}
            className={`w-full btn-primary flex items-center justify-center space-x-2 ${(readOnly || (!allDocsPreviewed && currentCase.documents?.length > 0)) ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={(!allDocsPreviewed && currentCase.documents?.length > 0) ? "Please preview all documents before proceeding" : ""}
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <FiCheck className="h-5 w-5" />
                <span>{(!allDocsPreviewed && currentCase.documents?.length > 0) ? 'Preview All Docs to Enable' : 'Save & Submit'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div >
  )
}

export default CreditCaseDetail
