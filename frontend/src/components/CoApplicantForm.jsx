// import { useState } from 'react'
// import { FiX, FiUpload } from 'react-icons/fi'
// import kycService from '../services/kycService'
// import LoadingSpinner from './LoadingSpinner'

// const CoApplicantForm = ({
//     index,
//     data = {},
//     onChange,
//     onRemove,
//     onPanUpload,
//     kycData = {},
//     errors = {},
//     customerId,
//     onVerify,
//     loadingStates = {},
//     verificationStatus = {}
// }) => {
//     const [isOcrProcessing, setIsOcrProcessing] = useState(false)

//     const handlePanImageUpload = async (e) => {
//         const file = e.target.files[0]
//         if (!file) return

//         setIsOcrProcessing(true)
//         try {
//             // Call real OCR
//             const result = await kycService.runOcr(file, 'PAN')
//             if (result.success) {
//                 // Auto-fill PAN number and name
//                 onChange(index, {
//                     ...data,
//                     name: result.data.name,
//                 })

//                 // Store PAN separately (would be saved to backend)
//                 if (onPanUpload) {
//                     onPanUpload(index, file, result.data.panNumber)
//                 }

//                 alert(`OCR completed! PAN: ${result.data.panNumber}, Name: ${result.data.name}`)
//             }
//         } catch (error) {
//             alert('OCR failed: ' + error.message)
//         } finally {
//             setIsOcrProcessing(false)
//         }
//     }

//     const handlePanVerify = () => {
//         onVerify('coApp_pan', kycData.panNumber, 'applicant', data.id)
//     }

//     const handleMobileVerify = () => {
//         onVerify('coApp_mobile', data.mobile, 'applicant', data.id)
//     }

//     const handleEmailVerify = () => {
//         onVerify('coApp_email', data.email, 'applicant', data.id)
//     }

//     const handleAadhaarKyc = () => {
//         onVerify('coApp_aadhaar', 'dummy', 'applicant', data.id)
//     }

//     return (
//         <div className="border border-gray-300 rounded-lg p-6 mb-4 bg-gray-50 relative">
//             <button
//                 type="button"
//                 onClick={() => onRemove(index)}
//                 className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
//                 title="Remove Co-Applicant"
//             >
//                 <FiX className="h-5 w-5" />
//             </button>

//             <h4 className="text-lg font-semibold text-gray-900 mb-4">
//                 Co-Applicant {index + 1}
//             </h4>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {/* Name */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Name <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                         type="text"
//                         value={data.name || ''}
//                         onChange={(e) => onChange(index, { ...data, name: e.target.value })}
//                         className="input-field"
//                         placeholder="Enter co-applicant name"
//                     />
//                     {errors.name && (
//                         <p className="text-red-500 text-xs mt-1">{errors.name}</p>
//                     )}
//                 </div>

//                 {/* Mobile */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Mobile Number <span className="text-red-500">*</span>
//                     </label>
//                     <div className="flex space-x-2">
//                         <input
//                             type="tel"
//                             value={data.mobile || ''}
//                             onChange={(e) => onChange(index, { ...data, mobile: e.target.value })}
//                             className="input-field flex-1"
//                             placeholder="Enter mobile number"
//                             maxLength={10}
//                         />
//                         <button
//                             type="button"
//                             onClick={handleMobileVerify}
//                             disabled={loadingStates[`coApp_mobile_${data.id}`] || verificationStatus.mobileStatus === 'VERIFIED'}
//                             className={`btn-${verificationStatus.mobileStatus === 'VERIFIED' ? 'success' : 'secondary'} whitespace-nowrap min-w-[80px] flex items-center justify-center`}
//                         >
//                             {verificationStatus.mobileStatus === 'VERIFIED' ? '✓ Verified' : (loadingStates[`coApp_mobile_${data.id}`] ? <LoadingSpinner size="sm" /> : 'Verify')}
//                         </button>
//                     </div>
//                 </div>

//                 {/* Email */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Email
//                     </label>
//                     <div className="flex space-x-2">
//                         <input
//                             type="email"
//                             value={data.email || ''}
//                             onChange={(e) => onChange(index, { ...data, email: e.target.value })}
//                             className="input-field flex-1"
//                             placeholder="Enter email address"
//                         />
//                         <button
//                             type="button"
//                             onClick={handleEmailVerify}
//                             disabled={loadingStates[`coApp_email_${data.id}`] || verificationStatus.emailStatus === 'VERIFIED'}
//                             className={`btn-${verificationStatus.emailStatus === 'VERIFIED' ? 'success' : 'secondary'} whitespace-nowrap min-w-[80px] flex items-center justify-center`}
//                         >
//                             {verificationStatus.emailStatus === 'VERIFIED' ? '✓ Verified' : (loadingStates[`coApp_email_${data.id}`] ? <LoadingSpinner size="sm" /> : 'Verify')}
//                         </button>
//                     </div>
//                 </div>

//                 {/* Gender */}
//                 <div className="md:col-span-2">
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Gender <span className="text-red-500">*</span>
//                     </label>
//                     <div className="flex space-x-6 mt-2">
//                         {['Male', 'Female', 'Other'].map((gender) => (
//                             <label key={gender} className="inline-flex items-center cursor-pointer">
//                                 <input
//                                     type="radio"
//                                     name={`gender-${index}`}
//                                     value={gender}
//                                     checked={data.gender === gender}
//                                     onChange={(e) => onChange(index, { ...data, gender: e.target.value })}
//                                     className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
//                                 />
//                                 <span className="ml-2 text-sm text-gray-700">{gender}</span>
//                             </label>
//                         ))}
//                     </div>
//                 </div>

//                 {/* PAN Upload */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         PAN Card <span className="text-red-500">*</span>
//                     </label>
//                     <div className="flex space-x-2">
//                         <label className="flex-1 cursor-pointer">
//                             <input
//                                 type="file"
//                                 accept="image/*,.pdf"
//                                 onChange={handlePanImageUpload}
//                                 className="hidden"
//                             />
//                             <div className="input-field flex items-center justify-center space-x-2 border-dashed">
//                                 <FiUpload className="h-4 w-4" />
//                                 <span className="text-sm">
//                                     {isOcrProcessing ? 'Processing...' : 'Upload PAN'}
//                                 </span>
//                             </div>
//                         </label>
//                         <button
//                             type="button"
//                             onClick={handlePanVerify}
//                             disabled={loadingStates[`coApp_pan_${data.id}`] || verificationStatus.panStatus === 'VERIFIED' || !kycData.panNumber}
//                             className={`btn-${verificationStatus.panStatus === 'VERIFIED' ? 'success' : 'secondary'} whitespace-nowrap min-w-[80px] flex items-center justify-center`}
//                         >
//                             {verificationStatus.panStatus === 'VERIFIED' ? '✓ Verified' : (loadingStates[`coApp_pan_${data.id}`] ? <LoadingSpinner size="sm" /> : 'Verify')}
//                         </button>
//                     </div>
//                     {kycData.panNumber && (
//                         <p className="text-xs text-green-600 mt-1">PAN: {kycData.panNumber}</p>
//                     )}
//                 </div>

//                 {/* Aadhaar KYC */}
//                 <div className="md:col-span-2">
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Aadhaar KYC <span className="text-red-500">*</span>
//                     </label>
//                     <button
//                         type="button"
//                         onClick={handleAadhaarKyc}
//                         disabled={loadingStates[`coApp_aadhaar_${data.id}`] || verificationStatus.aadhaarStatus === 'VERIFIED'}
//                         className={`btn-${verificationStatus.aadhaarStatus === 'VERIFIED' ? 'success' : 'primary'} w-full`}
//                     >
//                         {verificationStatus.aadhaarStatus === 'VERIFIED' ? '✓ Aadhaar Verified' : (loadingStates[`coApp_aadhaar_${data.id}`] ? 'Processing...' : 'Complete Aadhaar KYC')}
//                     </button>
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default CoApplicantForm


import Loader from './Loader'; // adjust path if needed
import { useMemo, useState } from 'react'
import { FiX } from 'react-icons/fi'
import kycService from '../services/kycService'
import LoadingSpinner from './LoadingSpinner'
import { documentService } from "../services/documentService";
const MAX_PAN_FILE_MB = 5
const ALLOWED_PAN_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
]

const normalizePanFromOcr = (data) => {
  // handle different OCR payload shapes
  return (
    data?.panNumber ||
    data?.pan ||
    data?.pan_no ||
    data?.panNo ||
    ''
  )
}

const normalizeNameFromOcr = (data) => {
  return data?.name || data?.fullName || ''
}

const CoApplicantForm = ({
  // NOTE: index is kept for display only (Co-Applicant 1/2/3). Identity must NOT depend on index.
  index,

  data = {},

  onChange,
  onRemove,

  // KYC data (should be mapped by stable key in parent: id || localKey)
  kycData = {},

  // parent validation errors
  errors = {},

  // required for verification requests
  customerId,

  // verification handler from parent (kept same signature)
  onVerify,

  // loading state map from parent
  loadingStates = {},

  // backend-driven verification status for this co-applicant
  verificationStatus = {},

  // optional: notify handler (toast/snackbar). Falls back to console.
  onNotify,

  // optional: called when user edits value after verified so parent can refresh statuses/reset UI
  onFieldMutate,
  // NEW: explicitly update KYC data (e.g. editable PAN)
  onKycUpdate,
  // NEW: refresh verification statuses from backend
  onLoadVerificationStatuses,
  // NEW: manual Aadhaar upload handler
  onManualAadhaarUpload,
}) => {





  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [isRefreshingAadhaar, setIsRefreshingAadhaar] = useState(false)
  const [aadhaarRefreshStatus, setAadhaarRefreshStatus] = useState({})
const [isEmailLoadingLocal, setIsEmailLoadingLocal] = useState(false);

const isAnyLoading =
  isOcrProcessing ||
  isRefreshingAadhaar ||
  isEmailLoadingLocal ||   // ✅ use local
  Object.entries(loadingStates || {}).some(
    ([key, value]) =>
      key.includes(data.id || data.localKey) && value
  );
  // stable identity key for UI + local state mapping
  const stableKey = useMemo(() => data?.id || data?.localKey, [data?.id, data?.localKey])

  const notify = (type, message) => {
    if (onNotify) return onNotify(type, message)
    // fallback (avoid alert in prod)
    if (type === 'error') console.error(message)
    else console.log(message)
  }

  const handleAadhaarRefresh = async () => {
    if (!customerId) return
    setIsRefreshingAadhaar(true)
    try {
      // Call parent to reload verification statuses from backend
      if (onLoadVerificationStatuses) {
        await onLoadVerificationStatuses(customerId)
      }
    } catch (error) {
      console.error('Failed to refresh Aadhaar status:', error)
    } finally {
      setIsRefreshingAadhaar(false)
    }
  }

  const mustHaveCaseId = () => {
    if (!customerId) {
      notify('error', 'Please verify primary mobile / create the case first (Case ID required).')
      return false
    }
    return true
  }

  // const mustHaveCoApplicantId = () => {
  //   // IMPORTANT: Backend needs a DB coApplicantId to store verification statuses
  //   if (!data?.id) {
  //     notify('error', 'Please "Save as Draft" first to create Co-Applicant ID, then verify.')
  //     return false
  //   }
  //   return true
  // }


  const mustHaveCoApplicantId = () => {
  return true; //  NO ERROR
}

  const validatePanFile = (file) => {
    if (!file) return 'No file selected'
    if (!ALLOWED_PAN_TYPES.includes(file.type)) return 'Only JPG, PNG, or PDF allowed'
    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > MAX_PAN_FILE_MB) return `File too large. Max ${MAX_PAN_FILE_MB}MB`
    return null
  }

 const handlePanImageUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  const fileErr = validatePanFile(file)
  if (fileErr) {
    notify('error', fileErr)
    e.target.value = ''
    return
  }

  setIsOcrProcessing(true)

  try {
    // ✅ OCR
const result = await kycService.processPanOcr(file)

    if (!result?.success) {
      notify('error', result?.message || 'OCR failed')
      return
    }

    const pan = normalizePanFromOcr(result.data)
    const name = normalizeNameFromOcr(result.data)

    // ✅ STEP 1: ensure coApplicantId exists
    let coApplicantId = data?.id

    if (!coApplicantId) {
      notify("info", "Please verify mobile first to create co-applicant")
      return
    }

    // ✅ STEP 2: UPLOAD DOCUMENT (🔥 MAIN FIX)
    console.log("Uploading PAN...", { customerId, coApplicantId })

    const uploadRes = await documentService.uploadDocument(
      customerId,
      file,
      "pan",
      "coApplicant",
      0,
      coApplicantId,
      {}
    )

    console.log("Upload Response:", uploadRes)

    // ✅ STEP 3: update UI
    onChange?.(stableKey, {
      ...data,
      name: name || data.name,
    })

    onKycUpdate?.({
      panNumber: pan,
      panFile: file
    })

    notify('success', `OCR + Upload done: ${pan}`)

  } catch (error) {
    console.error("PAN Upload Error:", error)
    notify('error', error?.message || 'Upload failed')
  } finally {
    setIsOcrProcessing(false)
    e.target.value = ''
  }
}

  // const safeVerify = (field, value, localKey = null) => {
  //   console.log(field, value, data.id, customerId);
  //   console.log(data.id);
  //   console.log("VERIFY CLICK", { field, value, coApplicantId: data.id, localKey, customerId });

  //   if (!mustHaveCaseId()) return
  //   // if (!mustHaveCoApplicantId()) return

  //   console.log(`Requesting verification for ${field} with value "${value}" (co-applicant ID: ${data.id})`)

  //   // prevent reclick while loading
  //   const key = `${field}_${data.id || localKey || "main"}`;
  //   if (loadingStates[key]) return

  //   onVerify?.(field, value, data.id, localKey)

  //   console.log(`button verified ended`)
  // }

  const safeVerify = async (field, value, localKey = null) => {
  if (!mustHaveCaseId()) return;

  const isFirstTime = !data?.id;

  const key = `${field}_${data.id || localKey || "main"}`;
  if (loadingStates[key]) return;

  try {
    const res = await onVerify?.(field, value, data.id, localKey);

    if (isFirstTime && res?.coApplicantId) {
      onChange?.(stableKey, {
        ...data,
        id: res.coApplicantId,
      });

      notify("success", "Co-applicant created & verified");
    }

  } catch (error) {
    notify("error", error?.message || "Verification failed");
  }
};

  const handleMobileVerify = () =>
    safeVerify('coApplicantMobile', data.mobile, data.localKey);

  // const handleEmailVerify = () =>
  //   safeVerify('coApplicantEmail', data.email, data.localKey);
const handleEmailVerify = async () => {

  if (!data.email) {
    notify("error", "Please enter email");
    return;
  }

  if (!customerId) {
    notify("error", "Customer ID missing");
    return;
  }

  const key = `coApplicantEmail_${data.id || data.localKey}`;
  if (loadingStates[key] || data?.isEmailLoading) return;

  try {
    // 🔥 START LOADER (ONLY WHEN API STARTS)
 setIsEmailLoadingLocal(true);
onFieldMutate?.(stableKey, "isEmailLoading", true);

    // ==============================
    // ✅ STEP 1 — SEND EMAIL OTP
    // ==============================
    const sendRes = await onVerify?.("sendEmailOtp", {
      customerId,
      email: data.email.trim(),
      ownerType: "CO_APPLICANT",
      coApplicantId: data.id,
    });

    if (!sendRes?.success) {
      notify("error", sendRes?.message || "Failed to send OTP");
      return;
    }

    // ✅ handle first-time co-applicant creation
    let coApplicantId = data?.id;

    if (sendRes?.coApplicantId && !data?.id) {
      coApplicantId = sendRes.coApplicantId;

      onChange?.(stableKey, {
        ...data,
        id: coApplicantId,
      });
    }

    // ==============================
    // ✅ STEP 2 — VERIFY DIRECTLY
    // ==============================
    const verifyRes = await onVerify?.("verifyEmailOtp", {
      customerId,
      otp: "0000",
      ownerType: "CO_APPLICANT",
      coApplicantId: coApplicantId,
      skipOtpValidation: true,
    });

    if (verifyRes?.success) {
      notify("success", "Email Verified Successfully");

      onFieldMutate?.(stableKey, "emailVerified", true);

      onLoadVerificationStatuses?.(customerId);
    } else {
      notify("error", verifyRes?.message || "Email verification failed");
    }

  } catch (error) {
    notify("error", error?.message || "Email verification failed");
  } finally {
 setIsEmailLoadingLocal(false);
onFieldMutate?.(stableKey, "isEmailLoading", false);
  }
};

  const handlePanVerify = () =>
    safeVerify('coApplicantPan', kycData.panNumber, data.localKey);

  const handleAadhaarKyc = () =>
    safeVerify('coApplicantAadhaar', null, data.localKey);




  // Mutations should notify parent so it can refresh/reset verification
  const handleChange = (patch) => {
    onChange?.(stableKey, { ...data, ...patch })
    if (typeof onFieldMutate === 'function') {
      Object.keys(patch).forEach((k) => onFieldMutate(stableKey, k, patch[k]))
    }
  }

  const isSaved = !!data?.id
  // const canVerify = !!customerId && isSaved
  const canVerify = !!customerId
return (
  <div className="relative">
    
    {/* 🔥 GLOBAL LOADER OVERLAY */}
    {isAnyLoading && (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-lg">
        <Loader />
      </div>
    )}

    {/* EXISTING UI */}
    <div className="border border-gray-300 rounded-lg p-6 mb-4 bg-gray-50 relative">
      {/* <button
        type="button"
        onClick={() => onRemove?.(stableKey)}
        className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
        title="Remove Co-Applicant"
      >
        <FiX className="h-5 w-5" />
      </button> */}

<div className="mt-4 flex justify-end">
  <button
    type="button"
    onClick={() => onRemove?.(stableKey)}
    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
  >
    Remove Co-Applicant
  </button>
</div>




      <h4 className="text-lg font-semibold text-gray-900 mb-1">
        Co-Applicant {typeof index === 'number' ? index + 1 : ''}
      </h4>

      {/* {!isSaved && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
          Note: Save Draft to generate Co-Applicant ID before verification.
        </p>
      )} */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.name || ''}
            onChange={(e) => handleChange({ name: e.target.value })}
            className="input-field"
            placeholder="Enter co-applicant name"
            //disabled={verificationStatus.mobileStatus === 'VERIFIED' || verificationStatus.emailStatus === 'VERIFIED' || verificationStatus.panStatus === 'VERIFIED'}
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <div className="flex space-x-2">
            <input
              type="tel"
              value={data.mobile || ''}
              onChange={(e) => handleChange({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              className="input-field flex-1"
              placeholder="Enter mobile number"
              maxLength={10}
              disabled={verificationStatus.mobileStatus === 'VERIFIED'}
            />
            <button
              type="button"
              onClick={handleMobileVerify}
              disabled={
                !canVerify ||
                loadingStates[`coApplicantMobile_${data.id || data.localKey}`] ||
                verificationStatus.mobileStatus === 'VERIFIED'
              }
              className={`btn-${verificationStatus.mobileStatus === 'VERIFIED' ? 'success' : 'secondary'} whitespace-nowrap min-w-[90px] flex items-center justify-center`}
              title={!canVerify ? 'Save Draft first to verify' : ''}
            >
              {verificationStatus.mobileStatus === 'VERIFIED'
                ? '✓ Verified'
                : loadingStates[`coApplicantMobile_${data.id || data.localKey}`]
                  ? <LoadingSpinner size="sm" />
                  : 'Register'}
            </button>
          </div>
          {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <div className="flex space-x-2">
            <input
              type="email"
              value={data.email || ''}
              onChange={(e) => handleChange({ email: e.target.value })}
              className="input-field flex-1"
              placeholder="Enter email address"
              disabled={verificationStatus.emailStatus === 'VERIFIED'}
            />
            <button
              type="button"
              onClick={handleEmailVerify}
              disabled={
                !canVerify ||
                loadingStates[`coApplicantEmail_${data.id || data.localKey}`] ||
                verificationStatus.emailStatus === 'VERIFIED' ||
                !data.email
              }
              className={`btn-${verificationStatus.emailStatus === 'VERIFIED' ? 'success' : 'secondary'} whitespace-nowrap min-w-[90px] flex items-center justify-center`}
            >
              {verificationStatus.emailStatus === 'VERIFIED'
                ? '✓ Verified'
                : loadingStates[`coApplicantEmail_${data.id || data.localKey}`]
                  ? <LoadingSpinner size="sm" />
                  : 'Register'}
            </button>
          </div>
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Gender */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender <span className="text-red-500">*</span>
          </label>
          <div className="flex space-x-6 mt-2">
            {['Male', 'Female'].map((gender) => (
              <label key={gender} className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name={`gender-${stableKey}`}   // IMPORTANT: stable name, not index
                  value={gender}
                  checked={data.gender === gender}
                  onChange={(e) => handleChange({ gender: e.target.value })}
                  className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">{gender}</span>
              </label>
            ))}
          </div>
          {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
        </div>

        {/* PAN Upload & Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PAN Card <span className="text-red-500">*</span>
          </label>

          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handlePanImageUpload(e)}
              disabled={verificationStatus.panStatus === 'VERIFIED'}
              className={`input-field flex-1 ${verificationStatus.panStatus === 'VERIFIED' ? "opacity-60 cursor-not-allowed" : ""}`}
            />
            <span className="text-sm truncate max-w-[150px] text-gray-600">
              {kycData.panFile?.name || "No file"}
            </span>
            {kycData.panFile && (
              <button
                type="button"
                onClick={() => {
                  try {
                    const url = URL.createObjectURL(kycData.panFile);
                    window.open(url, '_blank');
                  } catch (e) {
                    console.error('Preview failed', e);
                  }
                }}
                className="ml-2 text-xs text-primary-600 hover:underline"
              >
                Preview
              </button>
            )}
          </div>

          <div className="mt-2">
            <input
              type="text"
              value={kycData.panNumber || ''}
              onChange={(e) => onKycUpdate?.({ panNumber: e.target.value.toUpperCase() })}
              className="input-field"
              placeholder="Enter PAN Number"
              disabled={verificationStatus.panStatus === 'VERIFIED'}
            />
          </div>

          <button
            type="button"
            onClick={handlePanVerify}
            disabled={
              !canVerify ||
              loadingStates[`coApplicantPan_${data.id || data.localKey}`] ||
              verificationStatus.panStatus === 'VERIFIED' ||
              !kycData.panNumber
            }
            className={`mt-2 btn-${verificationStatus.panStatus === 'VERIFIED' ? 'success' : 'secondary'} w-full flex items-center justify-center`}
          >
            {verificationStatus.panStatus === 'VERIFIED'
              ? '✓ PAN Verified'
              : loadingStates[`coApplicantPan_${data.id || data.localKey}`]
                ? <LoadingSpinner size="sm" />
                : 'Verify PAN'}
          </button>

          {errors.pan && <p className="text-red-500 text-xs mt-1">{errors.pan}</p>}
        </div>

        {/* Aadhaar KYC (shown after PAN verified) */}
        {verificationStatus.panStatus === 'VERIFIED' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aadhaar KYC
            </label>

            {/* Show info message if Aadhaar is initiated but not verified */}
            {verificationStatus.aadhaarStatus === 'INITIATED' && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                ℹ️ KYC link sent to your mobile. Complete Aadhaar verification and click "Refresh Status" to update.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <button
                  type="button"
                  onClick={handleAadhaarKyc}
                  disabled={
                    !canVerify ||
                    loadingStates[`coApplicantAadhaar_${data.id || data.localKey}`] ||
                    verificationStatus.aadhaarStatus === 'VERIFIED'
                   
                  }
                  className={`btn-${verificationStatus.aadhaarStatus === 'VERIFIED' ? 'success' : 'primary'} w-full`}
                >
                  {verificationStatus.aadhaarStatus === 'VERIFIED'
                    ? '✓ Aadhaar Verified'
                    : loadingStates[`coApplicantAadhaar_${data.id || data.localKey}`]
                      ? 'Processing...'
                      : 'Verify Aadhaar'}
                </button>

                {/* Show Refresh Status button if Aadhaar is initiated but not verified */}
                {verificationStatus.aadhaarStatus === 'INITIATED' && (
                  <button
                    type="button"
                    onClick={handleAadhaarRefresh}
                    disabled={isRefreshingAadhaar}
                    className="mt-2 btn-secondary w-full flex items-center justify-center"
                  >
                    {/* {isRefreshingAadhaar ? <LoadingSpinner size="sm" /> : 'Refresh Status'} */}
                  </button>
                )}
              </div>

              {/* Manual Aadhaar Upload Option */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or Upload Manual Aadhaar Card
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && onManualAadhaarUpload) {
                      onManualAadhaarUpload(file, data.id || data.localKey);
                    }
                  }}
                  className="input-field w-full"
                  disabled={verificationStatus.aadhaarStatus === 'VERIFIED'}
                />
                <p className="text-xs text-gray-500 mt-1">Upload Aadhaar card (PDF/Image)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

export default CoApplicantForm
