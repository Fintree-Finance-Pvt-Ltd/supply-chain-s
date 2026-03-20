import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { fetchCaseById, createCase, updateCase, submitCase } from "../../../store/slices/caseSlice";
import kycService from "../../../services/kycService";
import { documentService } from "../../../services/documentService";

import { COMPANY_TYPES, getDocumentChecklist } from "../../../config/documentChecklists";

import BasicKycTab from "./tabs/BasicKycTab";
import DocumentsTab from "./tabs/DocumentsTab";
import CoApplicantSection from "./sections/CoApplicantSection";
import ContactPersonSection from "./sections/ContactPersonSection";
import AddressSection from "./sections/AddressSection";
import OtpModal from "./ui/OtpModal";
import SubmitModal from "./ui/SubmitModal";

import LoadingSpinner from "../../../components/LoadingSpinner";
import LivePhotoCapture from "../../../components/LivePhotoCapture";

import useOnboardingState from "../../../hooks/useOnboardingState";
import useOtpFlow from "../../../hooks/useOtpFlow";

import { validateMobile, validateEmail } from "../../../utils/validation";

const OnboardingContainer = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

  const { currentCase, isLoading } = useSelector((s) => s.cases);

  const {
    activeTab, setActiveTab,
    formData, setFormData,
    applicantKyc, setApplicantKyc,
    coApplicants, setCoApplicants,
    coApplicantKyc, setCoApplicantKyc,
    contactPersons, setContactPersons,
    addresses, setAddresses,
    documents, setDocuments,
    showCamera, setShowCamera,
    cameraTarget, setCameraTarget,
    submissionTargets, setSubmissionTargets,
    errors, setErrors,
  } = useOnboardingState();

  const checklist = useMemo(() => getDocumentChecklist(formData.companyType), [formData.companyType]);

  // ----- Verification Status from backend (single source of truth)
  const [verificationStatuses, setVerificationStatuses] = useOtpFlow.useVerificationStatusesState();

  const companyStatus = useMemo(
    () =>
      verificationStatuses.find(
        (s) => s.ownerType === "COMPANY"
      ),
    [verificationStatuses]
  );

  // const applicantStatus = useMemo(() => {
  //   const rows = verificationStatuses.filter(
  //     (s) => s.ownerType === "APPLICANT"
  //   );

  //   if (!rows.length) return null;

  //   return rows.reduce((acc, curr) => ({
  //     ...acc,
  //     ...curr, // merge all statuses
  //   }), {});
  // }, [verificationStatuses]);

  const applicantStatus = useMemo(() => {
    return verificationStatuses.find(
      (s) => s.ownerType === "APPLICANT"
    ) || null;
  }, [verificationStatuses]);



  const coApplicantStatusMap = useMemo(() => {
    const map = {};
    verificationStatuses
      .filter(s => s.ownerType === "CO_APPLICANT")
      .forEach(s => {
        map[s.coApplicantId] = s;
      });
    return map;
  }, [verificationStatuses]);



  const getCompanyVerified = (kind) => {
    if (!companyStatus) return false;

    const map = {
      mobile: "mobileStatus",
      email: "emailStatus",
      pan: "panStatus",
      gst: "gstStatus",
      aadhaar: "aadhaarStatus",
    };

    return companyStatus?.[map[kind]] === "VERIFIED";
  };


  // ----- Load case + statuses
  useEffect(() => {
    if (!customerId) return;
    dispatch(fetchCaseById(customerId));
    loadVerificationStatuses(customerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadVerificationStatuses = async (id) => {
    try {
      const res = await kycService.getKycStatuses(id);
      if (res?.success) {
        console.log("Fetched KYC Statuses:", res.data); // DEBUG
        setVerificationStatuses(prev => {
          const map = new Map();

          [...prev, ...(res.data || [])].forEach(s => {
            const key = `${s.ownerType}_${s.applicantId || s.coApplicantId || "main"}`;
            map.set(key, { ...map.get(key), ...s });
          });

          return Array.from(map.values());
        });

        // Debug
        // console.log("Refreshed statuses:", res.data);
      }

    } catch (e) {
      console.error("Failed to fetch verification statuses:", e);
    }
  };

  // ----- hydrate UI from currentCase
  useEffect(() => {
    if (!currentCase || !customerId) return;

    setFormData((prev) => ({
      ...prev,
      companyType: currentCase.companyType || "",
      companyName: currentCase.companyName || "",
      companyMobile: currentCase.companyMobile || "",
      companyEmail: currentCase.companyEmail || "",
      companyPan: currentCase.companyPan || "",
      companyGst: currentCase.gstNumber || "",
      applicantName: currentCase.applicant?.name || "",
      applicantMobile: currentCase.applicant?.mobile || "",
      applicantEmail: currentCase.applicant?.email || "",
      applicantPan: currentCase.applicant?.pan || "",
      remarks: currentCase.remarks || "",
    }));

    setDocuments(currentCase.documents || []);

    // hydrate coApplicants
    if (currentCase.coApplicants?.length) {
      setCoApplicants(
        currentCase.coApplicants.map((ca) => ({
          id: ca.id,
          localKey: ca.id,
          name: ca.name || "",
          mobile: ca.mobile || "",
          email: ca.email || "",
          gender: ca.gender || "",
        }))
      );

      // hydrate coApplicantKyc keyed by id
      const map = {};
      currentCase.coApplicants.forEach((ca) => {
        const panKyc = ca.kycDetails?.find((k) => k.kycType === "PAN");
        if (panKyc) {
          map[ca.id] = { panNumber: panKyc.kycNumber, panFile: null };
        }
      });
      setCoApplicantKyc(map);
    }

    // contact persons
    if (currentCase.contactPersons?.length) {
      setContactPersons(
        currentCase.contactPersons.map((cp) => ({
          id: cp.id,
          localKey: cp.id,
          name: cp.name || "",
          mobile: cp.mobile || "",
          email: cp.email || "",
          designation: cp.designation || "",
          gender: cp.gender || "",
        }))
      );
    }

    // addresses
    if (currentCase.addresses?.length) {
      setAddresses(
        currentCase.addresses.map((a) => ({
          id: a.id,
          localKey: a.id,
          type: a.type || "",
          fullAddress: a.fullAddress || "",
          pincode: a.pincode || "",
          state: a.state || "",
          city: a.city || "",
        }))
      );
    }
  }, [currentCase, customerId, setFormData, setCoApplicants, setCoApplicantKyc, setContactPersons, setAddresses, setDocuments]);

  // ----- OTP Flow hook
  const {
    showOtpModal, otpValue, setOtpValue, otpData,
    loadingStates, isVerifying, openOtpFor,
    closeOtpModal, handleOtpVerify, setLoading,
  } = useOtpFlow({
    customerId,
    formData,
    loadVerificationStatuses,
    navigate,
  });

  // ----- Verify handlers (PAN/GST/OTP send)
  // const handleVerify = async (field, value, coApplicantId = null, localKey = null) => {
  //   if (!value) {
  //     alert(`Please enter value for ${field}`);
  //     return;
  //   }

  //   if (!customerId && field !== "companyMobile") {
  //   alert("Verify company mobile first (customer must exist)");
  //   return;
  // }


  //   try {
  //     // ----------------------------------
  //     // 🔹 Determine ownerType
  //     // ----------------------------------

  //     let ownerType = "COMPANY";
  //     let applicantId = undefined;

  //     if (coApplicantId) {
  //       ownerType = "CO_APPLICANT";
  //     } else if (
  //       field === "applicantPan" ||
  //       field === "applicantMobile" ||
  //       field === "applicantEmail"
  //     ) {
  //       ownerType = "APPLICANT";
  //     }

  //     // ----------------------------------
  //     // 🔹 MOBILE OTP
  //     // ----------------------------------

  //     if (field === "companyMobile" || field === "applicantMobile" || field === "coApplicantMobile") {
  //       if (!validateMobile(value)) {
  //         alert("Enter valid mobile");
  //         return;
  //       }

  //       const loadingKey = `${field}_${coApplicantId || "main"}`;
  // setLoading(loadingKey, true);

  // const res = await kycService.sendMobileOtp({
  //   customerId,
  //   mobileNumber: value,
  //   ownerType,
  //   applicantId,
  //   coApplicantId
  // });

  // if (!coApplicantId && res?.coApplicantId && localKey) {
  //   setCoApplicants(prev =>
  //     prev.map(c =>
  //       c.localKey === localKey
  //         ? { ...c, id: res.coApplicantId }
  //         : c
  //     )
  //   );
  // }


  // setLoading(loadingKey, false);


  //       if (res?.success) {
  //         openOtpFor({
  //           type: "mobile",
  //           target: field,
  //           value,
  //           ownerType,
  //           applicantId,
  //           coApplicantId
  //         });
  //       }

  //       return;
  //     }

  //     // ----------------------------------
  //     // 🔹 EMAIL OTP
  //     // ----------------------------------

  //     if (field === "companyEmail" || field === "applicantEmail" || field === "coApplicantEmail") {
  //   if (!validateEmail(value)) {
  //     alert("Enter valid email");
  //     return;
  //   }

  //   const loadingKey = `${field}_${coApplicantId || "main"}`;
  //   setLoading(loadingKey, true);

  //   const res = await kycService.sendEmailOtp({
  //     customerId,
  //     email: value,
  //     ownerType,
  //     applicantId,
  //     coApplicantId,
  //   });

  // if (!coApplicantId && res?.coApplicantId && localKey) {
  //   setCoApplicants(prev =>
  //     prev.map(c =>
  //       c.localKey === localKey
  //         ? { ...c, id: res.coApplicantId }
  //         : c
  //     )
  //   );
  // }


  //   setLoading(loadingKey, false);

  //   if (res?.success) {
  //     openOtpFor({
  //       type: "email",
  //       target: field,
  //       value,
  //       ownerType,
  //       applicantId,
  //       coApplicantId,
  //     });
  //   }

  //       return;
  //     }

  //     // ----------------------------------
  // // 🔹 PAN VERIFY (FIXED)
  // // ----------------------------------

  // if (
  //   field === "companyPan" ||
  //   field === "applicantPan" ||
  //   field === "coApplicantPan"
  // ) {
  //   const loadingKey = `${field}_${coApplicantId || "main"}`;
  //   setLoading(loadingKey, true);

  //   try {
  //     const name =
  //       ownerType === "COMPANY"
  //         ? formData.companyName
  //         : ownerType === "APPLICANT"
  //         ? formData.applicantName
  //         : coApplicants.find((c) => c.id === coApplicantId)?.name;

  //     const res = await kycService.verifyPan({
  //       customerId,
  //       pan: value,
  //       name,
  //       ownerType,
  //       applicantId,
  //       coApplicantId,
  //     });

  //     await loadVerificationStatuses(customerId);

  //     if (!res?.success || !res?.data?.verified) {
  //       alert("PAN verification failed");
  //     }
  //   } finally {
  //     setLoading(loadingKey, false);
  //   }

  //   return;
  // }


  //   // ----------------------------------
  // // 🔹 GST VERIFY (FIXED)
  // // ----------------------------------

  // if (field === "companyGst") {
  //   const loadingKey = "companyGst_main";
  //   setLoading(loadingKey, true);

  //   try {
  //     const res = await kycService.verifyGst({
  //       customerId,
  //       gstNumber: value,
  //       ownerType: "COMPANY",
  //     });

  //     if (!res?.success) {
  //       alert("GST verification failed");
  //     }

  //     await loadVerificationStatuses(customerId);
  //   } finally {
  //     setLoading(loadingKey, false);
  //   }

  //   return;
  // }


  //   } catch (e) {
  //     alert(
  //       `${field} verification failed: ` +
  //         (e?.response?.data?.message || e.message)
  //     );
  //   }
  // };

  const handleVerify = async (
    field,
    value,
    coApplicantId = null,
    localKey = null
  ) => {
    // Aadhaar doesn't require a value (just sends link via SMS)
    const isAadhaar = field === "applicantAadhaar" || field === "coApplicantAadhaar";
    
    if (!value && !isAadhaar) {
      toast.info(`Please enter value for ${field}`);
      return;
    }

    if (!customerId && field !== "companyMobile") {
      toast.info("Verify company mobile first (customer must exist)");
      return;
    }

    try {
      // ----------------------------------
      // 🔹 Resolve ownerType and applicantId
      // ----------------------------------
      let ownerType = "COMPANY";
      let applicantId;

      if (coApplicantId || localKey) {
        ownerType = "CO_APPLICANT";
      } else if (
        field === "applicantPan" ||
        field === "applicantMobile" ||
        field === "applicantEmail" ||
        field === "applicantAadhaar"
      ) {
        ownerType = "APPLICANT";
        // Resolve applicantId from backend status if available
        applicantId = applicantStatus?.applicantId || null;
      }

      // ----------------------------------
      // 🔹 Resolve loading key (CRITICAL FIX)
      // ----------------------------------
      const keySuffix = coApplicantId || localKey || "main";
      const loadingKey = `${field}_${keySuffix}`;

      // prevent double click
      if (loadingStates[loadingKey]) return;

      // ----------------------------------
      // 🔹 MOBILE OTP
      // ----------------------------------
      if (
        field === "companyMobile" ||
        field === "applicantMobile" ||
        field === "coApplicantMobile"
      ) {
        if (!validateMobile(value)) {
          toast.info("Enter valid mobile");
          return;
        }

        setLoading(loadingKey, true);

        const res = await kycService.sendMobileOtp({
          customerId,
          mobileNumber: value,
          ownerType,
          applicantId,
          coApplicantId,
        });

        // 🔥 bind new coApplicantId to UI
        if (!coApplicantId && res?.coApplicantId && localKey) {
          setCoApplicants((prev) =>
            prev.map((c) =>
              c.localKey === localKey
                ? { ...c, id: res.coApplicantId }
                : c
            )
          );
          coApplicantId = res.coApplicantId;
        }

        setLoading(loadingKey, false);

        if (res?.success) {
          openOtpFor({
            type: "mobile",
            target: field,
            value,
            ownerType,
            applicantId,
            coApplicantId,
          });
        }

        return;
      }

      // ----------------------------------
      // 🔹 EMAIL OTP
      // ----------------------------------
      if (
        field === "companyEmail" ||
        field === "applicantEmail" ||
        field === "coApplicantEmail"
      ) {
        if (!validateEmail(value)) {
          toast.info("Enter valid email");
          return;
        }

        setLoading(loadingKey, true);

        const res = await kycService.sendEmailOtp({
          customerId,
          email: value,
          ownerType,
          applicantId,
          coApplicantId,
        });

        // 🔥 bind new coApplicantId to UI
        if (!coApplicantId && res?.coApplicantId && localKey) {
          setCoApplicants((prev) =>
            prev.map((c) =>
              c.localKey === localKey
                ? { ...c, id: res.coApplicantId }
                : c
            )
          );
          coApplicantId = res.coApplicantId;
        }

        setLoading(loadingKey, false);

        if (res?.success) {
          openOtpFor({
            type: "email",
            target: field,
            value,
            ownerType,
            applicantId,
            coApplicantId,
          });
        }

        return;
      }

      // ----------------------------------
      // 🔹 PAN VERIFY
      // ----------------------------------
      if (
        field === "companyPan" ||
        field === "applicantPan" ||
        field === "coApplicantPan"
      ) {
        setLoading(loadingKey, true);

        try {
          const name =
            ownerType === "COMPANY"
              ? formData.companyName
              : ownerType === "APPLICANT"
                ? formData.applicantName
                : coApplicants.find((c) => c.id === coApplicantId)?.name;

          const res = await kycService.verifyPan({
            customerId,
            pan: value,
            name,
            ownerType,
            applicantId,
            coApplicantId,
          });

          await loadVerificationStatuses(customerId);

          if (!res?.success || !res?.data?.verified) {
            toast.error("PAN verification failed");
          }
        } finally {
          setLoading(loadingKey, false);
        }

        return;
      }

      // ----------------------------------
      // 🔹 GST VERIFY (Company only)
      // ----------------------------------
      if (field === "companyGst") {
        const gstKey = "companyGst_main";
        setLoading(gstKey, true);

        try {
          const res = await kycService.verifyGst({
            customerId,
            gstNumber: value,
            ownerType: "COMPANY",
          });

          if (!res?.success) {
            toast.error("GST verification failed");
          }

          await loadVerificationStatuses(customerId);
        } finally {
          setLoading(gstKey, false);
        }

        return;
      }

      // ----------------------------------
      // 🔹 AADHAAR VERIFY (Applicant & Co-applicant)
      // ----------------------------------
      if (field === "applicantAadhaar" || field === "coApplicantAadhaar") {
        if (field === "applicantAadhaar") {
          ownerType = "APPLICANT";
        } else {
          ownerType = "CO_APPLICANT";
        }

        setLoading(loadingKey, true);

        try {
          const res = await kycService.initiateAadhaarKyc({
            customerId,
            ownerType,
            applicantId,
            coApplicantId,
          });

          if (res?.success) {
            // Trigger SMS via backend (third-party API call)
            toast.success("Aadhaar KYC link sent to your mobile. Complete verification and click 'Refresh Status'.");
            
            // Load updated verification statuses
            await loadVerificationStatuses(customerId);
          } else {
            toast.error("Failed to initiate Aadhaar verification: " + (res?.message || "Unknown error"));
          }
        } catch (err) {
          toast.error("Aadhaar verification error: " + (err?.response?.data?.message || err.message));
        } finally {
          setLoading(loadingKey, false);
        }

        return;
      }
    } catch (e) {
      setLoading(`${field}_${coApplicantId || localKey || "main"}`, false);
      toast.error(
        `${field} verification failed: ` +
        (e?.response?.data?.message || e.message)
      );
    }
  };




  // ----- OCR / Uploads
  const handleApplicantPanUpload = async (file) => {
    if (!file) return;
    try {
      if (customerId) {
        // Upload to documents
        try {
          const uploadRes = await documentService.uploadDocument(customerId, file, "pan", "applicant", 0, null, {});
          // Add to UI immediately
          if (uploadRes?.data) {
            handleDocumentUploaded(uploadRes.data);
          }
          // refresh docs (in case backend logic changes)
          const docs = await documentService.getDocumentsByCustomer(customerId);
          setDocuments(docs.data);
        } catch (uploadErr) {
          console.error("Applicant PAN upload failed", uploadErr);
        }
      } else {
        toast.info("Please verify mobile first (Customer ID required) to save the document.");
      }

      const res = await kycService.runOcr(file, "PAN");
      if (res?.success) {
        setFormData((p) => ({
          ...p,
          applicantPan: res.data?.pan || p.applicantPan,
          applicantName: res.data?.name || p.applicantName,
        }));
        setApplicantKyc((p) => ({ ...p, panFile: file, panNumber: res.data?.pan || p.panNumber }));
        toast.success("OCR done");
      }
    } catch (e) {
      toast.error("OCR failed: " + (e?.response?.data?.message || e.message));
    }
  };

  const getApplicantVerified = (kind) => {
    if (!applicantStatus) return false;

    const map = {
      mobile: "mobileStatus",
      email: "emailStatus",
      pan: "panStatus",
      aadhaar: "aadhaarStatus",
    };

    return applicantStatus?.[map[kind]] === "VERIFIED";
  };


  const handleCompanyPanUpload = async (file) => {
    if (!file) return;
    try {
      if (customerId) {
        // Upload to documents
        try {
          await documentService.uploadDocument(customerId, file, "company_pan", "company", 0, null, {});
          // refresh docs
          const docs = await documentService.getDocumentsByCustomer(customerId);
          setDocuments(docs.data);
        } catch (uploadErr) {
          console.error("Company PAN upload failed", uploadErr);
        }
      } else {
        toast.info("Please verify mobile first (Customer ID required) to save the document.");
      }

      const res = await kycService.runOcr(file, "PAN");
      if (res?.success) {
        setFormData((p) => ({
          ...p,
          companyPan: res.data?.pan || p.companyPan,
          companyName: res.data?.name || p.companyName,
        }));
        setApplicantKyc((p) => ({ ...p, companyPanFile: file, companyPan: res.data?.pan || p.companyPan }));
        toast.success("Company PAN OCR done");
      }
    } catch (e) {
      toast.error("OCR failed: " + (e?.response?.data?.message || e.message));
    }
  };

  const handleCameraCapture = async (file) => {
    if (!file) return;

    if (cameraTarget === "applicant-pan") {
      await handleApplicantPanUpload(file);
    } else if (cameraTarget === "live-photo") {
      const doc = {
        id: Date.now(),
        fileName: "live_photo_capture.jpg",
        documentType: "live_photo",
        file,
        status: "pending",
        uploadedBy: "RM",
        createdAt: new Date().toISOString(),
      };
      setDocuments((prev) => [...prev, doc]);

      if (customerId) {
        try {
          await documentService.uploadDocument(customerId, file, "live_photo");
          toast.success("Live photo uploaded");
        } catch (e) {
          toast.error("Live photo upload failed: " + (e?.response?.data?.message || e.message));
        }
      } else {
        toast.info("Verify company mobile first (customer must exist) before uploading documents.");
      }
    }

    setShowCamera(false);
    setCameraTarget(null);
  };

  // ----- Validation
  const validateBasicTab = ({ strict }) => {
    const newErrors = {};

    if (!formData.companyType) newErrors.companyType = "Company type is required";

    if (!formData.companyName?.trim()) newErrors.companyName = "Company name is required";

    // Always validate formats if filled
    if (formData.companyMobile && !validateMobile(formData.companyMobile)) newErrors.companyMobile = "Valid company mobile required";
    if (formData.companyEmail && !validateEmail(formData.companyEmail)) newErrors.companyEmail = "Valid company email required";

    if (formData.applicantMobile && !validateMobile(formData.applicantMobile)) newErrors.applicantMobile = "Valid applicant mobile required";
    if (formData.applicantEmail && !validateEmail(formData.applicantEmail)) newErrors.applicantEmail = "Valid applicant email required";

    // Strict rules only on submit
    if (strict) {
      if (!customerId) newErrors.customer = "Customer not created yet. Verify company mobile first.";

      if (!formData.applicantName?.trim()) newErrors.applicantName = "Applicant name required";
      if (!validateMobile(formData.applicantMobile)) newErrors.applicantMobile = "Valid applicant mobile required";
      if (!validateEmail(formData.applicantEmail)) newErrors.applicantEmail = "Valid applicant email required";

      // Mandatory verifications (you said Aadhaar/bureau later, so NOT enforcing them now)
      if (!getCompanyVerified("mobile"))
        newErrors.companyMobile = "Company mobile verification mandatory";

      if (!getCompanyVerified("email"))
        newErrors.companyEmail = "Company email verification mandatory";

      if (!getApplicantVerified("pan"))
        newErrors.applicantPan = "Applicant PAN verification mandatory";


      // female co-app rule (keep if your business wants)
      if (formData.companyType === COMPANY_TYPES.PROPRIETORSHIP || formData.companyType === COMPANY_TYPES.PVT_LTD) {
        const hasFemale = coApplicants.some((c) => c.gender === "Female");
        if (!hasFemale) newErrors.coApplicants = "At least one female co-applicant is mandatory for this company type";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDocumentsTab = ({ strict }) => {
    if (!strict) return true;
    if (!formData.companyType) return true;
    const mandatoryDocs = checklist.filter((d) => d.mandatory);
    const uploadedTypes = new Set((documents || []).map((d) => d.documentType));
    const missing = mandatoryDocs.filter((d) => !uploadedTypes.has(d.documentType));
    if (missing.length) {
      toast.info("Upload mandatory documents:\n" + missing.map((m) => m.label).join("\n"));
      return false;
    }
    return true;
  };

  // ----- Build payload
  const getCustomerPayload = () => ({
    name: formData.applicantName,
    mobile: formData.applicantMobile,
    email: formData.applicantEmail,
    companyType: formData.companyType,
    companyName: formData.companyName || formData.applicantName,
    companyMobile: formData.companyMobile,
    companyEmail: formData.companyEmail,
    companyPan: formData.companyPan,
    gstNumber: formData.companyGst,
    pan: formData.applicantPan,
    remarks: formData.remarks,
  });

  // ----- Persist pipeline (single source)
  const persistFullCustomer = async (id) => {
    // 1) save customer base
    const payload = getCustomerPayload();
    await dispatch(updateCase({ id, data: payload })).unwrap();

    // 2) save applicant KYC entries (PAN, GST)
    if (applicantKyc?.panNumber) {
      await kycService.createKyc(id, {
        applicantType: "applicant",
        applicantIndex: 0,
        kycType: "PAN",
        kycNumber: applicantKyc.panNumber,
      });

      if (applicantKyc.panFile) {
        await documentService.uploadDocument(id, applicantKyc.panFile, "pan", "applicant", 0);
      }
    }

    if (formData.companyGst) {
      await kycService.createKyc(id, {
        applicantType: "applicant",
        applicantIndex: 0,
        kycType: "GST",
        kycNumber: formData.companyGst,
      });

      if (applicantKyc.gstFile) {
        await documentService.uploadDocument(id, applicantKyc.gstFile, "gst_certificate", "applicant", 0);
      }
    }

    // 3) co-applicants
    for (const coApp of coApplicants) {
      const key = coApp.id || coApp.localKey;
      const kyc = coApplicantKyc[key];

      const res = await kycService.processCoApplicant({
        id: coApp.id,
        customerId: id,
        name: coApp.name,
        mobile: coApp.mobile,
        email: coApp.email,
        gender: coApp.gender,
      });

      const coApplicantId = res?.data?.id;

      if (kyc?.panNumber && coApplicantId) {
        await kycService.createKyc(id, {
          coApplicantId,
          applicantType: "co-applicant",
          applicantIndex: 1,
          kycType: "PAN",
          kycNumber: kyc.panNumber,
        });

        if (kyc.panFile) {
          await documentService.uploadDocument(id, kyc.panFile, "pan", "co-applicant", 1, coApplicantId);
        }
      }
    }

    // 4) contact persons
    for (const cp of contactPersons) {
      await kycService.processContactPerson({
        id: cp.id,
        customerId: id,
        name: cp.name,
        mobile: cp.mobile,
        email: cp.email,
        designation: cp.designation,
        gender: cp.gender,
      });
    }

    // 5) addresses
    for (const addr of addresses) {
      await kycService.processAddress({
        id: addr.id,
        customerId: id,
        type: addr.type,
        fullAddress: addr.fullAddress,
        pincode: addr.pincode,
        state: addr.state,
        city: addr.city,
      });
    }
  };

  // ----- Draft
  const handleSaveDraft = async () => {
    // non-strict
    const ok = validateBasicTab({ strict: false });
    if (!ok) {
      setActiveTab("basic-kyc");
      return;
    }

    try {
      if (!customerId) {
        toast.info("First verify company mobile OTP (it creates the customer).");
        return;
      }
      await persistFullCustomer(customerId);
      toast.success("Draft saved");
      navigate("/rm/dashboard");
    } catch (e) {
      toast.error("Draft save failed: " + (e?.message || e));
    }
  };

  // ----- Submit
  const handleSubmit = async (pushedToCsv) => {
    const ok1 = validateBasicTab({ strict: true });
    if (!ok1) {
      setActiveTab("basic-kyc");
      toast.info("Fix errors in Basic & KYC tab");
      return;
    }

    const ok2 = validateDocumentsTab({ strict: true });
    if (!ok2) {
      setActiveTab("documents");
      return;
    }

    try {
      if (!customerId) {
        toast.info("Customer not created. Verify company mobile first.");
        return;
      }

      await persistFullCustomer(customerId);

      // if you need pushedTo field, save it before submit
      if (pushedToCsv) {
        await dispatch(updateCase({ id: customerId, data: { pushedTo: pushedToCsv } })).unwrap();
      }

      await dispatch(submitCase({ id: customerId, pushedTo: pushedToCsv })).unwrap();
      toast.success("Case submitted");
      navigate("/rm/dashboard");
    } catch (e) {
      toast.error("Submit failed: " + (e?.message || e));
    }
  };

  const handleDocumentUploaded = (doc) => {
    setDocuments((prev) => {
      const exists = prev.find((d) => d.id === doc.id);
      if (exists) return prev.map((d) => (d.id === doc.id ? doc : d));
      return [...prev, doc];
    });
  };

  const handleDocumentRemoved = (docId) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  if (isLoading) return <div className="p-6"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Customer Onboarding</h1>
        <p className="text-gray-600 mt-2">
          Step 1: Verify company mobile (creates customer). Then complete KYC & docs.
        </p>
        {!customerId && (
          <p className="mt-2 text-sm text-orange-600">
            ⚠️ Customer not created yet. Verify company mobile OTP to generate ID.
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("basic-kyc")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "basic-kyc"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Basic & KYC
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "documents"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Documents
          </button>
        </nav>
      </div>

      <div className="card space-y-6 p-4">
        {activeTab === "basic-kyc" && (
          <div className="space-y-8">
            <BasicKycTab
              formData={formData}
              setFormData={setFormData}
              applicantKyc={applicantKyc}
              errors={errors}
              loadingStates={loadingStates}
              onVerify={handleVerify}
              onApplicantPanUpload={handleApplicantPanUpload}
              onCompanyPanUpload={handleCompanyPanUpload}
              setApplicantKyc={setApplicantKyc}
              setShowCamera={setShowCamera}
              setCameraTarget={setCameraTarget}
              documents={documents}
              customerId={customerId}
              mainVerified={{
                mobile: getCompanyVerified("mobile"),
                email: getCompanyVerified("email"),
                pan: getCompanyVerified("pan"),
                gst: getCompanyVerified("gst"),
              }}
              applicantVerified={{
                mobile: getApplicantVerified("mobile"),
                email: getApplicantVerified("email"),
                pan: getApplicantVerified("pan"),
                aadhaar: getApplicantVerified("aadhaar"),
              }}
              applicantStatus={applicantStatus}
              onLoadVerificationStatuses={loadVerificationStatuses}

            />

            <CoApplicantSection
              customerId={customerId}
              coApplicants={coApplicants}
              setCoApplicants={setCoApplicants}
              coApplicantKyc={coApplicantKyc}
              setCoApplicantKyc={setCoApplicantKyc}
              onVerify={handleVerify}
              verificationStatuses={coApplicantStatusMap}
              loadingStates={loadingStates}
              errors={errors}
              onLoadVerificationStatuses={loadVerificationStatuses}
            />

            <ContactPersonSection
              contactPersons={contactPersons}
              setContactPersons={setContactPersons}
              errors={errors}
            />

            <AddressSection
              addresses={addresses}
              setAddresses={setAddresses}
              errors={errors}
            />

            {/* RM Remarks */}
            <div className="card mt-6 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 font-bold uppercase tracking-wider text-primary-600">
                RM Remarks
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
                className="input-field w-full"
                rows={4}
                placeholder="Add remarks..."
              />
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <DocumentsTab
            checklist={checklist}
            uploadedDocuments={documents}
            customerId={customerId || currentCase?.id}
            onDocumentUploaded={handleDocumentUploaded}
            onDocumentRemoved={handleDocumentRemoved}
          />
        )}

        {/* Actions */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <button onClick={handleSaveDraft} className="btn-secondary">
            Save Draft
          </button>

          <SubmitModal
            submissionTargets={submissionTargets}
            setSubmissionTargets={setSubmissionTargets}
            onConfirm={handleSubmit}
            disabled={!customerId}
          />
        </div>
      </div>

      {/* OTP Modal */}
      <OtpModal
        open={showOtpModal}
        otpValue={otpValue}
        setOtpValue={setOtpValue}
        otpData={otpData}
        isVerifying={isVerifying}
        onCancel={closeOtpModal}
        onVerify={() => handleOtpVerify()}
      />

      {/* Camera */}
      {showCamera && (
        <LivePhotoCapture
          onCapture={handleCameraCapture}
          onCancel={() => {
            setShowCamera(false);
            setCameraTarget(null);
          }}
          label={cameraTarget === "applicant-pan" ? "Capture PAN Card" : "Take Live Photo"}
        />
      )}
    </div>
  );
};

export default OnboardingContainer;
