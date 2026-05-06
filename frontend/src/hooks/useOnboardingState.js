import { useState } from "react";

export default function useOnboardingState() {
  const [activeTab, setActiveTab] = useState("basic-kyc");

  const [formData, setFormData] = useState({
    companyType: "",
    companyName: "",
    companyMobile: "",
    companyEmail: "",
    companyPan: "",
    companyGst: "",
    applicantName: "",
    applicantMobile: "",
    applicantEmail: "",
    applicantPan: "",
    applicantAadhaarNumber: "",
    applicantAddress: "",
    remarks: "",
  });

  const [applicantKyc, setApplicantKyc] = useState({
    panFile: null,
    gstFile: null,
    panNumber: "",
  });

  const [coApplicants, setCoApplicants] = useState([]);
  const [coApplicantKyc, setCoApplicantKyc] = useState({}); // key: id||localKey

  const [contactPersons, setContactPersons] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [errors, setErrors] = useState({});
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState(null);

  const [submissionTargets, setSubmissionTargets] = useState({
    credit: { selected: true, email: "credit_l1@scf.com", subject: "New Case", body: "Please review." },
    kite: { selected: false, email: "kite_partners@kite.com", subject: "New Case", body: "New lead." },
    muthoot: { selected: false, email: "support@muthoot.com", subject: "Customer Onboarding", body: "New case submission." },
    chola: { selected: false, email: "info@chola.com", subject: "Lead Referral", body: "Referring a new lead." },
  });

  return {
    activeTab, setActiveTab,
    formData, setFormData,
    applicantKyc, setApplicantKyc,
    coApplicants, setCoApplicants,
    coApplicantKyc, setCoApplicantKyc,
    contactPersons, setContactPersons,
    addresses, setAddresses,
    documents, setDocuments,
    errors, setErrors,
    showCamera, setShowCamera,
    cameraTarget, setCameraTarget,
    submissionTargets, setSubmissionTargets,
  };
}
