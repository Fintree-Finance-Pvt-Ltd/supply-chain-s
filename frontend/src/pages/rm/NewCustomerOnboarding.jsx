import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { createCase, updateCase, submitCase, fetchCaseById } from '../../store/slices/caseSlice'
import { documentService } from '../../services/documentService'
import kycService from '../../services/kycService'
import DocumentChecklistUploader from '../../components/DocumentChecklistUploader'
import CoApplicantForm from '../../components/CoApplicantForm'
import ContactPersonForm from '../../components/ContactPersonForm'
import AddressForm from '../../components/AddressForm'
import LoadingSpinner from '../../components/LoadingSpinner'
import { validatePAN, validateMobile, validateEmail } from '../../utils/validation'
import { COMPANY_TYPES, getDocumentChecklist } from '../../config/documentChecklists'
import { FiUpload, FiPlus, FiCamera } from 'react-icons/fi';
import LivePhotoCapture from '../../components/LivePhotoCapture';

const NewCustomerOnboarding = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const caseId = searchParams.get('id')
  const { currentCase, isLoading } = useSelector((state) => state.cases)

  // Tab state
  const [activeTab, setActiveTab] = useState('basic-kyc')

  // Form data
  const [formData, setFormData] = useState({
    companyType: '',
    companyName: '',
    customerName: '',
    mobileNumber: '',
    email: '',
    gstNumber: '',
    electricityBillNumber: '',
  })

  // KYC data for applicant
  const [applicantKyc, setApplicantKyc] = useState({
    panNumber: '',
    panFile: null,
    gstFile: null,
  })

  // Co-applicants
  const [coApplicants, setCoApplicants] = useState([])

  // Contact Persons
  const [contactPersons, setContactPersons] = useState([])

  // Addresses
  const [addresses, setAddresses] = useState([])

  // Co-applicant KYC data
  const [coApplicantKyc, setCoApplicantKyc] = useState({})

  const [documents, setDocuments] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submissionTargets, setSubmissionTargets] = useState({
    credit: { selected: true, email: 'credit_l1@scf.com', subject: 'New Case for Review', body: 'Please review this new customer onboarding case.' },
    kite: { selected: false, email: 'kite_partners@kite.com', subject: 'New Case Lead', body: 'We have a new lead for you.' },
    muthoot: { selected: false, email: 'support@muthoot.com', subject: 'Customer Onboarding - Muthoot', body: 'New case submission for Muthoot process.' },
    chola: { selected: false, email: 'info@chola.com', subject: 'Lead Referral', body: 'Referring a new potential customer.' },
  })

  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState(null); // 'applicant-pan', 'live-photo', etc.

  useEffect(() => {
    if (caseId) {
      dispatch(fetchCaseById(caseId))
    }
  }, [caseId, dispatch])

  useEffect(() => {
    if (currentCase && caseId) {
      setFormData({
        companyType: currentCase.companyType || '',
        companyName: currentCase.companyName || '',
        customerName: currentCase.name || currentCase.customerName || '',
        mobileNumber: currentCase.mobile || currentCase.mobileNumber || '',
        email: currentCase.email || '',
        gstNumber: currentCase.gstNumber || '',
        electricityBillNumber: currentCase.electricityBillNo || currentCase.electricityBillNumber || '',
      })
      setDocuments(currentCase.documents || [])

      // Load KYC data if it exists
      if (currentCase.kycDetails && currentCase.kycDetails.length > 0) {
        const panKyc = currentCase.kycDetails.find(k => k.kycType === 'PAN' && k.applicantType === 'applicant')
        if (panKyc) {
          setApplicantKyc(prev => ({ ...prev, panNumber: panKyc.kycNumber }))
        }
      }

      // Load co-applicants
      if (currentCase.coApplicants && currentCase.coApplicants.length > 0) {
        const loadedCoApps = currentCase.coApplicants.map(ca => ({
          id: ca.id,
          name: ca.name,
          mobile: ca.mobile,
          email: ca.email || '',
          gender: ca.gender,
        }))
        setCoApplicants(loadedCoApps)

        // Load co-applicant KYC
        const loadedCoAppKyc = {}
        currentCase.coApplicants.forEach((ca, index) => {
          if (ca.kycDetails && ca.kycDetails.length > 0) {
            const panKyc = ca.kycDetails.find(k => k.kycType === 'PAN')
            if (panKyc) {
              loadedCoAppKyc[index] = {
                panNumber: panKyc.kycNumber,
                panFile: null,
              }
            }
          }
        })
        setCoApplicantKyc(loadedCoAppKyc)
      }

      // Load Contact Persons
      if (currentCase.contactPersons && currentCase.contactPersons.length > 0) {
        setContactPersons(currentCase.contactPersons.map(cp => ({
          id: cp.id,
          name: cp.name,
          mobile: cp.mobile,
          email: cp.email || '',
          designation: cp.designation || '',
          gender: cp.gender,
        })))
      }

      // Load Addresses
      if (currentCase.addresses && currentCase.addresses.length > 0) {
        setAddresses(currentCase.addresses.map(addr => ({
          id: addr.id,
          type: addr.type,
          fullAddress: addr.fullAddress,
          pincode: addr.pincode,
          state: addr.state,
          city: addr.city,
        })))
      }
    }
  }, [currentCase, caseId])

  // Get document checklist based on company type
  const documentChecklist = getDocumentChecklist(formData.companyType)

  // PAN Upload and OCR for applicant
  const handleApplicantPanUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsOcrProcessing(true)
    try {
      const result = await kycService.runPanOcr(file)
      if (result.success) {
        setApplicantKyc(prev => ({
          ...prev,
          panNumber: result.data.panNumber,
          panFile: file,
        }))
        setFormData(prev => ({
          ...prev,
          customerName: result.data.name,
        }))
        alert(`OCR completed! PAN: ${result.data.panNumber}, Name: ${result.data.name}`)
      }
    } catch (error) {
      alert('OCR failed: ' + error.message)
    } finally {
      setIsOcrProcessing(false)
    }
  }

  const handleCameraCapture = (file) => {
    if (cameraTarget === 'applicant-pan') {
      // Simulate event object for handleApplicantPanUpload
      handleApplicantPanUpload({ target: { files: [file] } });
    } else if (cameraTarget === 'live-photo') {
      // Handle specific live photo document upload
      // We'll add it to the documents list directly
      const doc = {
        id: Date.now(),
        fileName: 'live_photo_capture.jpg',
        documentType: 'live_photo',
        file: file,
        status: 'pending',
        uploadedBy: 'RM',
        createdAt: new Date().toISOString()
      };
      setDocuments(prev => [...prev, doc]);

      // Also upload immediately to server if Case ID exists
      if (caseId) {
        documentService.uploadDocument(caseId, file, 'live_photo')
          .then(() => alert('Live photo uploaded successfully'))
          .catch(err => alert('Failed to upload live photo: ' + err.message));
      }
    }
    setShowCamera(false);
    setCameraTarget(null);
  };

  const handlePanVerify = async () => {
    if (!applicantKyc.panNumber) {
      alert('Please upload PAN first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyPan(applicantKyc.panNumber)
      if (result.success) {
        alert(result.message || 'PAN verified successfully')
      }
    } catch (error) {
      alert('PAN verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleGstUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setApplicantKyc(prev => ({
      ...prev,
      gstFile: file,
    }))
    alert('GST document uploaded')
  }

  const handleGstVerify = async () => {
    if (!formData.gstNumber) {
      alert('Please enter GST number first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyGst(formData.gstNumber)
      if (result.success) {
        alert(result.message || 'GST verified successfully')
      }
    } catch (error) {
      alert('GST verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleMobileVerify = async () => {
    if (!formData.mobileNumber) {
      alert('Please enter mobile number first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyMobile(formData.mobileNumber)
      if (result.success) {
        alert(result.message || 'Mobile verified successfully')
      }
    } catch (error) {
      alert('Mobile verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleEmailVerify = async () => {
    if (!formData.email) {
      alert('Please enter email first')
      return
    }

    setIsVerifying(true)
    try {
      const result = await kycService.verifyEmail(formData.email)
      if (result.success) {
        alert(result.message || 'Email verified successfully')
      }
    } catch (error) {
      alert('Email verification failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleAadhaarKyc = async () => {
    setIsVerifying(true)
    try {
      const result = await kycService.initiateAadhaarKyc('')
      if (result.success) {
        alert(result.message || 'Aadhaar KYC initiated successfully')
      }
    } catch (error) {
      alert('Aadhaar KYC failed: ' + error.message)
    } finally {
      setIsVerifying(false)
    }
  }

  // Co-Applicant Management
  const addCoApplicant = () => {
    setCoApplicants([...coApplicants, { name: '', mobile: '', email: '' }])
  }

  const removeCoApplicant = (index) => {
    setCoApplicants(coApplicants.filter((_, i) => i !== index))
    // Remove KYC data for this co-applicant
    const newKyc = { ...coApplicantKyc }
    delete newKyc[index]
    setCoApplicantKyc(newKyc)
  }

  const updateCoApplicant = (index, data) => {
    const updated = [...coApplicants]
    updated[index] = data
    setCoApplicants(updated)
  }

  const handleCoApplicantPanUpload = (index, file, panNumber) => {
    setCoApplicantKyc(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        panNumber,
        panFile: file,
      }
    }))
  }

  // Contact Person Management
  const addContactPerson = () => {
    setContactPersons([...contactPersons, { name: '', mobile: '', email: '', designation: '', gender: '' }])
  }

  const removeContactPerson = async (index) => {
    const personToRemove = contactPersons[index]
    if (personToRemove.id) {
      if (window.confirm('Are you sure you want to delete this contact person?')) {
        try {
          await kycService.deleteContactPerson(personToRemove.id)
        } catch (error) {
          console.error('Failed to delete contact person:', error)
        }
      } else {
        return
      }
    }
    setContactPersons(contactPersons.filter((_, i) => i !== index))
  }

  const updateContactPerson = (index, data) => {
    const updated = [...contactPersons]
    updated[index] = data
    setContactPersons(updated)
  }

  // Address Management
  const addAddress = () => {
    setAddresses([...addresses, { type: '', fullAddress: '', pincode: '', state: '', city: '' }])
  }

  const removeAddress = async (index) => {
    const addressToRemove = addresses[index]
    if (addressToRemove.id) {
      if (window.confirm('Are you sure you want to delete this address?')) {
        try {
          await kycService.deleteAddress(addressToRemove.id)
        } catch (error) {
          console.error('Failed to delete address:', error)
        }
      } else {
        return
      }
    }
    setAddresses(addresses.filter((_, i) => i !== index))
  }

  const updateAddress = (index, data) => {
    const updated = [...addresses]
    updated[index] = data
    setAddresses(updated)
  }

  const validateBasicKycTab = () => {
    const newErrors = {}

    if (!formData.companyType) {
      newErrors.companyType = 'Company type is required'
    }

    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Entity name is required'
    }

    if (!validateMobile(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Valid mobile number is required'
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Valid email is required'
    }

    if (!applicantKyc.panNumber) {
      newErrors.pan = 'PAN is required - please upload PAN card'
    }

    // Mandatory female co-applicant rule
    if (formData.companyType === COMPANY_TYPES.PROPRIETORSHIP || formData.companyType === COMPANY_TYPES.PVT_LTD) {
      const hasFemaleCoApp = coApplicants.some(ca => ca.gender === 'Female')
      if (!hasFemaleCoApp) {
        newErrors.coApplicants = 'At least one female co-applicant is mandatory for this company type'
      }
    }

    // Co-applicant field validation
    coApplicants.forEach((ca, index) => {
      if (!ca.name) newErrors[`coApp_${index}_name`] = 'Name is required'
      if (!validateMobile(ca.mobile)) newErrors[`coApp_${index}_mobile`] = 'Valid mobile is required'
      if (!ca.gender) newErrors[`coApp_${index}_gender`] = 'Gender is required'
    })

    // Contact Person field validation
    contactPersons.forEach((cp, index) => {
      if (!cp.name) newErrors[`cp_${index}_name`] = 'Name is required'
      if (!validateMobile(cp.mobile)) newErrors[`cp_${index}_mobile`] = 'Valid mobile is required'
      if (cp.email && !validateEmail(cp.email)) newErrors[`cp_${index}_email`] = 'Valid email is required'
      if (!cp.gender) newErrors[`cp_${index}_gender`] = 'Gender is required'
    })

    // Address field validation
    addresses.forEach((addr, index) => {
      if (!addr.type) newErrors[`addr_${index}_type`] = 'Address type is required'
      if (!addr.fullAddress) newErrors[`addr_${index}_address`] = 'Full address is required'
      if (!addr.pincode || addr.pincode.length !== 6) newErrors[`addr_${index}_pincode`] = 'Valid 6-digit pincode is required'
      if (!addr.state) newErrors[`addr_${index}_state`] = 'State is required'
      if (!addr.city) newErrors[`addr_${index}_city`] = 'City is required'
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateDocumentsTab = () => {
    if (!formData.companyType) {
      return true // Skip validation if no company type selected
    }

    const mandatoryDocs = documentChecklist.filter(item => item.mandatory)
    const uploadedTypes = new Set(documents.map(doc => doc.documentType))
    const missingMandatory = mandatoryDocs.filter(item => !uploadedTypes.has(item.documentType))

    if (missingMandatory.length > 0) {
      alert(`Please upload the following mandatory documents:\\n${missingMandatory.map(d => d.label).join('\\n')}`)
      return false
    }

    return true
  }

  const handleSaveDraft = async () => {
    if (!validateBasicKycTab()) {
      setActiveTab('basic-kyc')
      return
    }

    setIsSubmitting(true)
    try {
      const customerData = {
        name: formData.customerName,
        mobile: formData.mobileNumber,
        email: formData.email,
        companyType: formData.companyType,
        companyName: formData.companyName,
        gstNumber: formData.gstNumber || null,
        electricityBillNo: formData.electricityBillNumber || null,
      }

      let id = caseId
      if (caseId) {
        await dispatch(updateCase({ id: caseId, data: customerData })).unwrap()
      } else {
        const newCase = await dispatch(createCase(customerData)).unwrap()
        id = newCase.id
      }

      // Save KYC data
      if (id && applicantKyc.panNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'PAN',
          kycNumber: applicantKyc.panNumber,
        })

        if (applicantKyc.panFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.panFile,
            'pan',
            'applicant',
            0
          )
        }
      }

      if (id && formData.gstNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'GST',
          kycNumber: formData.gstNumber,
        })

        if (applicantKyc.gstFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.gstFile,
            'gst_certificate',
            'applicant',
            0
          )
        }
      }

      // Save co-applicants' profiles and KYC
      for (let i = 0; i < coApplicants.length; i++) {
        const coApp = coApplicants[i]
        const coAppKyc = coApplicantKyc[i]

        // Save/Update co-applicant profile first
        const coAppResult = await kycService.processCoApplicant({
          id: coApp.id,
          customerId: id,
          name: coApp.name,
          mobile: coApp.mobile,
          email: coApp.email,
          gender: coApp.gender
        })

        const coAppId = coAppResult.data.id

        if (coAppKyc && coAppKyc.panNumber) {
          await kycService.createKyc(id, {
            coApplicantId: coAppId,
            applicantType: 'co-applicant',
            applicantIndex: i + 1,
            kycType: 'PAN',
            kycNumber: coAppKyc.panNumber,
          })

          // Upload PAN file as a Document linked to CoApplicant
          if (coAppKyc.panFile) {
            await documentService.uploadDocument(
              id,
              coAppKyc.panFile,
              'pan',
              'co-applicant',
              i + 1,
              coAppId
            )
          }
        }
      }

      // Save Contact Persons
      for (let i = 0; i < contactPersons.length; i++) {
        const cp = contactPersons[i]
        await kycService.processContactPerson({
          id: cp.id,
          customerId: id,
          name: cp.name,
          mobile: cp.mobile,
          email: cp.email,
          designation: cp.designation,
          gender: cp.gender
        })
      }

      // Save Addresses
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i]
        await kycService.processAddress({
          id: addr.id,
          customerId: id,
          type: addr.type,
          fullAddress: addr.fullAddress,
          pincode: addr.pincode,
          state: addr.state,
          city: addr.city
        })
      }

      alert('Draft saved successfully')
      navigate('/rm/dashboard')
    } catch (error) {
      alert('Failed to save draft: ' + error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    // Validate both tabs
    if (!validateBasicKycTab()) {
      setActiveTab('basic-kyc')
      alert('Please complete all required fields in Basic & KYC tab')
      return
    }

    if (!validateDocumentsTab()) {
      setActiveTab('documents')
      return
    }

    setIsSubmitting(true)
    try {
      let id = caseId
      const customerData = {
        name: formData.customerName,
        mobile: formData.mobileNumber,
        email: formData.email,
        companyType: formData.companyType,
        companyName: formData.companyName,
        gstNumber: formData.gstNumber || null,
        electricityBillNo: formData.electricityBillNumber || null,
      }

      if (!id) {
        const newCase = await dispatch(createCase(customerData)).unwrap()
        id = newCase.id
      } else {
        await dispatch(updateCase({ id, data: customerData })).unwrap()
      }

      // Save KYC entries
      if (applicantKyc.panNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'PAN',
          kycNumber: applicantKyc.panNumber,
        })

        if (applicantKyc.panFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.panFile,
            'pan',
            'applicant',
            0
          )
        }
      }

      if (formData.gstNumber) {
        await kycService.createKyc(id, {
          applicantType: 'applicant',
          applicantIndex: 0,
          kycType: 'GST',
          kycNumber: formData.gstNumber,
        })

        if (applicantKyc.gstFile) {
          await documentService.uploadDocument(
            id,
            applicantKyc.gstFile,
            'gst_certificate',
            'applicant',
            0
          )
        }
      }

      // Save co-applicants' profiles and KYC
      for (let i = 0; i < coApplicants.length; i++) {
        const coApp = coApplicants[i]
        const coAppKyc = coApplicantKyc[i]

        // Save/Update co-applicant profile first
        const coAppResult = await kycService.processCoApplicant({
          id: coApp.id,
          customerId: id,
          name: coApp.name,
          mobile: coApp.mobile,
          email: coApp.email,
          gender: coApp.gender
        })

        const coAppId = coAppResult.data.id

        if (coAppKyc && coAppKyc.panNumber) {
          await kycService.createKyc(id, {
            coApplicantId: coAppId,
            applicantType: 'co-applicant',
            applicantIndex: i + 1,
            kycType: 'PAN',
            kycNumber: coAppKyc.panNumber,
          })

          // Upload PAN file as a Document linked to CoApplicant
          if (coAppKyc.panFile) {
            await documentService.uploadDocument(
              id,
              coAppKyc.panFile,
              'pan',
              'co-applicant',
              i + 1,
              coAppId
            )
          }
        }
      }

      // Save Contact Persons
      for (let i = 0; i < contactPersons.length; i++) {
        const cp = contactPersons[i]
        await kycService.processContactPerson({
          id: cp.id,
          customerId: id,
          name: cp.name,
          mobile: cp.mobile,
          email: cp.email,
          designation: cp.designation,
          gender: cp.gender
        })
      }

      // Save Addresses
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i]
        await kycService.processAddress({
          id: addr.id,
          customerId: id,
          type: addr.type,
          fullAddress: addr.fullAddress,
          pincode: addr.pincode,
          state: addr.state,
          city: addr.city
        })
      }

      await dispatch(submitCase({ id })).unwrap()
      alert('Case submitted successfully')
      navigate('/rm/dashboard')
    } catch (error) {
      alert('Failed to submit case: ' + error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmSubmit = async () => {
    // 1. Validation
    if (!validateBasicKycTab()) {
      setActiveTab('basic-kyc')
      setShowSubmitModal(false)
      alert('Please complete all required fields in Basic & KYC tab')
      return
    }
    if (!validateDocumentsTab()) {
      setActiveTab('documents')
      setShowSubmitModal(false)
      return
    }

    setIsSubmitting(true)
    try {
      // 2. Initial Case Creation/Update
      let id = caseId
      const customerData = {
        name: formData.customerName,
        mobile: formData.mobileNumber,
        email: formData.email,
        companyType: formData.companyType,
        companyName: formData.companyName,
        gstNumber: formData.gstNumber || null,
        electricityBillNo: formData.electricityBillNumber || null,
        pushedTo: Object.keys(submissionTargets).filter(k => submissionTargets[k].selected).join(','),
      }

      if (!id) {
        const newCase = await dispatch(createCase(customerData)).unwrap()
        id = newCase.id
      } else {
        await dispatch(updateCase({ id, data: customerData })).unwrap()
      }

      // Note: Full KYC and document saving logic would typically be called here too.
      // Re-using the core multi-push field we added to the entity.

      // 3. Submit to main workflow if 'credit' selected
      if (submissionTargets.credit.selected) {
        await dispatch(submitCase({
          id,
          pushedTo: customerData.pushedTo
        })).unwrap()
      }

      alert(`Case successfully pushed to selected entities: ${customerData.pushedTo}`)
      navigate('/rm/dashboard')
    } catch (error) {
      alert('Submission failed: ' + error.message)
    } finally {
      setIsSubmitting(false)
      setShowSubmitModal(false)
    }
  }

  const handleDocumentUploaded = (doc) => {
    setDocuments([...documents, doc])
  }

  const handleDocumentRemoved = (docId) => {
    setDocuments(documents.filter(doc => doc.id !== docId))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Customer Onboarding</h1>
        <p className="text-gray-600 mt-2">Complete KYC and upload required documents</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('basic-kyc')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'basic-kyc'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Basic & KYC
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'documents'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Documents
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card space-y-6">
        {activeTab === 'basic-kyc' && (
          <>
            {/* Company Type - MANDATORY FIRST */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.companyType}
                onChange={(e) => setFormData({ ...formData, companyType: e.target.value })}
                className="input-field"
              >
                <option value="">Select company type</option>
                {Object.values(COMPANY_TYPES).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.companyType && (
                <p className="text-red-500 text-xs mt-1">{errors.companyType}</p>
              )}
            </div>

            {/* Company Name - conditional */}
            {formData.companyType && formData.companyType !== COMPANY_TYPES.PROPRIETORSHIP && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="input-field"
                  placeholder="Enter company name"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Entity Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="input-field"
                  placeholder="Enter entity name"
                />
                {errors.customerName && (
                  <p className="text-red-500 text-xs mt-1">{errors.customerName}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="input-field flex-1"
                    placeholder="Enter mobile number"
                    maxLength={10}
                  />
                  <button
                    type="button"
                    onClick={handleMobileVerify}
                    disabled={isVerifying}
                    className="btn-secondary"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {errors.mobileNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.mobileNumber}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email ID
                </label>
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field flex-1"
                    placeholder="Enter email address"
                  />
                  <button
                    type="button"
                    onClick={handleEmailVerify}
                    disabled={isVerifying}
                    className="btn-secondary"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>
            </div>

            {/* KYC Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC Documents</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PAN Card */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PAN Card <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleApplicantPanUpload}
                        className="input-field"
                        disabled={isOcrProcessing}
                      />
                      {isOcrProcessing && (
                        <div className="absolute right-2 top-2">
                          <LoadingSpinner size="sm" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraTarget('applicant-pan');
                        setShowCamera(true);
                      }}
                      className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      title="Capture with Camera"
                    >
                      <FiCamera size={20} />
                    </button>
                  </div>
                  {applicantKyc.panNumber && (
                    <div className="mt-2 text-sm text-green-600 font-medium flex items-center">
                      <span>PAN: {applicantKyc.panNumber}</span>
                      <button
                        type="button"
                        onClick={handlePanVerify}
                        disabled={isVerifying}
                        className="ml-4 text-primary-600 hover:text-primary-700 underline text-xs"
                      >
                        {isVerifying ? 'Verifying...' : 'Verify Now'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Photo Capture (Optional Requirement) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Live Photo (Selfie) <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <div className="flex items-center space-x-4">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraTarget('live-photo');
                        setShowCamera(true);
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 font-medium transition-colors"
                    >
                      <FiCamera size={18} />
                      <span>Capture Live Photo</span>
                    </button>
                    {documents.some(d => d.documentType === 'live_photo') && (
                      <span className="text-sm text-green-600 font-medium">
                        ✓ Photo Captured
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* GST Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Upload
                  </label>
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleGstUpload}
                      className="hidden"
                    />
                    <div className="input-field flex items-center justify-center space-x-2 border-dashed">
                      <FiUpload className="h-4 w-4" />
                      <span className="text-sm">
                        {applicantKyc.gstFile ? `Uploaded: ${applicantKyc.gstFile.name}` : 'Upload GST Certificate'}
                      </span>
                    </div>
                  </label>
                </div>

                {/* GST Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                      className="input-field flex-1"
                      placeholder="Enter GST number"
                      maxLength={15}
                    />
                    <button
                      type="button"
                      onClick={handleGstVerify}
                      disabled={isVerifying}
                      className="btn-secondary"
                    >
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Aadhaar KYC */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aadhaar KYC <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAadhaarKyc}
                  disabled={isVerifying}
                  className="btn-primary"
                >
                  {isVerifying ? 'Processing...' : 'Complete Aadhaar KYC'}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  This will initiate Aadhaar-based e-KYC verification
                </p>
              </div>

              {/* Co-Applicants Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Co-Applicants / Co-Borrowers</h3>
                  <button
                    type="button"
                    onClick={addCoApplicant}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>Add Co-Applicant</span>
                  </button>
                </div>

                {coApplicants.length === 0 ? (
                  <p className="text-gray-500 text-sm">No co-applicants added yet</p>
                ) : (
                  <div className="space-y-4">
                    {coApplicants.map((coApp, index) => (
                      <CoApplicantForm
                        key={index}
                        index={index}
                        data={coApp}
                        onChange={updateCoApplicant}
                        onRemove={removeCoApplicant}
                        onPanUpload={handleCoApplicantPanUpload}
                        kycData={coApplicantKyc[index] || {}}
                      />
                    ))}
                  </div>
                )}
                {errors.coApplicants && (
                  <p className="text-red-500 text-sm mt-2 font-medium">{errors.coApplicants}</p>
                )}
              </div>

              {/* Contact Persons Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Contact Person Details</h3>
                  <button
                    type="button"
                    onClick={addContactPerson}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>Add Contact Person</span>
                  </button>
                </div>

                {contactPersons.length === 0 ? (
                  <p className="text-gray-500 text-sm">No contact persons added yet</p>
                ) : (
                  <div className="space-y-4">
                    {contactPersons.map((cp, index) => (
                      <ContactPersonForm
                        key={index}
                        index={index}
                        data={cp}
                        onChange={updateContactPerson}
                        onRemove={removeContactPerson}
                        errors={{
                          name: errors[`cp_${index}_name`],
                          mobile: errors[`cp_${index}_mobile`],
                          email: errors[`cp_${index}_email`],
                          gender: errors[`cp_${index}_gender`]
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Address Details Section */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Address Details</h3>
                  <button
                    type="button"
                    onClick={addAddress}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>Add Address Details</span>
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <p className="text-gray-500 text-sm">No addresses added yet</p>
                ) : (
                  <div className="space-y-4">
                    {addresses.map((addr, index) => (
                      <AddressForm
                        key={index}
                        index={index}
                        data={addr}
                        onChange={updateAddress}
                        onRemove={removeAddress}
                        errors={{
                          type: errors[`addr_${index}_type`],
                          fullAddress: errors[`addr_${index}_address`],
                          pincode: errors[`addr_${index}_pincode`],
                          state: errors[`addr_${index}_state`],
                          city: errors[`addr_${index}_city`]
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'documents' && (
          <DocumentChecklistUploader
            checklist={documentChecklist}
            uploadedDocuments={documents}
            customerId={caseId || currentCase?.id}
            onDocumentUploaded={handleDocumentUploaded}
            onDocumentRemoved={handleDocumentRemoved}
          />
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="btn-secondary"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Save as Draft'}
          </button>
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? <LoadingSpinner size="sm" /> : 'Submit Case'}
          </button>
        </div>
      </div>

      {/* Modal for Multi-Entity Submission */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Push Case to Entities</h2>
              <p className="text-sm text-gray-500 mt-1">Select one or more entities to submit this case.</p>
            </div>

            <div className="space-y-4">
              {Object.keys(submissionTargets)
                .filter(target => target !== 'credit') // Hiding Credit Team option as requested
                .map(target => (
                  <div key={target} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                    <label className="flex items-center space-x-3 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={submissionTargets[target].selected}
                        onChange={(e) => setSubmissionTargets({
                          ...submissionTargets,
                          [target]: { ...submissionTargets[target], selected: e.target.checked }
                        })}
                        className="rounded h-5 w-5 text-primary-600"
                      />
                      <span className="font-bold text-gray-800">{target.toUpperCase()}</span>
                    </label>

                    {submissionTargets[target].selected && (
                      <div className="space-y-3 pl-8 animate-fadeIn">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">To (Emails)</label>
                          <input
                            type="text"
                            value={submissionTargets[target].email}
                            onChange={(e) => setSubmissionTargets({
                              ...submissionTargets,
                              [target]: { ...submissionTargets[target], email: e.target.value }
                            })}
                            className="input-field py-1"
                            placeholder="comma-separated emails"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Subject</label>
                          <input
                            type="text"
                            value={submissionTargets[target].subject}
                            onChange={(e) => setSubmissionTargets({
                              ...submissionTargets,
                              [target]: { ...submissionTargets[target], subject: e.target.value }
                            })}
                            className="input-field py-1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email Body</label>
                          <textarea
                            value={submissionTargets[target].body}
                            onChange={(e) => setSubmissionTargets({
                              ...submissionTargets,
                              [target]: { ...submissionTargets[target], body: e.target.value }
                            })}
                            className="input-field py-1"
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 btn-primary"
                disabled={isSubmitting || !Object.values(submissionTargets).some(t => t.selected)}
              >
                {isSubmitting ? <LoadingSpinner size="sm" /> : 'Confirm & Push Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Modal */}
      {showCamera && (
        <LivePhotoCapture
          onCapture={handleCameraCapture}
          onCancel={() => {
            setShowCamera(false);
            setCameraTarget(null);
          }}
          label={cameraTarget === 'applicant-pan' ? "Capture PAN Card" : "Take Live Photo"}
        />
      )}
    </div>
  )
}

export default NewCustomerOnboarding
