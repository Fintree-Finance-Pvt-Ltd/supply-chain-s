import OnboardingContainer from "../rm/onboarding/OnboardingContainer";
export default OnboardingContainer;
















// import { useState, useEffect } from 'react'
// import { useNavigate, useSearchParams } from 'react-router-dom'
// import { useDispatch, useSelector } from 'react-redux'
// import { createCase, updateCase, submitCase, fetchCaseById } from '../../store/slices/caseSlice'
// import { documentService } from '../../services/documentService'
// import kycService from '../../services/kycService'
// import DocumentChecklistUploader from '../../components/DocumentChecklistUploader'
// import CoApplicantForm from '../../components/CoApplicantForm'
// import ContactPersonForm from '../../components/ContactPersonForm'
// import AddressForm from '../../components/AddressForm'
// import LoadingSpinner from '../../components/LoadingSpinner'
// import { validatePAN, validateMobile, validateEmail } from '../../utils/validation'
// import { COMPANY_TYPES, getDocumentChecklist } from '../../config/documentChecklists'
// import { FiUpload, FiPlus, FiCamera } from 'react-icons/fi';
// import LivePhotoCapture from '../../components/LivePhotoCapture';

// const NewCustomerOnboarding = () => {
//   const navigate = useNavigate()
//   const dispatch = useDispatch()
//   const [searchParams] = useSearchParams()
//   const caseId = searchParams.get('id')
//   const { currentCase, isLoading } = useSelector((state) => state.cases)

//   // Tab state
//   const [activeTab, setActiveTab] = useState('basic-kyc')

//   // Form data
//   const [formData, setFormData] = useState({
//     companyType: '',
//     companyName: '',
//     companyMobile: '',
//     companyEmail: '',
//     companyPan: '',
//     companyGst: '',

//     // Applicant details
//     applicantName: '',
//     applicantMobile: '',
//     applicantEmail: '',
//     applicantPan: '',

//     // Verification states
//     verified: {
//       companyMobile: false,
//       companyEmail: false,
//       companyPan: false,
//       companyGst: false,
//       applicantMobile: false,
//       applicantEmail: false,
//       applicantPan: false,
//       aadhaarKyc: false
//     },
//     remarks: ''
//   })

//   // KYC data for applicant (to be merged into formData or handled separately)
//   const [applicantKyc, setApplicantKyc] = useState({
//     panFile: null,
//     gstFile: null,
//   })

//   // Co-applicants
//   const [coApplicants, setCoApplicants] = useState([])

//   // Contact Persons
//   const [contactPersons, setContactPersons] = useState([])

//   // Addresses
//   const [addresses, setAddresses] = useState([])

//   // Co-applicant KYC data
//   const [coApplicantKyc, setCoApplicantKyc] = useState({})

//   const [documents, setDocuments] = useState([])
//   const [errors, setErrors] = useState({})
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const [isOcrProcessing, setIsOcrProcessing] = useState(false)
//   const [isVerifying, setIsVerifying] = useState(false)
//   const [showSubmitModal, setShowSubmitModal] = useState(false)
//   const [showOtpModal, setShowOtpModal] = useState(false)
//   const [otpData, setOtpData] = useState({ target: '', value: '', type: '' })
//   const [otpValue, setOtpValue] = useState('')
//   const [submissionTargets, setSubmissionTargets] = useState({
//     credit: { selected: true, email: 'credit_l1@scf.com', subject: 'New Case for Review', body: 'Please review this new customer onboarding case.' },
//     kite: { selected: false, email: 'kite_partners@kite.com', subject: 'New Case Lead', body: 'We have a new lead for you.' },
//     muthoot: { selected: false, email: 'support@muthoot.com', subject: 'Customer Onboarding - Muthoot', body: 'New case submission for Muthoot process.' },
//     chola: { selected: false, email: 'info@chola.com', subject: 'Lead Referral', body: 'Referring a new potential customer.' },
//   })

//   // Loading and verification states
//   const [loadingStates, setLoadingStates] = useState({})
//   const [verificationStatuses, setVerificationStatuses] = useState([])

//   const [showCamera, setShowCamera] = useState(false);
//   const [cameraTarget, setCameraTarget] = useState(null); // 'applicant-pan', 'live-photo', etc.

//   useEffect(() => {
//     if (caseId) {
//       dispatch(fetchCaseById(caseId))
//       loadVerificationStatuses(caseId)
//     }
//   }, [caseId, dispatch])

//   const loadVerificationStatuses = async (id) => {
//     try {
//       const result = await kycService.getKycStatuses(id)
//       if (result.success) {
//         setVerificationStatuses(result.data)

//         // Update verified state in formData based on fetched statuses
//         const mainStatus = result.data.find(s => !s.coApplicantId)
//         if (mainStatus) {
//           setFormData(prev => ({
//             ...prev,
//             verified: {
//               ...prev.verified,
//               companyMobile: mainStatus.mobileStatus === 'VERIFIED',
//               companyEmail: mainStatus.emailStatus === 'VERIFIED',
//               companyPan: mainStatus.panStatus === 'VERIFIED',
//               companyGst: mainStatus.gstStatus === 'VERIFIED',
//               applicantMobile: mainStatus.mobileStatus === 'VERIFIED',
//               applicantEmail: mainStatus.emailStatus === 'VERIFIED',
//               applicantPan: mainStatus.panStatus === 'VERIFIED',
//               aadhaarKyc: mainStatus.aadhaarStatus === 'VERIFIED',
//             }
//           }))
//         }
//       }
//     } catch (error) {
//       console.error('Failed to fetch verification statuses:', error)
//     }
//   }

//   useEffect(() => {
//     if (currentCase && caseId) {
//       setFormData(prev => ({
//         ...prev,
//         companyType: currentCase.companyType || '',
//         companyName: currentCase.companyName || '',
//         companyMobile: currentCase.companyMobile || '',
//         companyEmail: currentCase.companyEmail || '',
//         companyPan: currentCase.companyPan || '',
//         companyGst: currentCase.gstNumber || '',
//         applicantName: currentCase.name || '',
//         applicantMobile: currentCase.mobile || '',
//         applicantEmail: currentCase.email || '',
//         applicantPan: currentCase.pan || '',
//         remarks: currentCase.remarks || '',
//         verified: {
//           ...prev.verified,
//           aadhaarKyc: !!currentCase.aadhaarVerified || false
//         }
//       }))
//       setDocuments(currentCase.documents || [])

//       // Load KYC data if it exists
//       if (currentCase.kycDetails && currentCase.kycDetails.length > 0) {
//         const panKyc = currentCase.kycDetails.find(k => k.kycType === 'PAN' && k.applicantType === 'applicant')
//         if (panKyc) {
//           setApplicantKyc(prev => ({ ...prev, panNumber: panKyc.kycNumber }))
//         }
//       }

//       // Load co-applicants
//       if (currentCase.coApplicants && currentCase.coApplicants.length > 0) {
//         const loadedCoApps = currentCase.coApplicants.map(ca => ({
//           id: ca.id,
//           name: ca.name,
//           mobile: ca.mobile,
//           email: ca.email || '',
//           gender: ca.gender,
//         }))
//         setCoApplicants(loadedCoApps)

//         // Load co-applicant KYC
//         const loadedCoAppKyc = {}
//         currentCase.coApplicants.forEach((ca, index) => {
//           if (ca.kycDetails && ca.kycDetails.length > 0) {
//             const panKyc = ca.kycDetails.find(k => k.kycType === 'PAN')
//             if (panKyc) {
//               loadedCoAppKyc[index] = {
//                 panNumber: panKyc.kycNumber,
//                 panFile: null,
//               }
//             }
//           }
//         })
//         setCoApplicantKyc(loadedCoAppKyc)
//       }

//       // Load Contact Persons
//       if (currentCase.contactPersons && currentCase.contactPersons.length > 0) {
//         setContactPersons(currentCase.contactPersons.map(cp => ({
//           id: cp.id,
//           name: cp.name,
//           mobile: cp.mobile,
//           email: cp.email || '',
//           designation: cp.designation || '',
//           gender: cp.gender,
//         })))
//       }

//       // Load Addresses
//       if (currentCase.addresses && currentCase.addresses.length > 0) {
//         setAddresses(currentCase.addresses.map(addr => ({
//           id: addr.id,
//           type: addr.type,
//           fullAddress: addr.fullAddress,
//           pincode: addr.pincode,
//           state: addr.state,
//           city: addr.city,
//         })))
//       }
//     }
//   }, [currentCase, caseId])

//   // Get document checklist based on company type
//   const documentChecklist = getDocumentChecklist(formData.companyType)

//   const handleVerify = async (field, value, type = 'company', coApplicantId = null) => {
//     const loadingKey = coApplicantId ? `${field}_${coApplicantId}` : field

//     // Check if already verified
//     const isVerified = coApplicantId
//       ? verificationStatuses.find(s => s.coApplicantId === coApplicantId)?.[`${field.replace('coApp_', '')}Status`] === 'VERIFIED'
//       : formData.verified[field]

//     if (isVerified) return

//     // caseId check removed for mobile verification to allow initial flow
//     if (!caseId && !field.toLowerCase().includes('mobile')) {
//       alert('Please verify your mobile number first to proceed.')
//       return
//     }

//     if (!value) {
//       alert(`Please enter required details for ${field} first`)
//       return
//     }

//     setLoadingStates(prev => ({ ...prev, [loadingKey]: true }))
//     try {
//       let result;
//       if (field.toLowerCase().includes('mobile')) {
//         result = await kycService.sendMobileOtp(caseId, value)
//         if (result.success) {
//           setOtpData({ target: field, value, type: 'mobile', coApplicantId })
//           setShowOtpModal(true)
//         }
//       } else if (field.toLowerCase().includes('email')) {
//         result = await kycService.sendEmailOtp(caseId, value)
//         if (result.success) {
//           setOtpData({ target: field, value, type: 'email', coApplicantId })
//           setShowOtpModal(true)
//         }
//       } else if (field.toLowerCase().endsWith('gst')) {
//         result = await kycService.verifyGst(caseId, value, coApplicantId)
//         if (result.success) {
//           alert('GST verified successfully')
//           loadVerificationStatuses(caseId)
//         }
//       } else if (field.toLowerCase().endsWith('pan')) {
//         result = await kycService.verifyPan(caseId, value, formData.applicantName || formData.companyName, coApplicantId)
//         if (result.success && (result.verified || result.data?.verified)) {
//           alert('PAN verified successfully')
//           loadVerificationStatuses(caseId)
//         } else {
//           alert('PAN verification failed: ' + (result.message || 'Details mismatch'))
//         }
//       }
//     } catch (error) {
//       alert(`${field} verification failed: ` + (error.response?.data?.message || error.message))
//     } finally {
//       setLoadingStates(prev => ({ ...prev, [loadingKey]: false }))
//     }
//   }

//   const handleOtpVerify = async () => {
//     if (!otpValue || otpValue.length < 4) {
//       alert('Please enter a valid OTP')
//       return
//     }

//     setIsVerifying(true)
//     try {
//       let result;
//       if (otpData.type === 'mobile') {
//         const companyInfo = !caseId ? {
//           companyType: formData.companyType,
//           companyName: formData.companyName
//         } : undefined;

//         result = await kycService.verifyMobileOtp(caseId, otpValue, otpData.value, companyInfo)
//       } else {
//         result = await kycService.verifyEmailOtp(caseId, otpValue)
//       }

//       if (result.success) {
//         setShowOtpModal(false)
//         setOtpValue('')

//         // If a new customer was created, update caseId and URL
//         // if (result.customerId && !caseId) {
//         //   navigate(`/rm/customer/new?id=${result.customerId}`, { replace: true });
//         if (result.customerId && !caseId) {
//   setCaseId(result.customerId) // store in state
// }
// else if (caseId) {
//           loadVerificationStatuses(caseId)
//         }

//         alert(`${otpData.type === 'mobile' ? 'Mobile' : 'Email'} verified successfully`)
//       }
//     } catch (error) {
//       alert('OTP verification failed: ' + (error.response?.data?.message || error.message))
//     } finally {
//       setIsVerifying(false)
//     }
//   }

//   const handleAadhaarKyc = async () => {
//     if (!caseId) {
//       alert('Please save the case as draft first')
//       return
//     }

//     setIsVerifying(true)
//     try {
//       const result = await kycService.initiateAadhaarKyc(caseId, '')
//       if (result.success && result.longUrl) {
//         // Open the Digitap link in a new window
//         window.open(result.longUrl, '_blank')
//         alert('Aadhaar KYC link generated. Please complete verification in the new window.')

//         // In a real app, you'd poll or wait for a callback
//         // For now, let's mark it as potentially in progress or wait for manual refresh
//       } else {
//         alert('Failed to initiate Aadhaar KYC')
//       }
//     } catch (error) {
//       alert('Aadhaar KYC initiation failed: ' + error.message)
//     } finally {
//       setIsVerifying(false)
//     }
//   }

//   const handleBureauCheck = async () => {
//     if (!caseId) {
//       alert('Please save the case as draft first')
//       return
//     }

//     setIsVerifying(true)
//     try {
//       const result = await kycService.checkBureau(caseId)
//       if (result.success) {
//         alert(`Bureau Check Completed! Score: ${result.score || 'N/A'}`)
//         // Optionally update some state if needed
//       }
//     } catch (error) {
//       alert('Bureau Check failed: ' + error.message)
//     } finally {
//       setIsVerifying(false)
//     }
//   }

//   // PAN Upload and OCR for applicant
//   const handleApplicantPanUpload = async (e) => {
//     const file = e.target.files[0]
//     if (!file) return

//     setIsOcrProcessing(true)
//     try {
//       const result = await kycService.runOcr(file, 'PAN')
//       if (result.success) {
//         setFormData(prev => ({
//           ...prev,
//           applicantPan: result.data.pan,
//           applicantName: result.data.name || prev.applicantName,
//         }))
//         setApplicantKyc(prev => ({
//           ...prev,
//           panFile: file,
//         }))
//         alert(`OCR completed! PAN: ${result.data.pan}, Name: ${result.data.name || 'N/A'}`)
//       }
//     } catch (error) {
//       alert('OCR failed: ' + error.message)
//     } finally {
//       setIsOcrProcessing(false)
//     }
//   }

//   const handleCameraCapture = (file) => {
//     if (cameraTarget === 'applicant-pan') {
//       handleApplicantPanUpload({ target: { files: [file] } });
//     } else if (cameraTarget === 'live-photo') {
//       const doc = {
//         id: Date.now(),
//         fileName: 'live_photo_capture.jpg',
//         documentType: 'live_photo',
//         file: file,
//         status: 'pending',
//         uploadedBy: 'RM',
//         createdAt: new Date().toISOString()
//       };
//       setDocuments(prev => [...prev, doc]);
//       if (caseId) {
//         documentService.uploadDocument(caseId, file, 'live_photo')
//           .then(() => alert('Live photo uploaded successfully'))
//           .catch(err => alert('Failed to upload live photo: ' + err.message));
//       }
//     }
//     setShowCamera(false);
//     setCameraTarget(null);
//   };

//   const handleGstUpload = async (e) => {
//     const file = e.target.files[0]
//     if (!file) return
//     setApplicantKyc(prev => ({ ...prev, gstFile: file }))
//     alert('GST document uploaded')
//   }

//   const handleCompanyPanUpload = async (e) => {
//     const file = e.target.files[0]
//     if (!file) return

//     setIsOcrProcessing(true)
//     try {
//       const result = await kycService.runOcr(file, 'PAN')
//       if (result.success) {
//         setFormData(prev => ({
//           ...prev,
//           companyPan: result.data.pan,
//           companyName: prev.companyType === COMPANY_TYPES.PROPRIETORSHIP ? (result.data.name || prev.companyName) : prev.companyName
//         }))
//         alert(`OCR completed! Company PAN: ${result.data.pan}`)
//       }
//     } catch (error) {
//       alert('OCR failed: ' + error.message)
//     } finally {
//       setIsOcrProcessing(false)
//     }
//   }

//   // Co-Applicant Management
//   const addCoApplicant = () => {
//   const newItem = {
//     localKey: Date.now(), // frontend temporary identity
//     id: null,
//     name: '',
//     mobile: '',
//     email: '',
//     gender: ''
//   }

//   setCoApplicants(prev => [...prev, newItem])
// }


//   const removeCoApplicant = (key) => {
//   setCoApplicants(prev =>
//     prev.filter(item =>
//       item.id !== key && item.localKey !== key
//     )
//   )

//   setCoApplicantKyc(prev => {
//     const updated = { ...prev }
//     delete updated[key]
//     return updated
//   })
// }



//   const updateCoApplicant = (key, data) => {
//   setCoApplicants(prev =>
//     prev.map(item =>
//       (item.id === key || item.localKey === key)
//         ? { ...item, ...data }
//         : item
//     )
//   )
// }


//   const handleCoApplicantPanUpload = (index, file, panNumber) => {
//     setCoApplicantKyc(prev => ({
//       ...prev,
//       [index]: {
//         ...prev[index],
//         panNumber,
//         panFile: file,
//       }
//     }))
//   }

//   // Contact Person Management
//   const addContactPerson = () => {
//     setContactPersons([...contactPersons, { name: '', mobile: '', email: '', designation: '', gender: '' }])
//   }

//   const updateContactPerson = (key, data) => {
//   setContactPersons(prev =>
//     prev.map(item =>
//       (item.id === key || item.localKey === key)
//         ? { ...item, ...data }
//         : item
//     )
//   )
// }

// const removeContactPerson = (key) => {
//   setContactPersons(prev =>
//     prev.filter(item =>
//       item.id !== key && item.localKey !== key
//     )
//   )
// }


//   // Address Management
//   const addAddress = () => {
//     setAddresses([...addresses, { type: '', fullAddress: '', pincode: '', state: '', city: '' }])
//   }


//   const updateAddress = (key, data) => {
//   setAddresses(prev =>
//     prev.map(item =>
//       (item.id === key || item.localKey === key)
//         ? { ...item, ...data }
//         : item
//     )
//   )
// }

// const removeAddress = (key) => {
//   setAddresses(prev =>
//     prev.filter(item =>
//       item.id !== key && item.localKey !== key
//     )
//   )
// }


//   const validateBasicKycTab = () => {
//     const newErrors = {}

//     if (!formData.companyType) {
//       newErrors.companyType = 'Company type is required'
//     }

//     // Company Name (Mandatory for non-proprietorship)
//     if (formData.companyType && formData.companyType !== COMPANY_TYPES.PROPRIETORSHIP) {
//       if (!formData.companyName?.trim()) {
//         newErrors.companyName = 'Company name is required'
//       }
//     }

//     // Company Contact Details
//     if (!validateMobile(formData.companyMobile)) {
//       newErrors.companyMobile = 'Valid company mobile is required'
//     }

//     if (!validateEmail(formData.companyEmail)) {
//       newErrors.companyEmail = 'Valid company email is required'
//     }

//     // Applicant details
//     if (!formData.applicantName?.trim()) {
//       newErrors.applicantName = 'Applicant name is required'
//     }

//     if (!validateMobile(formData.applicantMobile)) {
//       newErrors.applicantMobile = 'Valid applicant mobile is required'
//     }

//     if (!validateEmail(formData.applicantEmail)) {
//       newErrors.applicantEmail = 'Valid applicant email is required'
//     }

//     // Verification checks (Mandatory)
//     if (!formData.verified.applicantMobile) {
//       newErrors.applicantMobile = 'Applicant mobile verification is mandatory'
//     }
//     if (!formData.verified.applicantEmail) {
//       newErrors.applicantEmail = 'Applicant email verification is mandatory'
//     }
//     if (!formData.verified.applicantPan) {
//       newErrors.applicantPan = 'Applicant PAN verification is mandatory'
//     }

//     // Aadhaar KYC is mandatory
//     if (!formData.verified.aadhaarKyc) {
//       newErrors.aadhaar = 'Aadhaar KYC is mandatory'
//     }

//     // Company verification if not proprietorship
//     if (formData.companyType && formData.companyType !== COMPANY_TYPES.PROPRIETORSHIP) {
//       if (!formData.verified.companyMobile) newErrors.companyMobile = 'Company mobile verification is mandatory'
//       if (!formData.verified.companyEmail) newErrors.companyEmail = 'Company email verification is mandatory'
//       if (!formData.verified.companyPan) newErrors.companyPan = 'Company PAN verification is mandatory'
//     }

//     // Mandatory female co-applicant rule if needed
//     if (formData.companyType === COMPANY_TYPES.PROPRIETORSHIP || formData.companyType === COMPANY_TYPES.PVT_LTD) {
//       const hasFemaleCoApp = coApplicants.some(ca => ca.gender === 'Female')
//       if (!hasFemaleCoApp) {
//         newErrors.coApplicants = 'At least one female co-applicant is mandatory for this company type'
//       }
//     }

//     // Co-applicant field validation
//     coApplicants.forEach((ca, index) => {
//       if (!ca.name?.trim()) newErrors[`coApp_${index}_name`] = 'Name is required'
//       if (!validateMobile(ca.mobile)) newErrors[`coApp_${index}_mobile`] = 'Valid mobile is required'
//       if (!ca.gender) newErrors[`coApp_${index}_gender`] = 'Gender is required'
//     })

//     // Contact Person field validation
//     contactPersons.forEach((cp, index) => {
//       if (!cp.name?.trim()) newErrors[`cp_${index}_name`] = 'Name is required'
//       if (!validateMobile(cp.mobile)) newErrors[`cp_${index}_mobile`] = 'Valid mobile is required'
//       if (cp.email && !validateEmail(cp.email)) newErrors[`cp_${index}_email`] = 'Valid email is required'
//       if (!cp.gender) newErrors[`cp_${index}_gender`] = 'Gender is required'
//     })

//     // Address field validation
//     addresses.forEach((addr, index) => {
//       if (!addr.type) newErrors[`addr_${index}_type`] = 'Address type is required'
//       if (!addr.fullAddress?.trim()) newErrors[`addr_${index}_address`] = 'Full address is required'
//       if (!addr.pincode || addr.pincode.length !== 6) newErrors[`addr_${index}_pincode`] = 'Valid 6-digit pincode is required'
//       if (!addr.state) newErrors[`addr_${index}_state`] = 'State is required'
//       if (!addr.city) newErrors[`addr_${index}_city`] = 'City is required'
//     })

//     setErrors(newErrors)
//     return Object.keys(newErrors).length === 0
//   }

//   const validateDocumentsTab = () => {
//     if (!formData.companyType) {
//       return true // Skip validation if no company type selected
//     }

//     const mandatoryDocs = documentChecklist.filter(item => item.mandatory)
//     const uploadedTypes = new Set(documents.map(doc => doc.documentType))
//     const missingMandatory = mandatoryDocs.filter(item => !uploadedTypes.has(item.documentType))

//     if (missingMandatory.length > 0) {
//       alert(`Please upload the following mandatory documents:\\n${missingMandatory.map(d => d.label).join('\\n')}`)
//       return false
//     }

//     return true
//   }

//   const getCustomerData = () => {
//     return {
//       name: formData.applicantName,
//       mobile: formData.applicantMobile,
//       email: formData.applicantEmail,
//       companyType: formData.companyType,
//       companyName: formData.companyName || formData.applicantName,
//       companyMobile: formData.companyMobile,
//       companyEmail: formData.companyEmail,
//       companyPan: formData.companyPan,
//       gstNumber: formData.companyGst,
//       pan: formData.applicantPan,
//       remarks: formData.remarks,
//     }
//   }

//   const handleSaveDraft = async () => {
//     if (!validateBasicKycTab()) {
//       setActiveTab('basic-kyc')
//       return
//     }

//     setIsSubmitting(true)
//     try {
//       const customerData = getCustomerData()


//       let id = caseId
//       if (caseId) {
//         await dispatch(updateCase({ id: caseId, data: customerData })).unwrap()
//       } else {
//         const newCase = await dispatch(createCase(customerData)).unwrap()
//         id = newCase.id
//       }

//       // Save KYC data
//       if (id && applicantKyc.panNumber) {
//         await kycService.createKyc(id, {
//           applicantType: 'applicant',
//           applicantIndex: 0,
//           kycType: 'PAN',
//           kycNumber: applicantKyc.panNumber,
//         })

//         if (applicantKyc.panFile) {
//           await documentService.uploadDocument(
//             id,
//             applicantKyc.panFile,
//             'pan',
//             'applicant',
//             0
//           )
//         }
//       }

//       if (id && formData.companyGst) {
//         await kycService.createKyc(id, {
//           applicantType: 'applicant',
//           applicantIndex: 0,
//           kycType: 'GST',
//           kycNumber: formData.companyGst,
//         })

//         if (applicantKyc.gstFile) {
//           await documentService.uploadDocument(
//             id,
//             applicantKyc.gstFile,
//             'gst_certificate',
//             'applicant',
//             0
//           )
//         }
//       }

//       // Save co-applicants' profiles and KYC
//       for (let i = 0; i < coApplicants.length; i++) {
//         const coApp = coApplicants[i]
//         const coAppKyc = coApplicantKyc[i]

//         // Save/Update co-applicant profile first
//         const coAppResult = await kycService.processCoApplicant({
//           id: coApp.id,
//           customerId: id,
//           name: coApp.name,
//           mobile: coApp.mobile,
//           email: coApp.email,
//           gender: coApp.gender
//         })

//         const coAppId = coAppResult.data.id

//         if (coAppKyc && coAppKyc.panNumber) {
//           await kycService.createKyc(id, {
//             coApplicantId: coAppId,
//             applicantType: 'co-applicant',
//             applicantIndex: i + 1,
//             kycType: 'PAN',
//             kycNumber: coAppKyc.panNumber,
//           })

//           // Upload PAN file as a Document linked to CoApplicant
//           if (coAppKyc.panFile) {
//             await documentService.uploadDocument(
//               id,
//               coAppKyc.panFile,
//               'pan',
//               'co-applicant',
//               i + 1,
//               coAppId
//             )
//           }
//         }
//       }

//       // Save Contact Persons
//       for (let i = 0; i < contactPersons.length; i++) {
//         const cp = contactPersons[i]
//         await kycService.processContactPerson({
//           id: cp.id,
//           customerId: id,
//           name: cp.name,
//           mobile: cp.mobile,
//           email: cp.email,
//           designation: cp.designation,
//           gender: cp.gender
//         })
//       }

//       // Save Addresses
//       for (let i = 0; i < addresses.length; i++) {
//         const addr = addresses[i]
//         await kycService.processAddress({
//           id: addr.id,
//           customerId: id,
//           type: addr.type,
//           fullAddress: addr.fullAddress,
//           pincode: addr.pincode,
//           state: addr.state,
//           city: addr.city
//         })
//       }

//       alert('Draft saved successfully')
//       navigate('/rm/dashboard')
//     } catch (error) {
//       alert('Failed to save draft: ' + error)
//     } finally {
//       setIsSubmitting(false)
//     }
//   }

//   const handleSubmit = async () => {
//     // Validate both tabs
//     if (!validateBasicKycTab()) {
//       setActiveTab('basic-kyc')
//       alert('Please complete all required fields in Basic & KYC tab')
//       return
//     }

//     if (!validateDocumentsTab()) {
//       setActiveTab('documents')
//       return
//     }

//     setIsSubmitting(true)
//     try {
//       let id = caseId
//       const customerData = getCustomerData()

//       if (!id) {
//         const newCase = await dispatch(createCase(customerData)).unwrap()
//         id = newCase.id
//       } else {
//         await dispatch(updateCase({ id, data: customerData })).unwrap()
//       }

//       // Save KYC entries
//       if (applicantKyc.panNumber) {
//         await kycService.createKyc(id, {
//           applicantType: 'applicant',
//           applicantIndex: 0,
//           kycType: 'PAN',
//           kycNumber: applicantKyc.panNumber,
//         })

//         if (applicantKyc.panFile) {
//           await documentService.uploadDocument(
//             id,
//             applicantKyc.panFile,
//             'pan',
//             'applicant',
//             0
//           )
//         }
//       }

//       if (formData.companyGst) {
//         await kycService.createKyc(id, {
//           applicantType: 'applicant',
//           applicantIndex: 0,
//           kycType: 'GST',
//           kycNumber: formData.companyGst,
//         })

//         if (applicantKyc.gstFile) {
//           await documentService.uploadDocument(
//             id,
//             applicantKyc.gstFile,
//             'gst_certificate',
//             'applicant',
//             0
//           )
//         }
//       }

//       // Save co-applicants' profiles and KYC
//       for (let i = 0; i < coApplicants.length; i++) {
//         const coApp = coApplicants[i]
//         const coAppKyc = coApplicantKyc[i]

//         // Save/Update co-applicant profile first
//         const coAppResult = await kycService.processCoApplicant({
//           id: coApp.id,
//           customerId: id,
//           name: coApp.name,
//           mobile: coApp.mobile,
//           email: coApp.email,
//           gender: coApp.gender
//         })

//         const coAppId = coAppResult.data.id

//         if (coAppKyc && coAppKyc.panNumber) {
//           await kycService.createKyc(id, {
//             coApplicantId: coAppId,
//             applicantType: 'co-applicant',
//             applicantIndex: i + 1,
//             kycType: 'PAN',
//             kycNumber: coAppKyc.panNumber,
//           })

//           // Upload PAN file as a Document linked to CoApplicant
//           if (coAppKyc.panFile) {
//             await documentService.uploadDocument(
//               id,
//               coAppKyc.panFile,
//               'pan',
//               'co-applicant',
//               i + 1,
//               coAppId
//             )
//           }
//         }
//       }

//       // Save Contact Persons
//       for (let i = 0; i < contactPersons.length; i++) {
//         const cp = contactPersons[i]
//         await kycService.processContactPerson({
//           id: cp.id,
//           customerId: id,
//           name: cp.name,
//           mobile: cp.mobile,
//           email: cp.email,
//           designation: cp.designation,
//           gender: cp.gender
//         })
//       }

//       // Save Addresses
//       for (let i = 0; i < addresses.length; i++) {
//         const addr = addresses[i]
//         await kycService.processAddress({
//           id: addr.id,
//           customerId: id,
//           type: addr.type,
//           fullAddress: addr.fullAddress,
//           pincode: addr.pincode,
//           state: addr.state,
//           city: addr.city
//         })
//       }

//       await dispatch(submitCase({ id })).unwrap()
//       alert('Case submitted successfully')
//       navigate('/rm/dashboard')
//     } catch (error) {
//       alert('Failed to submit case: ' + error)
//     } finally {
//       setIsSubmitting(false)
//     }
//   }

//   const saveFullCase = async (id) => {
//   const customerData = getCustomerData()

//   if (!id) {
//     const newCase = await dispatch(createCase(customerData)).unwrap()
//     id = newCase.id
//   } else {
//     await dispatch(updateCase({ id, data: customerData })).unwrap()
//   }

//   // Parallel saves instead of sequential
//   await Promise.all([
//     saveApplicantKyc(id),
//     saveCoApplicants(id),
//     saveContactPersons(id),
//     saveAddresses(id),
//   ])

//   return id
// }


//   const confirmSubmit = async () => {
//     // 1. Validation
//     if (!validateBasicKycTab()) {
//       setActiveTab('basic-kyc')
//       setShowSubmitModal(false)
//       alert('Please complete all required fields in Basic & KYC tab')
//       return
//     }
//     if (!validateDocumentsTab()) {
//       setActiveTab('documents')
//       setShowSubmitModal(false)
//       return
//     }

//     setIsSubmitting(true)
//     try {
//       // 2. Initial Case Creation/Update
//       let id = caseId
//       const customerData = {
//         ...getCustomerData(),
//         pushedTo: Object.keys(submissionTargets).filter(k => submissionTargets[k].selected).join(','),
//       }

//       if (!id) {
//         const newCase = await dispatch(createCase(customerData)).unwrap()
//         id = newCase.id
//       } else {
//         await dispatch(updateCase({ id, data: customerData })).unwrap()
//       }

//       // Note: Full KYC and document saving logic would typically be called here too.
//       // Re-using the core multi-push field we added to the entity.

//       // 3. Submit to main workflow if 'credit' selected
//       if (submissionTargets.credit.selected) {
//         await dispatch(submitCase({
//           id,
//           pushedTo: customerData.pushedTo
//         })).unwrap()
//       }

//       alert(`Case successfully pushed to selected entities: ${customerData.pushedTo}`)
//       navigate('/rm/dashboard')
//     } catch (error) {
//       alert('Submission failed: ' + error.message)
//     } finally {
//       setIsSubmitting(false)
//       setShowSubmitModal(false)
//     }
//   }

//   const handleDocumentUploaded = (doc) => {
//     setDocuments(prev => {
//       const exists = prev.find(d => d.id === doc.id)
//       if (exists) {
//         return prev.map(d => d.id === doc.id ? doc : d)
//       }
//       return [...prev, doc]
//     })
//   }

//   const handleDocumentRemoved = (docId) => {
//     setDocuments(prev => prev.filter(doc => doc.id !== docId))
//   }

//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-3xl font-bold text-gray-900">New Customer Onboarding</h1>
//         <p className="text-gray-600 mt-2">Complete KYC and upload required documents</p>
//       </div>

//       {/* Tab Navigation */}
//       <div className="border-b border-gray-200">
//         <nav className="-mb-px flex space-x-8">
//           <button
//             onClick={() => setActiveTab('basic-kyc')}
//             className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'basic-kyc'
//               ? 'border-primary-600 text-primary-600'
//               : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//           >
//             Basic & KYC
//           </button>
//           <button
//             onClick={() => setActiveTab('documents')}
//             className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'documents'
//               ? 'border-primary-600 text-primary-600'
//               : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//           >
//             Documents
//           </button>
//         </nav>
//       </div>

//       {/* Tab Content */}
//       <div className="card space-y-6">
//         {activeTab === 'basic-kyc' && (
//           <div className="space-y-8">
//             {/* --- Section 1: Company Details --- */}
//             <div className="space-y-6">
//               <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Company Details</h3>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Company Type <span className="text-red-500">*</span>
//                   </label>
//                   <select
//                     value={formData.companyType}
//                     onChange={(e) => setFormData({ ...formData, companyType: e.target.value })}
//                     className="input-field"
//                   >
//                     <option value="">Select company type</option>
//                     {Object.values(COMPANY_TYPES).map((type) => (
//                       <option key={type} value={type}>{type}</option>
//                     ))}
//                   </select>
//                   {errors.companyType && (
//                     <p className="text-red-500 text-xs mt-1">{errors.companyType}</p>
//                   )}
//                 </div>

//                 {formData.companyType && formData.companyType !== COMPANY_TYPES.PROPRIETORSHIP && (
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                       Company Name <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="text"
//                       value={formData.companyName}
//                       onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
//                       className="input-field"
//                       placeholder="Enter company name"
//                     />
//                   </div>
//                 )}
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 {/* Company Mobile */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Company Mobile Number <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex space-x-2">
//                     <input
//                       type="tel"
//                       value={formData.companyMobile}
//                       onChange={(e) => setFormData({ ...formData, companyMobile: e.target.value })}
//                       className="input-field flex-1"
//                       placeholder="Enter mobile"
//                       maxLength={10}
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleVerify('companyMobile', formData.companyMobile)}
//                       disabled={loadingStates['companyMobile'] || formData.verified.companyMobile}
//                       className={`btn-${formData.verified.companyMobile ? 'success' : 'secondary'} whitespace-nowrap min-w-[100px] flex items-center justify-center`}
//                     >
//                       {loadingStates['companyMobile'] ? <LoadingSpinner size="sm" /> : (formData.verified.companyMobile ? '✓ Verified' : 'Verify')}
//                     </button>
//                   </div>
//                 </div>

//                 {/* Company Business Email */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Business Email ID <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex space-x-2">
//                     <input
//                       type="email"
//                       value={formData.companyEmail}
//                       onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
//                       className="input-field flex-1"
//                       placeholder="Enter business email"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleVerify('companyEmail', formData.companyEmail)}
//                       disabled={loadingStates['companyEmail'] || formData.verified.companyEmail}
//                       className={`btn-${formData.verified.companyEmail ? 'success' : 'secondary'} whitespace-nowrap min-w-[100px] flex items-center justify-center`}
//                     >
//                       {loadingStates['companyEmail'] ? <LoadingSpinner size="sm" /> : (formData.verified.companyEmail ? '✓ Verified' : 'Verify')}
//                     </button>
//                   </div>
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 {/* Company PAN Upload */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Company PAN Card Upload <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex items-center space-x-2">
//                     <input
//                       type="file"
//                       accept="image/*,.pdf"
//                       onChange={handleCompanyPanUpload}
//                       className="input-field flex-1"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleVerify('companyPan', formData.companyPan)}
//                       disabled={loadingStates['companyPan'] || formData.verified.companyPan}
//                       className={`btn-${formData.verified.companyPan ? 'success' : 'secondary'} whitespace-nowrap min-w-[100px] flex items-center justify-center`}
//                     >
//                       {loadingStates['companyPan'] ? <LoadingSpinner size="sm" /> : (formData.verified.companyPan ? '✓ Verified' : 'Verify')}
//                     </button>
//                   </div>
//                   {formData.companyPan && <p className="text-xs text-blue-600 mt-1">PAN: {formData.companyPan}</p>}
//                 </div>

//                 {/* GST Certificate Upload */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     GST Certificate Upload <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex items-center space-x-2">
//                     <input
//                       type="file"
//                       accept="image/*,.pdf"
//                       onChange={handleGstUpload}
//                       className="input-field flex-1"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleVerify('companyGst', formData.companyGst)}
//                       disabled={loadingStates['companyGst'] || formData.verified.companyGst || !formData.companyGst}
//                       className={`btn-${formData.verified.companyGst ? 'success' : 'secondary'} whitespace-nowrap min-w-[100px] flex items-center justify-center`}
//                     >
//                       {loadingStates['companyGst'] ? <LoadingSpinner size="sm" /> : (formData.verified.companyGst ? '✓ Verified' : 'Verify GST')}
//                     </button>
//                   </div>
//                   <input
//                     type="text"
//                     placeholder="Enter GST Number"
//                     className="input-field mt-2"
//                     value={formData.companyGst}
//                     onChange={(e) => setFormData({ ...formData, companyGst: e.target.value.toUpperCase() })}
//                   />
//                 </div>
//               </div>
//             </div>

//             {/* --- Section 2: Applicant Details --- */}
//             <div className="space-y-6 border-t pt-6">
//               <h3 className="text-xl font-bold text-gray-900 border-b pb-2">Applicant Details</h3>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 {/* Applicant Name */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Applicant Name <span className="text-red-500">*</span>
//                   </label>
//                   <input
//                     type="text"
//                     value={formData.applicantName}
//                     onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
//                     className="input-field"
//                     placeholder="Enter applicant name"
//                   />
//                 </div>

//                 {/* Applicant Mobile */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Applicant Mobile Number <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex space-x-2">
//                     <input
//                       type="tel"
//                       value={formData.applicantMobile}
//                       onChange={(e) => setFormData({ ...formData, applicantMobile: e.target.value })}
//                       className="input-field flex-1"
//                       placeholder="Enter mobile"
//                       maxLength={10}
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleVerify('applicantMobile', formData.applicantMobile)}
//                       disabled={loadingStates['applicantMobile'] || formData.verified.applicantMobile}
//                       className={`btn-${formData.verified.applicantMobile ? 'success' : 'secondary'} whitespace-nowrap min-w-[100px] flex items-center justify-center`}
//                     >
//                       {loadingStates['applicantMobile'] ? <LoadingSpinner size="sm" /> : (formData.verified.applicantMobile ? '✓ Verified' : 'Verify')}
//                     </button>
//                   </div>
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 {/* Applicant Email */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Applicant Email ID <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex space-x-2">
//                     <input
//                       type="email"
//                       value={formData.applicantEmail}
//                       onChange={(e) => setFormData({ ...formData, applicantEmail: e.target.value })}
//                       className="input-field flex-1"
//                       placeholder="Enter email"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleVerify('applicantEmail', formData.applicantEmail)}
//                       disabled={loadingStates['applicantEmail'] || formData.verified.applicantEmail}
//                       className={`btn-${formData.verified.applicantEmail ? 'success' : 'secondary'} whitespace-nowrap min-w-[100px] flex items-center justify-center`}
//                     >
//                       {loadingStates['applicantEmail'] ? <LoadingSpinner size="sm" /> : (formData.verified.applicantEmail ? '✓ Verified' : 'Verify')}
//                     </button>
//                   </div>
//                 </div>

//                 {/* Applicant PAN */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Applicant PAN upload <span className="text-red-500">*</span>
//                   </label>
//                   <div className="flex items-center space-x-2">
//                     <input
//                       type="file"
//                       accept="image/*,.pdf"
//                       onChange={handleApplicantPanUpload}
//                       className="input-field flex-1"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => handleVerify('applicantPan', formData.applicantPan)}
//                       disabled={loadingStates['applicantPan'] || formData.verified.applicantPan}
//                       className={`btn-${formData.verified.applicantPan ? 'success' : 'secondary'} whitespace-nowrap min-w-[100px] flex items-center justify-center`}
//                     >
//                       {loadingStates['applicantPan'] ? <LoadingSpinner size="sm" /> : (formData.verified.applicantPan ? '✓ Verified' : 'Verify')}
//                     </button>
//                   </div>
//                   {formData.applicantPan && <p className="text-xs text-blue-600 mt-1">PAN: {formData.applicantPan}</p>}
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 {/* Aadhaar KYC - MANDATORY */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Complete Aadhaar KYC <span className="text-red-500">*</span>
//                   </label>
//                   <button
//                     type="button"
//                     onClick={handleAadhaarKyc}
//                     disabled={loadingStates['aadhaarKyc'] || formData.verified.aadhaarKyc}
//                     className={`btn-${formData.verified.aadhaarKyc ? 'success' : 'primary'} w-full`}
//                   >
//                     {formData.verified.aadhaarKyc ? '✓ Aadhaar Verified' : (loadingStates['aadhaarKyc'] ? 'Processing...' : 'Proceed with Aadhaar KYC')}
//                   </button>
//                 </div>

//                 {/* Live Photo Capture - OPTIONAL */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     Live Photo Capture <span className="text-gray-400 font-normal">(Optional)</span>
//                   </label>
//                   <button
//                     type="button"
//                     onClick={() => {
//                       setCameraTarget('live-photo');
//                       setShowCamera(true);
//                     }}
//                     className="btn-secondary w-full flex items-center justify-center space-x-2"
//                   >
//                     <FiCamera />
//                     <span>Take Live Photo</span>
//                   </button>
//                   {documents.some(d => d.documentType === 'live_photo') && (
//                     <p className="text-xs text-green-600 mt-1">✓ Photo Captured</p>
//                   )}
//                 </div>
//               </div>
//             </div>

//             {/* --- Section 3: Co-Applicants / Co-Borrowers --- */}
//             <div className="border-t pt-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-xl font-bold text-gray-900">Co-Applicants / Co-Borrowers</h3>
//                 <button
//                   type="button"
//                   onClick={addCoApplicant}
//                   className="btn-secondary flex items-center space-x-2"
//                 >
//                   <FiPlus className="h-4 w-4" />
//                   <span>Add Co-Applicant</span>
//                 </button>
//               </div>

//               {coApplicants.length === 0 ? (
//                 <p className="text-gray-500 text-sm italic">No co-applicants added yet</p>
//               ) : (
//                 <div className="space-y-6">
//                   {coApplicants.map((coApp, index) => (
//                     <CoApplicantForm
//                       key={coApp.id || coApp.localKey}
//                       index={index}
//                       data={coApp}
//                       onChange={(index, data) =>
//   updateCoApplicant(coApp.id || coApp.localKey, data)
// }
// onRemove={() =>
//   removeCoApplicant(coApp.id || coApp.localKey)
// }

//                       onPanUpload={handleCoApplicantPanUpload}
//                       kycData={coApplicantKyc[coApp.id || coApp.localKey] || {}}
//                       customerId={caseId}
//                       onVerify={handleVerify}
//                       loadingStates={loadingStates}
//                       verificationStatus={verificationStatuses.find(s => s.coApplicantId === coApp.id) || {}}
//                     />
//                   ))}
//                 </div>
//               )}
//             </div>

//             {/* Contact Persons Section */}
//             <div className="border-t border-gray-200 pt-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-lg font-semibold text-gray-900">Contact Person Details</h3>
//                 <button
//                   type="button"
//                   onClick={addContactPerson}
//                   className="btn-secondary flex items-center space-x-2"
//                 >
//                   <FiPlus className="h-4 w-4" />
//                   <span>Add Contact Person</span>
//                 </button>
//               </div>

//               {contactPersons.length === 0 ? (
//                 <p className="text-gray-500 text-sm">No contact persons added yet</p>
//               ) : (
//                 <div className="space-y-4">
//                   {contactPersons.map((cp, index) => (
//                     <ContactPersonForm
//                       key={cp.id || cp.localKey}
//                       index={index}
//                       data={cp}
//                       onChange={updateContactPerson}
//                       onRemove={removeContactPerson}
//                       errors={{
//                         name: errors[`cp_${index}_name`],
//                         mobile: errors[`cp_${index}_mobile`],
//                         email: errors[`cp_${index}_email`],
//                         gender: errors[`cp_${index}_gender`]
//                       }}
//                       readOnly={isReadOnly}
//                     />
//                   ))}
//                 </div>
//               )}
//             </div>

//             {/* Address Details Section */}
//             <div className="border-t border-gray-200 pt-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-lg font-semibold text-gray-900">Address Details</h3>
//                 <button
//                   type="button"
//                   onClick={addAddress}
//                   className="btn-secondary flex items-center space-x-2"
//                 >
//                   <FiPlus className="h-4 w-4" />
//                   <span>Add Address Details</span>
//                 </button>
//               </div>

//               {addresses.length === 0 ? (
//                 <p className="text-gray-500 text-sm">No addresses added yet</p>
//               ) : (
//                 <div className="space-y-4">
//                   {addresses.map((addr, index) => (
//                     <AddressForm
//                       key={addr.id || addr.localKey}
//                       index={index}
//                       data={addr}
//                       onChange={updateAddress}
//                       onRemove={removeAddress}
//                       readOnly={isReadOnly}
//                       errors={{
//                         type: errors[`addr_${index}_type`],
//                         fullAddress: errors[`addr_${index}_address`],
//                         pincode: errors[`addr_${index}_pincode`],
//                         state: errors[`addr_${index}_state`],
//                         city: errors[`addr_${index}_city`]
//                       }}
//                     />
//                   ))}
//                 </div>
//               )}
//             </div>

//             {/* RM Remarks */}
//             <div className="card mt-6">
//               <label className="block text-sm font-medium text-gray-700 mb-2 font-bold uppercase tracking-wider text-primary-600">
//                 RM Remarks
//               </label>
//               <textarea
//                 value={formData.remarks}
//                 onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
//                 className="input-field w-full"
//                 rows={4}
//                 placeholder="Add any general remarks for the review team..."
//               />
//               <p className="text-[10px] text-gray-400 mt-1 italic">Note: These remarks apply to the entire case.</p>
//             </div>
//           </div>

//         )}

//         {activeTab === 'documents' && (
//           <DocumentChecklistUploader
//             checklist={documentChecklist}
//             uploadedDocuments={documents}
//             customerId={caseId || currentCase?.id}
//             onDocumentUploaded={handleDocumentUploaded}
//             onDocumentRemoved={handleDocumentRemoved}
//           />
//         )}

//         {/* Action Buttons */}
//         <div className="flex space-x-3 pt-4 border-t border-gray-200">
//           <button
//             onClick={handleSaveDraft}
//             disabled={isSubmitting}
//             className="btn-secondary"
//           >
//             {isSubmitting ? <LoadingSpinner size="sm" /> : 'Save as Draft'}
//           </button>

//           <button
//             onClick={handleBureauCheck}
//             disabled={isSubmitting || isVerifying || !caseId}
//             className="btn-secondary flex items-center space-x-2"
//           >
//             {isVerifying ? <LoadingSpinner size="sm" /> : 'Check Bureau'}
//           </button>

//           <button
//             onClick={() => setShowSubmitModal(true)}
//             disabled={isSubmitting}
//             className="btn-primary"
//           >
//             {isSubmitting ? <LoadingSpinner size="sm" /> : 'Submit Case'}
//           </button>
//         </div>
//       </div>

//       {/* OTP Verification Modal */}
//       {showOtpModal && (
//         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
//           <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
//             <h2 className="text-xl font-bold text-gray-900">Verify {otpData.type === 'mobile' ? 'Mobile' : 'Email'}</h2>
//             <p className="text-sm text-gray-500">
//               Enter the OTP sent to <b>{otpData.value}</b>
//             </p>

//             <input
//               type="text"
//               value={otpValue}
//               onChange={(e) => setOtpValue(e.target.value)}
//               className="input-field text-center text-2xl tracking-widest"
//               placeholder="0000"
//               maxLength={6}
//             />

//             <div className="flex space-x-3 mt-6">
//               <button
//                 onClick={() => setShowOtpModal(false)}
//                 className="flex-1 btn-secondary"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleOtpVerify}
//                 disabled={isVerifying}
//                 className="flex-1 btn-primary"
//               >
//                 {isVerifying ? <LoadingSpinner size="sm" /> : 'Verify OTP'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Modal for Multi-Entity Submission */}
//       {
//         showSubmitModal && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
//             <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
//               <div>
//                 <h2 className="text-2xl font-bold text-gray-900">Push Case to Entities</h2>
//                 <p className="text-sm text-gray-500 mt-1">Select one or more entities to submit this case.</p>
//               </div>

//               <div className="space-y-4">
//                 {Object.keys(submissionTargets)
//                   .filter(target => target !== 'credit') // Hiding Credit Team option as requested
//                   .map(target => (
//                     <div key={target} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
//                       <label className="flex items-center space-x-3 cursor-pointer mb-3">
//                         <input
//                           type="checkbox"
//                           checked={submissionTargets[target].selected}
//                           onChange={(e) => setSubmissionTargets({
//                             ...submissionTargets,
//                             [target]: { ...submissionTargets[target], selected: e.target.checked }
//                           })}
//                           className="rounded h-5 w-5 text-primary-600"
//                         />
//                         <span className="font-bold text-gray-800">{target.toUpperCase()}</span>
//                       </label>

//                       {submissionTargets[target].selected && (
//                         <div className="space-y-3 pl-8 animate-fadeIn">
//                           <div>
//                             <label className="block text-xs font-bold text-gray-600 uppercase mb-1">To (Emails)</label>
//                             <input
//                               type="text"
//                               value={submissionTargets[target].email}
//                               onChange={(e) => setSubmissionTargets({
//                                 ...submissionTargets,
//                                 [target]: { ...submissionTargets[target], email: e.target.value }
//                               })}
//                               className="input-field py-1"
//                               placeholder="comma-separated emails"
//                             />
//                           </div>
//                           <div>
//                             <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject</label>
//                             <input
//                               type="text"
//                               value={submissionTargets[target].subject}
//                               onChange={(e) => setSubmissionTargets({
//                                 ...submissionTargets,
//                                 [target]: { ...submissionTargets[target], subject: e.target.value }
//                               })}
//                               className="input-field py-1"
//                             />
//                           </div>
//                           <div>
//                             <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email Body</label>
//                             <textarea
//                               value={submissionTargets[target].body}
//                               onChange={(e) => setSubmissionTargets({
//                                 ...submissionTargets,
//                                 [target]: { ...submissionTargets[target], body: e.target.value }
//                               })}
//                               className="input-field py-1"
//                               rows={2}
//                             />
//                           </div>
//                         </div>
//                       )}
//                     </div>
//                   ))}
//               </div>

//               <div className="flex space-x-3">
//                 <button
//                   onClick={() => setShowSubmitModal(false)}
//                   className="flex-1 btn-secondary"
//                   disabled={isSubmitting}
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   onClick={confirmSubmit}
//                   className="flex-1 btn-primary"
//                   disabled={isSubmitting || !Object.values(submissionTargets).some(t => t.selected)}
//                 >
//                   {isSubmitting ? <LoadingSpinner size="sm" /> : 'Confirm & Push Case'}
//                 </button>
//               </div>
//             </div>
//           </div>
//         )
//       }

//       {/* Live Camera Modal */}
//       {
//         showCamera && (
//           <LivePhotoCapture
//             onCapture={handleCameraCapture}
//             onCancel={() => {
//               setShowCamera(false);
//               setCameraTarget(null);
//             }}
//             label={cameraTarget === 'applicant-pan' ? "Capture PAN Card" : "Take Live Photo"}
//           />
//         )
//       }
//     </div >
//   )
// }

// export default NewCustomerOnboarding
