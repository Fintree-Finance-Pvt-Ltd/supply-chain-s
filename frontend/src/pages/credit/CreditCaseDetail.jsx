import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { fetchCaseById, clearCurrentCase, clearError } from '../../store/slices/caseSlice'
import { creditService } from '../../services/creditService'
import { partnerService } from '../../services/partnerService'
import api from '../../services/api'
import DocumentUploader from '../../components/DocumentUploader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate, formatCurrency } from '../../utils/format'
import { FiFileText, FiCheck, FiX, FiDownload, FiUpload, FiEye } from 'react-icons/fi'
import { workflowService } from '../../services/workflowService'
import { documentService } from '../../services/documentService'
import StatusBadge from '../../components/StatusBadge'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import CustomerFullDetails from '../../components/CustomerFullDetails'
import { submitCase } from '../../store/slices/caseSlice'

const DETAIL_SECTIONS = [
  'documents',
  'kyc',
  'coApplicants',
  'addresses',
  'contactPersons',
  'history',
  'sanctions',
]
 
const CreditCaseDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { currentCase, isLoading, error } = useSelector((state) => state.cases)
 
  // Dynamic partners from API - store full objects
  const [partners, setPartners] = useState([])
  const [partnersLoading, setPartnersLoading] = useState(true)
 
  // Use partners from API (full objects), empty array while loading
  const PARTNERS = partners
 
  // Store sanction data for each partner
  const [partnerSanctions, setPartnerSanctions] = useState(
    PARTNERS.reduce((acc, partner) => ({
      ...acc,
      [partner]: {
        sanctionAmount: '',
        tenor: '',
        roi: '',
        conditions: '',
        penalCharges: '',
        processingFees: '',
      }
    }), {})
  )
 
  const handleSendBackToRM = async () => {
  const reason = prompt("Enter reason");
 
  if (!reason) return;
 
  try {
    await workflowService.returnToRM(id, reason);
 
    toast.success("Case returned to RM successfully ✅");
 
    navigate("/credit/dashboard");
 
  } catch (err) {
    toast.error(err?.message || "Failed to return case");
  }
};
 
 
  // Store raw sanctions data from API for UI condition checking
  const [sanctionsData, setSanctionsData] = useState([])
 
  // Track if we've loaded sanctions from API
  const [sanctionsLoadedFromApi, setSanctionsLoadedFromApi] = useState(false)
 
  const [remarks, setRemarks] = useState('')
  const [docRemarks, setDocRemarks] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
 
  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }))
    }
    return () => {
      dispatch(clearCurrentCase())
      dispatch(clearError())
    }
  }, [id, dispatch])
 
  // Get user role (lowercase for comparison)
  const userRole = (user?.role || '').toLowerCase()
 
  // Get all user roles as an array (for users with multiple roles)
  const userRoles = (user?.roles || []).map(r => (r.name || r || '').toLowerCase())
  const hasL1Role = userRoles.includes('credit_team_l1')
  const hasL2Role = userRoles.includes('credit_team_l2')
 
  // Fetch partners from API - role-based logic
  // credit_l1: fetch from partners table (for new sanctions)
  // users with both L1 and L2: fetch partners (L1 functionality)
  // other roles: DO NOT fetch from partners table - use partners from sanction records
  useEffect(() => {
    // EARLY RETURN: Only credit_team_l1 (or both L1+L2) should fetch from partners table
    // All other roles (ceo, md, credit_l2 only, etc.) should get partners from sanction records
    if (!hasL1Role) {
      console.log('fetchPartners: Skipping - user has no L1 role, userRoles:', userRoles)
      setPartnersLoading(false)
      return
    }
   
    const fetchPartners = async () => {
      try {
        console.log('fetchPartners: Loading from partners table for credit_team_l1')
        const data = await partnerService.getActivePartners()
        // Store full partner objects
        if (data.partners && data.partners.length > 0) {
          setPartners(data.partners)
          console.log('fetchPartners: Set', data.partners.length, 'partners from API')
        }
        // Set loading to false after partners are loaded
        setPartnersLoading(false)
      } catch (err) {
        console.error('fetchPartners: Failed to fetch partners:', err)
        setPartnersLoading(false)
      }
    }
   
    fetchPartners()
  }, [userRole, id])
 
  // Fetch existing sanctions from credit_sanctions table
  // This runs for ALL roles - partners from sanctions are used for non-CREDIT_L1 roles
  useEffect(() => {
    const fetchSanctions = async () => {
      // Skip if no id
      if (!id) {
        console.log('fetchSanctions: No id, skipping')
        return
      }
     
      // For credit_l1, wait for partners to load first (they come from partners table)
      // Users with both L1+L2 roles should also wait for partners (they have L1 functionality)
      if (hasL1Role && partnersLoading) {
        console.log('fetchSanctions: credit_l1 waiting for partners to load')
        return
      }
     
      // For credit_l1, if partners were loaded from partners table, we don't need to fetch from sanctions
      // (unless they want to see existing sanctions)
      // But let's fetch anyway to get the latest sanction data
     
      try {
        console.log('fetchSanctions: Calling API with id:', id, 'userRoles:', userRoles)
       
        // For CREDIT_L1 roles (including users with both L1+L2), use the standard sanctions API
        // For non-L1 roles (L2 only, CEO, MD), use the dedicated sanctions API
        // This API returns all sanctions without filtering by partner active status
        const apiEndpoint = hasL1Role
          ? `/sanctions/${id}`
          : `/sanctions/customer/${id}`
       
        // Use api client which has auth interceptor
        const response = await api.get(apiEndpoint)
        const data = response.data
        console.log('Sanctions API response:', data)
 
        // Handle both API response formats:
        // 1. Old format: { sanctions: [...] }
        // 2. New format (for non-CREDIT_L1): [...] direct array
        const sanctionsArray = Array.isArray(data) ? data : (data.sanctions || [])
 
        if (sanctionsArray.length > 0) {
          console.log('Found sanctions:', sanctionsArray)
         
          // Store raw sanctions data for UI condition checking
          setSanctionsData(sanctionsArray)
         
          // Extract partners from existing sanctions - for ALL roles
          // Handle both 'partner' and 'partner_code' field names
          const existingPartners = sanctionsArray.map(s => ({
            id: s.partner || s.partner_code,
            code: s.partner || s.partner_code,
            name: s.partnerName || s.partner
          }))
          console.log('Extracted partners:', existingPartners)
         
          // For credit_team_l1: merge partners from partners table with partners from sanctions
          // Users with both L1+L2 roles should also merge (they have L1 functionality)
          // For other roles: use partners from sanctions only
          if (hasL1Role) {
            // Use functional update to get the current partners state from partners table
            setPartners(currentPartners => {
              // Merge: add sanction partners that don't exist in the current partners list
              const currentPartnerCodes = new Set(currentPartners.map(p => p.code))
              const sanctionPartnerCodes = existingPartners.map(p => p.code).filter(code => code && !currentPartnerCodes.has(code))
              const newPartnersFromSanctions = sanctionPartnerCodes.map(code => ({
                id: code,
                code: code,
                name: code
              }))
              const mergedPartners = [...currentPartners, ...newPartnersFromSanctions]
              console.log('Merged partners:', mergedPartners)
              return mergedPartners
            })
          } else {
            // For other roles, use partners from sanctions only
            setPartners(existingPartners)
          }
          // Set partnersLoading to false after partners are loaded from sanctions
          setPartnersLoading(false)
         
          // Create a map of partner code to sanction data
          const sanctionMap = {}
          sanctionsArray.forEach(s => {
            sanctionMap[s.partner || s.partner_code] = {
              // sanctionAmount: s.sanction_limit || s.sanctionAmount || '',
              sanctionAmount: parseFloat(s.sanction_limit || s.sanctionAmount || 0) || '',
              tenor: s.tenor || '',
              roi: s.roi || '',
              conditions: s.conditions || '',
              penalCharges: s.penalCharges || '',
              processingFees: s.processingFees || ''
            }
          })
 
          // Update partnerSanctions with fetched data
          // Include partners from sanctions even if they weren't in the initial PARTNERS list
          setPartnerSanctions(prev => {
            const updated = { ...prev }
            // First, add all sanction partners to the object if they don't exist
            Object.keys(sanctionMap).forEach(partnerCode => {
              if (!updated[partnerCode]) {
                updated[partnerCode] = {
                  sanctionAmount: '',
                  tenor: '',
                  roi: '',
                  conditions: '',
                  penalCharges: '',
                  processingFees: '',
                }
              }
              // Then update with sanction data
              updated[partnerCode] = {
                ...updated[partnerCode],
                ...sanctionMap[partnerCode]
              }
            })
            return updated
          })
         
          // Mark as loaded from API
          setSanctionsLoadedFromApi(true)
        } else {
          console.log('No sanctions found in response')
          // No sanctions found - set loading to false and clear sanctions data
          setSanctionsData([])
          setPartnersLoading(false)
        }
      } catch (err) {
        console.error('Failed to fetch sanctions:', err)
        // Set loading to false on error
        setPartnersLoading(false)
      }
    }
 
    fetchSanctions()
  }, [id, userRole, partnersLoading])
 
  useEffect(() => {
    // Skip if we already loaded data from the API (credit_sanctions table)
    if (sanctionsLoadedFromApi) return;
   
    if (currentCase) {
      // Load existing sanction data for each partner from creditSanctions or sanctionLimitHistory
      // For Credit L2, load from sanctionLimitHistory which contains all partner sanctions from L1
     
      const existingCreditSanctions = currentCase.creditSanctions || [];
      const sanctionHistory = currentCase.sanctionLimitHistory || [];
     
      // Initialize all partners with default values
      const partnerSanctionsData = {};
      PARTNERS.forEach(partner => {
        const partnerCode = partner.code;
        partnerSanctionsData[partnerCode] = {
          sanctionAmount: '',
          tenor: '',
          roi: '',
          conditions: '',
          penalCharges: '',
          processingFees: '',
        };
      });
     
      // First, try to load from creditSanctions (multiple partners supported)
      if (existingCreditSanctions && existingCreditSanctions.length > 0) {
        existingCreditSanctions.forEach(sanction => {
          const partnerCode = sanction.partner;
          // Check if partnerCode matches any partner's code
          const matchingPartner = PARTNERS.find(p => p.code === partnerCode);
          if (matchingPartner) {
            partnerSanctionsData[partnerCode] = {
              sanctionAmount: sanction.sanctionAmount || '',
              tenor: sanction.tenure || '',
              roi: sanction.interestRate || '',
              conditions: sanction.conditions || '',
              penalCharges: sanction.penalCharges || '',
              processingFees: sanction.processingFees || '',
            };
          }
        });
      }
      // Fallback: Load from sanctionLimitHistory (partner-specific data from L1)
      else if (sanctionHistory && sanctionHistory.length > 0) {
        sanctionHistory.forEach(limit => {
          const partnerCode = limit.lender;
          // Check if partnerCode matches any partner's code
          const matchingPartner = PARTNERS.find(p => p.code === partnerCode);
          if (matchingPartner) {
            partnerSanctionsData[partnerCode] = {
              sanctionAmount: limit.sanctionAmount || '',
              tenor: limit.tenure || '',
              roi: limit.interestRate || '',
              conditions: limit.conditions || '',
              penalCharges: limit.penalCharges || '',
              processingFees: limit.processingFees || '',
            };
          }
        });
      }
     
      setPartnerSanctions(partnerSanctionsData);
      setRemarks(existingCreditSanctions[0]?.creditRemarks || '')
    }
  }, [currentCase, PARTNERS, sanctionsLoadedFromApi])
 
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
    // Only MD can view ROI - credit_l1, credit_l2, and CEO should only see sanction amount
    return ['md'].includes(role);
  };
 
  const canEditROI = () => {
    const role = (user?.role || '').toLowerCase();
    if (!currentCase) return false;
    const status = currentCase.status;
    // Only MD can edit ROI
    if (role === 'md' && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true;
    // Allow MD to edit ROI always
    if (role === 'md') return true;
    return false;
  };
 
  const canViewTenure = () => {
    const role = (user?.role || '').toLowerCase();
    // Only MD can view tenure - credit_l1, credit_l2, and CEO should only see sanction amount
    return ['md'].includes(role);
  };
 
  const canEditTenure = () => {
    const role = (user?.role || '').toLowerCase();
    if (!currentCase) return false;
    const status = currentCase.status;
    // Only MD can edit tenor
    if (role === 'md' && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true;
    // Allow MD to edit tenor always
    if (role === 'md') return true;
    return false;
  };
 
  const isEditable = () => {
    if (!currentCase || !user) return false
    const status = currentCase.status
 
    // For Credit L1 - can edit sanction amount in submitted or credit_l1_review status
    if (hasL1Role && (status === 'submitted' || status === 'credit_l1_review')) return true;
    // For Credit L2 - can edit sanction amount in credit_l1_approved or credit_l2_review status
    // Also allow credit_l2 to edit in other statuses for modification
    if (hasL2Role) return true;
    // For CEO - can edit all sanction terms
    if (userRoles.includes('ceo')) return true;
    // For RM - can edit in draft status
    if (userRoles.includes('relationship_manager') && (status === 'draft' || status === 'submitted')) return true;
    // For MD - can edit in md_pending_terms status
    if (userRoles.includes('md') && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true;
   
    return false
  }
 
  // For backward compatibility - determine if user can take any action on the case
  // Updated to support users with both L1 and L2 roles
  const canTakeAction = () => {
    if (!currentCase || !user) return false
    const status = currentCase.status
 
    // Check if user has L1 role - can act on submitted status cases
    if (hasL1Role && (status === 'submitted' || status === 'credit_l1_review')) return true
    // Check if user has L2 role - can act on credit_l1_approved status cases
    if (hasL2Role && (status === 'credit_l1_approved' || status === 'credit_l2_review')) return true
    // CEO role
    if (userRoles.includes('ceo') && (status === 'credit_l2_approved' || status === 'ceo_review')) return true
    // MD role
    if (userRoles.includes('md') && (status === 'ceo_approved' || status === 'md_pending_terms' || status === 'md_review')) return true
    // Operations roles
    if (userRoles.includes('operations_team_l1') && (status === 'md_approved' || status === 'ops_l1_review')) return true
    if (userRoles.includes('operations_head') && (status === 'ops_l1_approved' || status === 'ops_l2_review')) return true
    // RM role
    if (userRoles.includes('relationship_manager') && (status === 'draft' || status === 'rejected')) return true
 
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
      toast.success('Document uploaded successfully')
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }))
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.message || error.message))
    }
  }
 
  const handleUpdateDocType = async (docId, newType) => {
    try {
      await documentService.updateDocumentMetadata(docId, { documentType: newType })
      toast.success('Document type updated')
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }))
    } catch (error) {
      toast.error('Update failed: ' + (error.response?.data?.message || error.message))
    }
  }
 
  // const handleVerifyDocument = async (docId, status) => {
  //   const remark = docRemarks[docId] || ''
  //   try {
  //     await workflowService.verifyDocument(docId, status, remark)
  //     toast.success('Document status updated')
  //     dispatch(fetchCaseById(id))
  //   } catch (error) {
  //     toast.error('Verification failed: ' + (error.response?.data?.message || error.message))
  //   }
  // }
 

const handleVerifyDocument = async (docId, status) => {
  const remark = docRemarks[docId] || '';

  // ✅ Save current scroll position
  const scrollY = window.scrollY;

  try {
    await workflowService.verifyDocument(docId, status, remark);

    toast.success('Document status updated');

    await dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS })); // re-fetch data

    //  Restore scroll position AFTER re-render
    setTimeout(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' });
    }, 0);

  } catch (error) {
    toast.error('Verification failed: ' + (error.response?.data?.message || error.message));
  }
};

  const handleSaveSanction = async () => {
    if (readOnly) return;
    setIsSubmitting(true)
    try {
      const userRole = (user?.role || '').toLowerCase()
 
      // Build partner sanctions array - only include partners with sanction amount
      const sanctionsArray = PARTNERS
        .filter(partner => partnerSanctions[partner.code]?.sanctionAmount)
        .map(partner => ({
          partner: partner.code,
          sanctionAmount: parseFloat(partnerSanctions[partner.code].sanctionAmount) || 0,
          tenure: parseInt(partnerSanctions[partner.code].tenor) || 0,
          interestRate: parseFloat(partnerSanctions[partner.code].roi) || 0,
          penalCharges: parseFloat(partnerSanctions[partner.code].penalCharges) || 0,
          processingFees: parseFloat(partnerSanctions[partner.code].processingFees) || 0,
          conditions: partnerSanctions[partner.code].conditions,
        }))
 
      const sanctionPayload = {
        partnerSanctions: sanctionsArray,
      }
 
      // Determine which approval endpoint to call based on case status and user roles
      // If case is in submitted status and user has L1 role -> call L1 approval
      // If case is in credit_l1_approved status and user has L2 role -> call L2 approval
      const caseStatus = currentCase.status
     
      if (caseStatus === 'submitted' || caseStatus === 'credit_l1_review') {
        // Case is at L1 stage - need L1 approval
        if (hasL1Role) {
          await workflowService.approveCreditL1(id, true, remarks, sanctionPayload)
        } else {
          throw new Error('You do not have L1 role to approve this case')
        }
      } else if (caseStatus === 'credit_l1_approved' || caseStatus === 'credit_l2_review') {
        // Case is at L2 stage - need L2 approval
        if (hasL2Role) {
          await workflowService.approveCreditL2(id, true, remarks, {
            partnerSanctions: sanctionsArray,
          })
        } else {
          throw new Error('You do not have L2 role to approve this case')
        }
      } else if (userRoles.includes('ceo')) {
        await workflowService.approveCEO(id, true, remarks, {
          partnerSanctions: sanctionsArray,
        })
      } else if (userRoles.includes('md')) {
        const mdPartner = PARTNERS[0]?.code || 'FFPL';
        await workflowService.approveMD(id, true, remarks, partnerSanctions[mdPartner])
      } else {
        throw new Error('Unauthorized role for this action')
      }
 
      toast.success('Approval processed successfully')
      navigate('/credit/dashboard')
    } catch (error) {
      toast.error('Failed: ' + (error.response?.data?.message || error.message || error))
    } finally {
      setIsSubmitting(false)
    }
  }
 
  const [previewedDocs, setPreviewedDocs] = useState(new Set())
 
  // Helper function to detect MIME type from file extension
  const getMimeType = (fileName) => {
    const ext = fileName?.toLowerCase().split('.').pop() || '';
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  };
 
  const handlePreview = async (doc, mode = 'inline') => {
    setPreviewedDocs(prev => new Set(prev).add(doc.id))
    try {
      // Use authenticated API to fetch the document
      const response = await api.get(`/documents/download/${doc.id}?mode=${mode}`, {
        responseType: 'blob',
      })
     
      // Detect MIME type from file extension
      const mimeType = getMimeType(doc.fileName);
     
      // Create a blob URL from the response
      const blob = new Blob([response.data], { type: mimeType })
      const blobUrl = URL.createObjectURL(blob)
     
      // For download, create an anchor element and trigger click
      if (mode === 'attachment') {
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = doc.fileName || 'document'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // Open in new tab for preview
        window.open(blobUrl, '_blank')
      }
    } catch (error) {
      console.error('Failed to preview document:', error)
      toast.error('Failed to preview document')
    }
  }
 
  // Wrapper functions for preview and download
  const handlePreviewClick = (doc) => handlePreview(doc, 'inline')
  const handleDownloadClick = (doc) => handlePreview(doc, 'attachment')
 
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
 
  // const allDocsPreviewed = currentCase.documents?.every(doc => previewedDocs.has(doc.id)) || true  // Default to true if no documents to avoid blocking actions when there are no docs
   const allDocsPreviewed = currentCase.documents?.every(doc => previewedDocs.has(doc.id)) || true
const numberToWords = (num) => {
  if (!num) return "";
 
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
 
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + " " + a[n % 10];
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred " + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand " + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh " + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + " Crore " + inWords(n % 10000000);
  };
 
  return inWords(Number(num)).trim();
};
 
 
 
const formatINR = (num) => {
  if (!num) return "";
  return new Intl.NumberFormat('en-IN').format(Number(num));
};
 
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
              {!readOnly && hasL1Role && (
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
                          {!readOnly && (hasL1Role || hasL2Role) ? (
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
                        
                          onClick={() => handlePreviewClick(doc)}
                          className={`p-1 ${previewedDocs.has(doc.id) ? 'text-green-600' : 'text-gray-600'} hover:bg-primary-50 rounded flex items-center space-x-1`}
                          title="Preview"
                        >
                          <FiEye className="h-4 w-4" />
                          {previewedDocs.has(doc.id) && <span className="text-[10px] font-bold">VIEWED</span>}
                        </button>
                        <button
                          onClick={() => handleDownloadClick(doc)}
                          className="p-1 text-gray-600 hover:bg-blue-50 rounded"
                          title="Download"
                        >
                          <FiDownload className="h-4 w-4" />
                        </button>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
 
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
 
                    {!readOnly && (hasL1Role || hasL2Role) && doc.status === 'pending' && (
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
          {canAccessSanctionDetails() && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sanction Details</h2>
           
            {(hasL1Role || hasL2Role || userRoles.includes('ceo')) && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  {hasL1Role ? 'Enter sanction limits for each partner:' :
                   hasL2Role ? 'View/modify sanction limits for each partner:' :
                   'View/modify sanction limits for each partner:'}
                </p>
              </div>
            )}
 
            {partnersLoading ? (
              <div className="text-center py-4 text-gray-500">Loading partners...</div>
            ) : (PARTNERS.length === 0) ? (
              <div className="text-center py-4 text-gray-500">No partners found</div>
            ) : (
              PARTNERS.map((partner) => (
                <div key={partner.id} className="mb-6 pb-6 border-b border-gray-200 last:border-0">
                  <h3 className="text-lg font-medium text-gray-800 mb-3">{partner.name}</h3>
                  <div className="space-y-4">
                    {canViewSanctionAmount() && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sanction Amount</label>
                        {/* <input
                          type="number"
                          value={partnerSanctions[partner.code]?.sanctionAmount || ''}
                           onWheel={(e) => e.target.blur()}
                          onChange={(e) => setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: { ...partnerSanctions[partner.code], sanctionAmount: e.target.value }
                          })}
                          className="input-field"
                          placeholder="Enter amount"
                          disabled={readOnly || !canEditSanctionAmount()}
                        /> */}
 
 
                        <input
  type="number"
  value={partnerSanctions[partner.code]?.sanctionAmount || ''}
  onWheel={(e) => e.target.blur()}
  onChange={(e) => setPartnerSanctions({
    ...partnerSanctions,
    [partner.code]: {
      ...partnerSanctions[partner.code],
      sanctionAmount: e.target.value
    }
  })}
  className="input-field"
  placeholder="Enter amount"
  disabled={readOnly || !canEditSanctionAmount()}
/>
 
{/* ADD THIS BELOW INPUT */}
{partnerSanctions[partner.code]?.sanctionAmount && (
  <p className="mt-1 text-sm text-red-600 font-medium">
    ₹ {formatINR(partnerSanctions[partner.code]?.sanctionAmount)}{" "}


      <span className="block text-xs text-blue-700 italic">
                                ({numberToWords(partnerSanctions[partner.code]?.sanctionAmount)} Only)
                              </span>
  
  </p>
)}
 
 
{/* {partnerSanctions[partner.code]?.sanctionAmount && (
  <p style={{
   marginTop: "6px",
    fontSize: "12px",
    color: "red",
    fontStyle: "bold",
    fontWeight: "500"
  }}>
    {numberToWords(partnerSanctions[partner.code]?.sanctionAmount)} Only
  </p>
)} */}
                      </div>
                    )}
                   
                    {canViewROI() && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ROI / IRR (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={partnerSanctions[partner.code]?.roi || ''}
                          onChange={(e) => setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: { ...partnerSanctions[partner.code], roi: e.target.value }
                          })}
                          className="input-field"
                          placeholder="Enter ROI %"
                          disabled={readOnly || !canEditROI()}
                        />
                      </div>
                    )}
                   
                    {canViewTenure() && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tenure (Months)</label>
                        <input
                          type="number"
                          value={partnerSanctions[partner.code]?.tenor || ''}
                          onChange={(e) => setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: { ...partnerSanctions[partner.code], tenor: e.target.value }
                          })}
                          className="input-field"
                          placeholder="Enter tenor in months"
                          disabled={readOnly || !canEditTenure()}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          )}
 
          {formattedApprovals.length > 0 && (
            <div className="card">
              <ApprovalTimeline approvals={formattedApprovals} />
            </div>
          )}
 
{hasL1Role && currentCase.status === 'submitted' && (
  <button
    onClick={handleSendBackToRM}
    disabled={isSubmitting}
    className="w-full mb-3 bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded flex items-center justify-center"
  >
    Send Back to RM
  </button>
)}
 
          <button
            onClick={handleSaveSanction}
            disabled={isSubmitting || readOnly || (!allDocsPreviewed && currentCase.documents?.length > 0)}
            className={`w-full btn-success flex items-center justify-center space-x-2 ${(readOnly || (!allDocsPreviewed && currentCase.documents?.length > 0)) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
    </div>
  )
}
 
export default CreditCaseDetail
