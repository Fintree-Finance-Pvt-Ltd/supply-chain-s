import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { fetchCaseById } from "../../store/slices/caseSlice";
import { workflowService } from "../../services/workflowService";
import { documentService } from "../../services/documentService";
import kycService from "../../services/kycService";
import api from "../../services/api";
import DocumentUploader from "../../components/DocumentUploader";
import LoadingSpinner from "../../components/LoadingSpinner";
import ApprovalTimeline from "../../components/ApprovalTimeline";
import { formatDate } from "../../utils/format";
import CustomerFullDetails from "../../components/CustomerFullDetails";
import {
  FiFileText,
  FiCheck,
  FiSend,
  FiFile,
  FiLock,
  FiEye,
  FiCamera,
  FiRefreshCw,
  FiUpload,
} from "react-icons/fi";
import { toast } from "react-toastify";

const DETAIL_SECTIONS = [
  "documents",
  "kyc",
  "coApplicants",
  "addresses",
  "contactPersons",
  "history",
  "sanctions",
];

const RMCaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { currentCase, isLoading } = useSelector((state) => state.cases);

  const [bankDetails, setBankDetails] = useState({
    bankAccountNo: "",
    bankIfscCode: "",
    bankName: "",
    bankBranch: "",
    bankType: "savings", // Default
  });

  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Dynamic partners from API
  const [partners, setPartners] = useState([]);
  const [activePartners, setActivePartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [newPartnerCode, setNewPartnerCode] = useState("");
  const PARTNERS = partners;

  // Store sanction data for each partner
  const [partnerSanctions, setPartnerSanctions] = useState({});

  const isSanctionLocked = (partnerCode) =>
    (partnerSanctions[partnerCode]?.status || "").toLowerCase() === "approved";

  const buildUnlockedSanctionsArray = () =>
    PARTNERS.filter(
      (partner) =>
        !isSanctionLocked(partner.code) &&
        partnerSanctions[partner.code]?.sanctionAmount,
    ).map((partner) => ({
      partner: partner.code,
      sanctionAmount:
        parseFloat(partnerSanctions[partner.code].sanctionAmount) || 0,
        
      tenure: parseInt(partnerSanctions[partner.code].tenure) || 0,

      interestRate:
        parseFloat(partnerSanctions[partner.code].interestRate) || 0,

      penalCharges:
        parseFloat(partnerSanctions[partner.code].penalCharges) || 0,

      processingFees:
        parseFloat(partnerSanctions[partner.code].processingFees) || 0,

         legalCharges:
      parseFloat(partnerSanctions[partner.code].legalCharges) || 0,

    serviceFee:
      parseFloat(partnerSanctions[partner.code].serviceFee) || 0,
      
      conditions: partnerSanctions[partner.code].conditions || "",
    }));

  // Camera/OCR State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraType, setCameraType] = useState("environment"); // 'user' or 'environment'
  const handleUploadClick = () => {
    document.getElementById("fileInput").click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    // Call your cheque OCR upload function
    await handleUpload(file, "cheque");
  };

  useEffect(() => {
    if (id) {
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }));
    }
  }, [id, dispatch]);

  // Initialize partners - will be populated from sanctions API response
  // No longer fetching from /api/partners/active endpoint
  useEffect(() => {
    const fetchActivePartners = async () => {
      try {
        const response = await api.get("/partners/active");
        setActivePartners(response.data?.partners || []);
      } catch (err) {
        console.error("RMCaseDetail: Failed to fetch active partners:", err);
      }
    };

    fetchActivePartners();
  }, []);

  // Fetch sanctions from dedicated API (/sanctions/customer/:customerId)
  // This is the same endpoint used by credit_l2 and MD roles
  useEffect(() => {
    const fetchSanctionsAndPartners = async () => {
      if (!id) return;

      try {
        console.log("RMCaseDetail: Fetching from /sanctions/customer/" + id);
        const response = await api.get(`/sanctions/customer/${id}`);
        const data = response.data;
        const sanctions = Array.isArray(data) ? data : data.sanctions || [];

        if (sanctions.length > 0) {
          console.log("RMCaseDetail: Found sanctions:", sanctions);

          // Extract unique partners from sanctions
          const uniquePartners = [];
          const partnerMap = {};
          sanctions.forEach((s) => {
            if (s.partner && !partnerMap[s.partner]) {
              partnerMap[s.partner] = true;
              uniquePartners.push({
                code: s.partner,
                name: s.partnerName || s.partner,
              });
            }
          });
          setPartners(uniquePartners);

// Initialize partnerSanctions with data from API
          const initialSanctions = {};
          sanctions.forEach((s) => {
  if (s.partner) {
    const sanctionAmount = Number(
      s.sanctionAmount || s.sanction_limit || 0
    );
    initialSanctions[s.partner] = {
      sanctionAmount,
      tenure: Number(s.tenure) > 0 ? s.tenure : 12,
      interestRate: s.interestRate || s.roi || "",
      penalCharges:Number(s.penalCharges) > 0? s.penalCharges: 3,
      processingFees: s.processingFees || "",
      legalCharges:Number(s.legalCharges) > 0? s.legalCharges: sanctionAmount * 0.1,
      serviceFee: s.serviceFee || "",
      conditions: s.conditions || "",
      status: s.status || "pending",
    };
  }
});
          setPartnerSanctions(initialSanctions);
        }
        setPartnersLoading(false);
      } catch (err) {
        console.error("RMCaseDetail: Failed to fetch from API:", err);
        setPartnersLoading(false);
      }
    };

    fetchSanctionsAndPartners();
  }, [id]);

  useEffect(() => {
    if (currentCase) {
      setBankDetails({
        bankAccountNo: currentCase.bankAccountNo || "",
        bankIfscCode: currentCase.bankIfscCode || "",
        bankName: currentCase.bankName || "",
        bankBranch: currentCase.bankBranch || "",
        bankType: currentCase.bankType || "savings",
      });
    }
  }, [currentCase]);

const handleSaveBankDetails = async () => {
    setIsUpdating(true);
    try {
      // Build partner sanctions array
      await workflowService.updateBankDetails(id, {
        ...bankDetails,
        partnerSanctions: buildUnlockedSanctionsArray(),
      });
      toast.success("Details saved successfully");
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }));
    } catch (error) {
      toast.error("Failed to save bank details");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpload = async (file, type) => {
    try {
      // For cheque upload, use direct frontend OCR
      if (type === "cheque") {
        try {
          const ocrResult = await kycService.processChequeOcr(file);

          if (ocrResult.success) {
            const {
              bank_account_number,
              ifsc_code,
              bank_name,
              account_holder_name,
              micr_code,
              cheque_number,
            } = ocrResult.data;

            // Log provider name
            console.log("Cheque OCR Provider:", ocrResult.provider);

            // Auto-fill bank details from OCR
            setBankDetails({
              bankAccountNo: bank_account_number,
              bankIfscCode: ifsc_code,
              bankName: bank_name,
              bankBranch: "",
              bankType: "savings",
            });

            toast.success("Cheque OCR completed! Bank details auto-filled.");
            return; // Don't call documentService for cheque
          }
        } catch (ocrErr) {
          console.error("Cheque OCR Error:", ocrErr.message);
          toast.error("Unable to read cheque. Please enter details manually.");
        }
      }

      // For other document types, use the existing service
      await documentService.uploadDocument(id, file, type);
      toast.success("Document uploaded successfully");
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }));
    } catch (error) {
      toast.error(
        "Upload failed: " + (error.response?.data?.message || error.message),
      );
    }
  };

  const handleTriggerDigitalJourney = async (type) => {
    setIsUpdating(true);
    try {
      const payload =
        type === "esign"
          ? { eSignStatus: "completed" }
          : { eNachStatus: "completed" };
      await workflowService.updateBankDetails(id, payload);
      toast.success(
        `${type.toUpperCase()} triggered and simulated successfully`,
      );
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }));
    } catch (error) {
      toast.error("Action failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResendToPartner = async () => {
    if (!newPartnerCode) {
      toast.info("Select a new partner section");
      return;
    }

    setIsSubmitting(true);
    try {
      await workflowService.resendPartnerSanction(
        id,
        [newPartnerCode],
        `Resent for fresh sanction: ${newPartnerCode}`,
      );
      toast.success("Case resent to new partner section");
      dispatch(fetchCaseById({ id, sections: DETAIL_SECTIONS }));
      navigate("/rm/dashboard");
    } catch (error) {
      toast.error(
        "Resend failed: " + (error.response?.data?.message || error.message),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitToOps = async () => {
    if (!remarks.trim()) {
      toast.error("Please add submission remarks");
      return;
    }

    setIsSubmitting(true);
    try {
      await workflowService.submitToOperations(id, remarks);
      toast.success("Case submitted to Operations Team Successfully");
      navigate("/rm/dashboard");
    } catch (error) {
      toast.error("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Camera Logic
  const toggleCamera = async () => {
    if (isCameraOpen) {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      setIsCameraOpen(false);
      setCameraStream(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraType },
        });
        setCameraStream(stream);
        setIsCameraOpen(true);
      } catch (err) {
        toast.error("Camera access denied or not available");
      }
    }
  };

  const switchCamera = async () => {
    const newType = cameraType === "user" ? "environment" : "user";
    setCameraType(newType);
    if (isCameraOpen) {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newType },
        });
        setCameraStream(stream);
      } catch (err) {
        toast.error("Failed to switch camera");
      }
    }
  };

  const capturePhoto = async () => {
    const video = document.getElementById("camera-preview");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setCapturedImage(dataUrl);

    // Stop camera
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraOpen(false);
    setCameraStream(null);

    // Convert to file and process with direct OCR
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "cheque_capture.jpg", {
        type: "image/jpeg",
      });

      const ocrResult = await kycService.processChequeOcr(file);

      if (ocrResult.success) {
        const {
          bank_account_number,
          ifsc_code,
          bank_name,
          account_holder_name,
          micr_code,
          cheque_number,
        } = ocrResult.data;

        // Log provider name
        console.log("Cheque OCR Provider:", ocrResult.provider);

        // Auto-fill bank details from OCR
        setBankDetails({
          bankAccountNo: bank_account_number,
          bankIfscCode: ifsc_code,
          bankName: bank_name,
          bankBranch: "",
          bankType: "savings",
        });

        toast.success("Cheque OCR completed! Bank details auto-filled.");
      }
    } catch (ocrErr) {
      console.error("Cheque OCR Error:", ocrErr.message);
      toast.error(
        "Unable to read cheque. Please try again or enter details manually.",
      );
    }
  };

  const formatINR = (num) => {
    if (!num) return "";
    return new Intl.NumberFormat("en-IN").format(Number(num));
  };

  const numberToWords = (num) => {
    if (!num) return "";

    const a = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];

    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + " " + a[n % 10];
      if (n < 1000)
        return a[Math.floor(n / 100)] + " Hundred " + inWords(n % 100);
      if (n < 100000)
        return inWords(Math.floor(n / 1000)) + " Thousand " + inWords(n % 1000);
      if (n < 10000000)
        return inWords(Math.floor(n / 100000)) + " Lakh " + inWords(n % 100000);
      return (
        inWords(Math.floor(n / 10000000)) + " Crore " + inWords(n % 10000000)
      );
    };

    return inWords(Number(num)).trim();
  };

  const handleUploadCaptured = async () => {
    if (!capturedImage) return;
    // Convert dataUrl to File
    const blob = await (await fetch(capturedImage)).blob();
    const file = new File([blob], "cheque_capture.jpg", { type: "image/jpeg" });
    await handleUpload(file, "cheque");
    setCapturedImage(null);
  };

  if (isLoading) return <LoadingSpinner />;
  if (!currentCase) return <div>Case not found</div>;

  const formattedApprovals = (currentCase.statusHistory || []).map(
    (action) => ({
      approverName: action.changedByUser?.name || "Workflow System",
      approverRole:
        action.changedByUser?.defaultRole?.replace(/_/g, " ").toUpperCase() ||
        "System",
      status: action.status,
      approvedAt: action.createdAt,
      comments: action.remarks,
      sanctionAmount: action.sanctionAmount,
      tenure: action.tenure,
      interestRate: action.interestRate,
      penalCharges: action.penalCharges,
      processingFees: action.processingFees,
      legalCharges: action.legalCharges,
      serviceFee: action.serviceFee,
    }),
  );

  const isReadOnly = [
    "ops_l1_review",
    "ops_l1_approved",
    "ops_l2_verified",
    "ops_head_approved",
    "completed",
    "disbursed",
  ].includes(currentCase.status);

  const isStage2 = currentCase.status === "md_approved";
  const isReadyForFinalTerms = ["credit_l2_approved", "ceo_approved"].includes(
    currentCase.status,
  );
  const existingPartnerCodes = new Set(
    Object.keys(partnerSanctions).map((partnerCode) =>
      partnerCode.toUpperCase(),
    ),
  );
  const availableNewPartners = activePartners.filter(
    (partner) => !existingPartnerCodes.has((partner.code || "").toUpperCase()),
  );

  const statusLabel =
    currentCase.status === "md_approved"
        ? "MD FINAL APPROVED - PENDING DOCUMENTS"
        : currentCase.status.replace(/_/g, " ").toUpperCase();

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate("/rm/dashboard")}
            className="text-primary-600 hover:text-primary-700 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Post-Sanction Review
          </h1>
          <p className="text-gray-500">
            Complete digital journey and bank details.
          </p>
        </div>
        <div className="flex space-x-2">
          <span
            className={`badge ${isStage2 ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"} p-2`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <CustomerFullDetails customer={currentCase} />

          {/* Sanction Info (Editable by RM) */}
          <div className="card border-l-4 border-indigo-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Final Sanction Terms
              </h2>
              <FiSend
                className="text-primary-500"
                title="RM can now edit sanction details if required"
              />
            </div>

            {/* Show all partners when loading */}
            {partnersLoading ? (
              <div className="text-center py-4 text-gray-500">
                Loading partners...
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No active partners found
              </div>
            ) : (
              /* Show tabs/sections for each partner */
              PARTNERS.map((partner) => (
                <div
                  key={partner.code}
                  className="mb-6 pb-6 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-gray-800">
                      {partner.name || partner.code} ({partner.code})
                    </h3>
                    {isSanctionLocked(partner.code) ? (
                      <span className="text-xs font-bold uppercase text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1">
                        Locked
                      </span>
                    ) : (
                      <span className="text-xs font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        Fresh Request
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">
                        Sanction Amount
                      </label>
                      <input
                        type="number"
                        value={
                          partnerSanctions[partner.code]?.sanctionAmount
                            ? parseInt(
                                partnerSanctions[partner.code]?.sanctionAmount,
                              )
                            : ""
                        }
                        onWheel={(e) => e.target.blur()}
                        onChange={(e) =>
                          setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: {
                              ...partnerSanctions[partner.code],
                              sanctionAmount: e.target.value,
                            },
                          })
                        }
                      className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        readOnly={
                          isReadOnly ||
                          isStage2 ||
                          isSanctionLocked(partner.code)
                        }
                      />
                      {partnerSanctions[partner.code]?.sanctionAmount && (
                        <p className="mt-1 text-xs text-red-600 font-semibold">
                          ₹{" "}
                          {formatINR(
                            partnerSanctions[partner.code]?.sanctionAmount,
                          )}
                          <span className="block text-[11px] text-blue-700 italic">
                            (
                            {numberToWords(
                              partnerSanctions[partner.code]?.sanctionAmount,
                            )}{" "}
                            Only)
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">
                        Tenure (Months)
                      </label>
                      <input
                        type="number"
                        value={partnerSanctions[partner.code]?.tenure || ""}
                        onWheel={(e) => e.target.blur()}
                        onChange={(e) =>
                          setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: {
                              ...partnerSanctions[partner.code],
                              tenure: e.target.value,
                            },
                          })
                        }
                       className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        readOnly={
                          isReadOnly ||
                          isStage2 ||
                          isSanctionLocked(partner.code)
                        }
                      />
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">
                        Interest Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={
                          partnerSanctions[partner.code]?.interestRate || ""
                        }
                        onWheel={(e) => e.target.blur()}
                        onChange={(e) =>
                          setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: {
                              ...partnerSanctions[partner.code],
                              interestRate: e.target.value,
                            },
                          })
                        }
                        className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        readOnly={
                          isReadOnly ||
                          isStage2 ||
                          isSanctionLocked(partner.code)
                        }
                      />
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">
                       Penal Charges (%) (Monthly)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={
                          partnerSanctions[partner.code]?.penalCharges || ""
                        }
                        onWheel={(e) => e.target.blur()}
                        onChange={(e) =>
                          setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: {
                              ...partnerSanctions[partner.code],
                              penalCharges: e.target.value,
                            },
                          })
                        }
                        className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        readOnly={
                          isReadOnly ||
                          isStage2 ||
                          isSanctionLocked(partner.code)
                        }
                      />
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">
                        Processing Fees (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={
                          partnerSanctions[partner.code]?.processingFees || ""
                        }
                        onWheel={(e) => e.target.blur()}
                        onChange={(e) =>
                          setPartnerSanctions({
                            ...partnerSanctions,
                            [partner.code]: {
                              ...partnerSanctions[partner.code],
                              processingFees: e.target.value,
                            },
                          })
                        }
                        className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        readOnly={
                          isReadOnly ||
                          isStage2 ||
                          isSanctionLocked(partner.code)
                        }
                      />
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
  <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">
    Legal Charges
  </label>
  <input
    type="number"
    step="0.01"
    value={partnerSanctions[partner.code]?.legalCharges || ""}
    onWheel={(e) => e.target.blur()}
    onChange={(e) =>
      setPartnerSanctions({
        ...partnerSanctions,
        [partner.code]: {
          ...partnerSanctions[partner.code],
          legalCharges: e.target.value,
        },
      })
    }
    className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
    readOnly={isReadOnly || isStage2}
  />
</div>

<div className="p-3 bg-indigo-50 rounded-lg">
  <label className="block text-[10px] text-indigo-600 uppercase font-bold mb-1">
    Service Fees
  </label>
  <input
    type="number"
    step="0.01"
    value={partnerSanctions[partner.code]?.serviceFee || ""}
    onWheel={(e) => e.target.blur()}
    onChange={(e) =>
      setPartnerSanctions({
        ...partnerSanctions,
        [partner.code]: {
          ...partnerSanctions[partner.code],
          serviceFee: e.target.value,
        },
      })
    }
    className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-white text-lg font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
    readOnly={isReadOnly || isStage2}
  />
</div>


                  </div>
                </div>
              ))
            )}
          </div>

{availableNewPartners.length > 0 && (
            <div className="card border-l-4 border-amber-500">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Resend for Fresh Partner Sanction
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <select
                  value={newPartnerCode}
                  onChange={(e) => setNewPartnerCode(e.target.value)}
                  className="input-field"
                  disabled={availableNewPartners.length === 0 || isSubmitting}
                >
                  <option value="">
                    {availableNewPartners.length === 0
                      ? "No new partners available"
                      : "Select new partner"}
                  </option>
                  {availableNewPartners.map((partner) => (
                    <option key={partner.code} value={partner.code}>
                      {partner.name || partner.code} ({partner.code})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleResendToPartner}
                  disabled={
                    isSubmitting ||
                    !newPartnerCode ||
                    availableNewPartners.length === 0
                  }
                  className="btn-primary flex items-center justify-center space-x-2"
                >
                  <FiRefreshCw />
                  <span>Resend</span>
                </button>
              </div>
            </div>
          )}

          {/* Bank Details Form */}
          {isStage2 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Bank Details & Cheque OCR
              </h2>

              {/* Cheque OCR Section */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-gray-800">Cheque Capture</h4>
                    <p className="text-xs text-gray-500">
                      Capture cheque photo to auto-fill bank details
                    </p>
                  </div>
                  {!isReadOnly && !capturedImage && (
                    <div className="flex space-x-2">
                      <button
                        onClick={toggleCamera}
                        className="px-3 py-1 bg-primary-600 text-white text-xs rounded-full flex items-center space-x-1"
                      >
                        <FiCamera />
                        <span>{isCameraOpen ? "Stop" : "Start Camera"}</span>
                      </button>

                      {/* Upload Button */}
                      <button
                        onClick={handleUploadClick}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded-full flex items-center space-x-1"
                      >
                        <FiUpload />
                        <span>Upload</span>
                      </button>
                      <input
                        type="file"
                        id="fileInput"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                      />
                    </div>
                  )}
                </div>

                {isCameraOpen && (
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                    <video
                      id="camera-preview"
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el) el.srcObject = cameraStream;
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                      <button
                        onClick={switchCamera}
                        className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40"
                      >
                        <FiRefreshCw />
                      </button>
                      <button
                        onClick={capturePhoto}
                        className="p-4 bg-white rounded-full text-primary-600 shadow-lg hover:scale-110 transition-transform"
                      >
                        <div className="w-8 h-8 rounded-full border-4 border-primary-600" />
                      </button>
                    </div>
                  </div>
                )}

                {capturedImage && (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden border">
                      <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full"
                      />
                      <button
                        onClick={() => setCapturedImage(null)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow"
                      >
                        <FiRefreshCw />
                      </button>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleUploadCaptured}
                        className="btn-primary flex-1 py-2 text-xs"
                      >
                        Upload Cheque Image
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={bankDetails.bankAccountNo}
                    onChange={(e) =>
                      setBankDetails({
                        ...bankDetails,
                        bankAccountNo: e.target.value,
                      })
                    }
                    className="input-field"
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={bankDetails.bankIfscCode}
                    onChange={(e) =>
                      setBankDetails({
                        ...bankDetails,
                        bankIfscCode: e.target.value,
                      })
                    }
                    className="input-field"
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankDetails.bankName}
                    onChange={(e) =>
                      setBankDetails({
                        ...bankDetails,
                        bankName: e.target.value,
                      })
                    }
                    className="input-field"
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={bankDetails.bankBranch}
                    onChange={(e) =>
                      setBankDetails({
                        ...bankDetails,
                        bankBranch: e.target.value,
                      })
                    }
                    className="input-field"
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type
                  </label>
                  <select
                    value={bankDetails.bankType}
                    onChange={(e) =>
                      setBankDetails({
                        ...bankDetails,
                        bankType: e.target.value,
                      })
                    }
                    className="input-field"
                    disabled={isReadOnly}
                  >
                    <option value="savings">Savings</option>
                    <option value="current">Current</option>
                    <option value="overdraft">Overdraft</option>
                  </select>
                </div>
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleSaveBankDetails}
                  disabled={isUpdating}
                  className="mt-4 btn-secondary text-sm flex items-center space-x-1"
                >
                  {isUpdating ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <FiCheck className="h-4 w-4" />
                  )}
                  <span>Save Bank Details</span>
                </button>
              )}
            </div>
          )}

          {/* Digital Journey Actions */}
          {isStage2 && (
            <div className="grid grid-cols-2 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    E-NACH Mandate
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${currentCase.eNachStatus === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                  >
                    {currentCase.eNachStatus?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Setup automated repayment from customer's bank account.
                </p>
                <button
                  disabled={
                    isReadOnly ||
                    currentCase.eNachStatus === "completed" ||
                    isUpdating
                  }
                  onClick={() => handleTriggerDigitalJourney("enach")}
                  className="w-full btn-primary py-2 text-sm disabled:opacity-50"
                >
                  {isUpdating ? <LoadingSpinner size="sm" /> : "Trigger e-NACH"}
                </button>
              </div>
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    E-Sign Agreement
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${currentCase.eSignStatus === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                  >
                    {currentCase.eSignStatus?.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Digitally sign the loan agreement with the customer.
                </p>
                <button
                  disabled={
                    isReadOnly ||
                    currentCase.eSignStatus === "completed" ||
                    isUpdating
                  }
                  onClick={() => handleTriggerDigitalJourney("esign")}
                  className="w-full btn-primary py-2 text-sm disabled:opacity-50"
                >
                  {isUpdating ? <LoadingSpinner size="sm" /> : "Trigger e-Sign"}
                </button>
              </div>
            </div>
          )}

          {/* Bank Related Documents Folder */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Bank Related Documents
              </h2>
              {!isReadOnly && (
                <DocumentUploader
                  customerId={id}
                  onUpload={handleUpload}
                  documentTypes={[
                    { value: "cheque", label: "Cheque" },
                    { value: "live_photo", label: "Live Photo" },
                    { value: "shop_photo", label: "Shop Photo" },
                    { value: "bank_statement", label: "Bank Statement" },
                    { value: "other", label: "Other Documents" },
                  ]}
                />
              )}
            </div>
            <div className="space-y-2">
              {currentCase.documents?.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100"
                >
                  <div className="flex items-center space-x-3">
                    <FiFile className="text-gray-400" />
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {doc.fileName}
                        </span>
                        {doc.applicantType === "co-applicant" ? (
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                            CO-APP {doc.applicantIndex || ""}
                          </span>
                        ) : (
                          <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">
                            APPLICANT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold">
                        {doc.documentType}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">
                      {formatDate(doc.createdAt)}
                    </span>
                    <button
                      onClick={() => {
                        const fileUrl = doc.filePath.startsWith("http")
                          ? doc.filePath
                          : `${import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "http://localhost:3000"}/${doc.filePath.replace(/\\/g, "/")}`;
                        window.open(fileUrl, "_blank");
                      }}
                      className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                      title="Preview"
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {isReadyForFinalTerms ? "Submit Final Terms to MD" : "Submission to Operations"}
            </h2>
            {!isReadOnly && (isReadyForFinalTerms || currentCase.status === "md_approved") ? (
              <>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full input-field mb-4"
                  rows={4}
                  placeholder={isReadyForFinalTerms ? "Remarks for MD..." : "Final submission remarks..."}
                />
                
                {isReadyForFinalTerms ? (
                  <button
                    disabled={isSubmitting}
                    onClick={async () => {
                      if (!remarks.trim()) {
                        toast.error("Please add submission remarks");
                        return;
                      }
                      setIsSubmitting(true);
                      try {
                        await workflowService.submitTermsToMD(id, remarks, { partnerSanctions: buildUnlockedSanctionsArray() });
                        toast.success("Final terms submitted to MD successfully");
                        navigate("/rm/dashboard");
                      } catch (error) {
                        toast.error("Submission failed: " + (error.response?.data?.message || error.message));
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="w-full btn-primary flex items-center justify-center space-x-2 py-3"
                  >
                    <FiSend />
                    <span>Submit to MD</span>
                  </button>
                ) : (
                  <>
                    <button
                      disabled={isSubmitting}
                      onClick={handleSubmitToOps}
                      className="w-full btn-primary flex items-center justify-center space-x-2 py-3"
                    >
                      <FiSend />
                      <span>Final Submit to Ops</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                  Read Only Mode
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Case is not pending your action.
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <ApprovalTimeline approvals={formattedApprovals} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RMCaseDetail;
