import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { workflowService } from "../../services/workflowService";
import { customerService } from "../../services/customerService";
import { partnerService } from "../../services/partnerService";
import { caseManagementService } from "../../services/caseManagementService";
import api from "../../services/api";
import ApprovalTimeline from "../../components/ApprovalTimeline";
import CreditNotepad from "../../components/CreditNotepad";
import LoadingSpinner from "../../components/LoadingSpinner";
import CustomerFullDetails from "../../components/CustomerFullDetails";
import { formatDate } from "../../utils/format";
import { FiCheck, FiX, FiEye, FiFileText, FiDownload, FiArchive, FiPauseCircle, FiPlayCircle, FiUserCheck } from "react-icons/fi";

const DETAIL_SECTIONS = [
  "documents",
  "kyc",
  "coApplicants",
  "addresses",
  "contactPersons",
  "history",
  "sanctions",
];

const normalizeRole = (role) => (role || "").toString().toLowerCase();

const getUserRoleNames = (user) => {
  const roles = [
    ...(user?.roles || []).map((role) => role?.name || role),
    user?.role,
    user?.defaultRole,
  ]
    .map(normalizeRole)
    .filter(Boolean);

  return Array.from(new Set(roles));
};

const getApprovalRoleForStatus = (roles, primaryRole, status) => {
  const normalizedStatus = normalizeRole(status);

  if (normalizedStatus === "md_terms_submitted" && roles.includes("md")) {
    return "md";
  }

  return primaryRole;
};

const ApprovalScreen = () => {
  const { id } = useParams(); // This is now customerId
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [customer, setCustomer] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  // Supports multiple partner sanctions for management approval.
  const [partnerSanctions, setPartnerSanctions] = useState([]);
  const [sanctionData, setSanctionData] = useState({
    sanctionAmount: "",
    tenure: "",
    interestRate: "",
    penalCharges: "",
    processingFees: "",
    legalCharges: "",
    serviceFee: "",
    cashCollateral: "",
    conditions: "",
  });
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [previewedDocs, setPreviewedDocs] = useState(new Set());

  // Dynamic partners from API
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(true);

  // Fallback to default if API fails or for non-credit_team_l1 roles
  // For MD role: fallback is used until sanction records are loaded.
  const PARTNERS = partners.length > 0 ? partners : ["FFPL"];

  const userRoles = getUserRoleNames(user);
  const roleListLabel = userRoles.join(",");
  const primaryRole = normalizeRole(
    user?.role || user?.defaultRole || userRoles[0],
  );
  const hasCreditTeamL1Role = userRoles.includes("credit_team_l1");
  const approvalRole = getApprovalRoleForStatus(
    userRoles,
    primaryRole,
    customer?.status,
  );

  // Fetch partners from API - role-based logic
  // credit_l1: fetch from partners table (for new sanctions)
  // other roles (md, credit_l2, etc.): DO NOT fetch from partners table - use partners from sanction records
  useEffect(() => {
    // EARLY RETURN: Only credit_team_l1 should fetch from partners table
    // All other roles (md, credit_l2, etc.) should get partners from sanction records
    if (!hasCreditTeamL1Role) {
      console.log(
        "fetchPartners: Skipping - userRoles are",
        roleListLabel,
        "(not credit_team_l1)",
      );
      setPartnersLoading(false);
      return;
    }

    const fetchPartners = async () => {
      try {
        const data = await partnerService.getActivePartners();
        if (data.partners && data.partners.length > 0) {
          setPartners(data.partners.map((p) => p.code));
        }
      } catch (err) {
        console.error("Failed to fetch partners:", err);
      } finally {
        setPartnersLoading(false);
      }
    };

    fetchPartners();
  }, [hasCreditTeamL1Role, roleListLabel]);

  // Track if initial data load is done (useRef to persist across renders)
  const dataLoadedRef = useRef(false);
  const isActiveRenewalCase = Boolean(customer?.currentRenewalCycleId);
  const isPartnerLocked = (partnerSanction) =>
    !isActiveRenewalCase &&
    (partnerSanction.status || "").toLowerCase() === "approved";

  useEffect(() => {
    // Reset dataLoadedRef when id changes
    dataLoadedRef.current = false;

    const loadData = async () => {
      // Prevent multiple calls - only load once
      if (dataLoadedRef.current) {
        return;
      }

      // For credit_team_l1, wait for partners to load first (they come from partners table)
      if (hasCreditTeamL1Role && partnersLoading) {
        console.log("loadData: credit_team_l1 waiting for partners to load");
        return;
      }

      try {
        setIsLoading(true);

        // Fetch customer details and sanctions separately (like credit L2)
        const custResponse = await customerService.getCustomerWithSections(
          id,
          DETAIL_SECTIONS,
        );
        console.log("Customer response:", custResponse);
        setCustomer(custResponse.data);

        // Fetch sanctions using the dedicated API (like credit L2 for non-CREDIT_L1 roles)
        const sanctionsResponse = await api.get(`/sanctions/customer/${id}`);
        const sanctionsData = sanctionsResponse.data;
        const sanctions = Array.isArray(sanctionsData)
          ? sanctionsData
          : sanctionsData.sanctions || [];

        // Load all partner sanctions from credit_sanctions table
        // This is the correct source of truth - use partner field for mapping
        if (sanctions.length > 0) {
          // Build partner map from credit_sanctions using 'partner' field
          const partnerMap = {};
          sanctions.forEach((item) => {
            const partner = item.partner;
            partnerMap[partner] = {
              partner: partner,
              sanctionAmount: parseFloat(item.sanctionAmount || 0) || "",
              tenure: item.tenure || 0,
              interestRate: item.interestRate || 0,
              penalCharges:
                item.penalCharges !== null &&
                item.penalCharges !== undefined &&
                item.penalCharges !== 0
                  ? item.penalCharges
                  : "",
              processingFees: item.processingFees || 0,
              legalCharges: item.legalCharges || 0,
              serviceFee: item.serviceFee || 0,
              cashCollateral: item.cashCollateral || 0,
              conditions: item.conditions || "",
              status: item.status || "pending",
              hasData: true,
            };
          });

          // Get all unique partners from sanctions
          const uniquePartners = Object.keys(partnerMap);

          // Create array with ALL partners from sanctions data
          const partners = uniquePartners.map((p) => ({
            partner: p,
            sanctionAmount: partnerMap[p]?.sanctionAmount || 0,
            tenure: partnerMap[p]?.tenure || 0,
            interestRate: partnerMap[p]?.interestRate || 0,
            penalCharges: partnerMap[p]?.penalCharges || 0,
            processingFees: partnerMap[p]?.processingFees || 0,
            legalCharges: partnerMap[p]?.legalCharges || 0,
            serviceFee: partnerMap[p]?.serviceFee || 0,
            cashCollateral: partnerMap[p]?.cashCollateral || 0,
            conditions: partnerMap[p]?.conditions || "",
            status: partnerMap[p]?.status || "pending",
            hasData: true,
          }));
          setPartnerSanctions(partners);
        } else if (
          custResponse.data?.sanctionLimitHistory &&
          custResponse.data.sanctionLimitHistory.length > 0
        ) {
          // Fallback to sanctionLimitHistory only if no credit_sanctions exist
          const history = custResponse.data.sanctionLimitHistory;
          // Group by lender/partner - use LATEST entry (by createdAt)
          const partnerMap = {};
          history.forEach((item) => {
            const partner = item.lender || "";
            const itemDate = new Date(item.createdAt || 0);
            const existingDate = partnerMap[partner]
              ? new Date(partnerMap[partner].createdAt || 0)
              : new Date(0);

            // Always use the latest entry (most recent createdAt)
            if (!partnerMap[partner] || itemDate > existingDate) {
              partnerMap[partner] = {
                partner: partner,
                sanctionAmount: parseFloat(item.sanctionAmount || 0) || "",
                tenure: item.tenure || 0,
                interestRate: item.interestRate || 0,
                lanId: item.lanId || "",
                status: item.status || "pending",
                createdAt: item.createdAt,
              };
            }
          });
          // Get all unique partners from history
          const uniquePartners = Object.keys(partnerMap);
          // Create array with ALL partners from history data
          const partners = uniquePartners.map((p) => ({
            partner: p,
            sanctionAmount: partnerMap[p]?.sanctionAmount || 0,
            tenure: partnerMap[p]?.tenure || 0,
            interestRate: partnerMap[p]?.interestRate || 0,
            lanId: partnerMap[p]?.lanId || "",
            status: partnerMap[p]?.status || "pending",
            hasData: !!partnerMap[p],
          }));
          setPartnerSanctions(partners);
        } else {
          // Initialize with empty partners
          setPartnerSanctions(
            PARTNERS.map((p) => ({
              partner: p,
              sanctionAmount: 0,
              tenure: 0,
              interestRate: 0,
              status: "pending",
              hasData: false,
            })),
          );
        }

        // Also set the main sanction data for backward compatibility
        if (custResponse.data?.creditSanctions?.[0]) {
          const s = custResponse.data.creditSanctions[0];
          setSanctionData({
            sanctionAmount: s.sanctionAmount || "",
            tenure: s.tenure || "",
            interestRate: s.interestRate || "",
            penalCharges: s.penalCharges || "",
            processingFees: s.processingFees || "",

            conditions: s.conditions || "",
          });
        }

        // Find the customer onboarding workflow in the history or relations
        // For simplicity, we assume the data comes from getCustomerById
        // which should include the workflow status history.
        // If not, we can adjust.
      } catch (error) {
        console.error("Error loading approval data:", error);
      } finally {
        setIsLoading(false);
        dataLoadedRef.current = true;
      }
    };

    if (id) {
      loadData();
    }
  }, [id, partnersLoading, hasCreditTeamL1Role]);

  const updatePartnerSanction = (index, field, value) => {
    setPartnerSanctions((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const handleApprove = async () => {
    if (!comments.trim()) {
      toast.info("Please add comments before approving");
      return;
    }

    setIsSubmitting(true);
    try {
      if (approvalRole === "md") {
        // MD should approve/reject ONLY. Sanction terms must be pre-filled by RM.
        // Only send editable partner rows. Previously approved partners are locked
        // and must not be resent as modified sanctions.
        const editablePartnerSanctions = partnerSanctions
          .filter((ps) => !isPartnerLocked(ps))
          .map((ps) => ({
            ...ps,
            status: "approved",
          }));

        await workflowService.approveMD(id, true, comments, {
          partnerSanctions: editablePartnerSanctions,
        });
      } else {
        throw new Error("Unauthorized role for this action");
      }

      toast.success("Approval processed successfully");
      navigate("/management/dashboard");
    } catch (error) {
      toast.error(
        "Failed to approve: " +
          (error.response?.data?.message || error.message || error),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast.info("Please add rejection reason");
      return;
    }

    setIsSubmitting(true);
    try {
      if (approvalRole === "md") {
        // MD rejection should return case to RM for sanction re-review/edit.
        await workflowService.approveMD(id, false, comments);
      } else {
        throw new Error("Unauthorized role for this action");
      }

      toast.success("Approval rejected");
      navigate("/management/dashboard");
    } catch (error) {
      toast.error(
        "Failed to reject: " +
          (error.response?.data?.message || error.message || error),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshCustomer = async () => {
    const response = await customerService.getCustomerWithSections(
      id,
      DETAIL_SECTIONS,
    );
    setCustomer(response.data);
  };

  const handleHoldCase = async () => {
    const reason = window.prompt("Reason for putting this case on hold?") || "";
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await caseManagementService.holdCase(id, reason);
      toast.success("Case placed on hold");
      await refreshCustomer();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to hold case");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeCase = async () => {
    const note = window.prompt("Resume remarks?") || "";

    setIsSubmitting(true);
    try {
      await caseManagementService.resumeCase(id, note);
      toast.success("Case resumed");
      await refreshCustomer();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to resume case");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveCase = async () => {
    const reason = window.prompt("Reason for archiving this case?") || "";
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await caseManagementService.archiveCase(id, reason);
      toast.success("Case archived");
      await refreshCustomer();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to archive case");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReassignRM = async () => {
    const newRmId = window.prompt("Enter new RM user ID");
    if (!newRmId) return;
    const parsedRmId = Number(newRmId);
    if (!Number.isInteger(parsedRmId) || parsedRmId <= 0) {
      toast.error("Enter a valid RM user ID");
      return;
    }
    const note = window.prompt("Reassignment remarks?") || "";

    setIsSubmitting(true);
    try {
      await caseManagementService.reassignRM(id, parsedRmId, note);
      toast.success("RM reassigned");
      await refreshCustomer();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to reassign RM");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!customer) {
    return <div>Customer record not found</div>;
  }

  // Format history for timeline
  const formattedApprovals = (customer.statusHistory || []).map((action) => ({
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
  }));

  const isCreditDoc = (doc) => {
    const role = doc.uploadedByUser?.defaultRole?.toLowerCase() || "";
    return role.includes("credit");
  };

  // Helper function to detect MIME type from file extension
  const getMimeType = (fileName) => {
    const ext = fileName?.toLowerCase().split(".").pop() || "";
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // Excel
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    return mimeTypes[ext] || "application/octet-stream";
  };

  const handlePreview = async (doc, mode = "inline") => {
    setPreviewedDocs((prev) => new Set(prev).add(doc.id));
    try {
      const response = await api.get(
        `/documents/download/${doc.id}?mode=${mode}`,
        {
          responseType: "blob",
        },
      );
      const mimeType = getMimeType(doc.fileName);
      const blob = new Blob([response.data], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      if (mode === "attachment") {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = doc.fileName || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(blobUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to preview document:", error);
    }
  };

  const handlePreviewClick = (doc) => handlePreview(doc, "inline");
  const handleDownloadClick = (doc) => handlePreview(doc, "attachment");

  const role = approvalRole;
  const canManageCaseAsMD = role === "md";
  const isOnHold = customer.lifecycleStatus === "on_hold" || customer.status === "on_hold";

  // RM and MD can access sanction details
  const canAccessSanctionDetails = () => {
    return userRoles.includes("relationship_manager") || role === "md";
  };

  const isReadOnly =
    customer.status === "credit_l2_rejected" ||
    customer.status === "ceo_rejected" ||
    customer.status === "md_rejected" ||
    customer.status === "rejected" ||
    customer.status === "completed" ||
    customer.status.includes("ops") ||
    (role === "md" &&
      !["ceo_approved", "md_terms_submitted", "pending"].includes(
        customer.status,
      ));

  const visibleDocuments = customer.documents || [];
  // Management can approve even without viewing documents as per new request
  const allDocsPreviewed = true;

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

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/management/dashboard")}
          className="text-primary-600 hover:text-primary-700 mb-4"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Approval Screen</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CustomerFullDetails customer={customer} />

          {/* Only show sanction details for RM and MD roles */}
          {canAccessSanctionDetails() && (
            <div className="card border-l-4 border-secondary-600">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Sanction Details (Review & Revise)
              </h2>

              {false && (
                <div className="space-y-4 mb-4">
                  {partnerSanctions.map((ps, index) => (
                    <div
                      key={ps.partner}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-primary-600">
                          {ps.partner}
                        </span>
                        {isPartnerLocked(ps) ? (
                          <span className="text-xs font-bold uppercase text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1">
                            Locked
                          </span>
                        ) : ps.lanId ? (
                          <span className="text-xs text-gray-500">
                            LAN: {ps.lanId}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Sanction Amount (₹)
                          </label>
                          <input
                            type="number"
                            value={ps.sanctionAmount || ""}
                            onFocus={(e) => {
                              if (e.target.value === "0") e.target.value = "";
                            }}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => {
                              const updated = [...partnerSanctions];
                              updated[index].sanctionAmount =
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value);
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly || isPartnerLocked(ps)}
                          />
                          {ps.sanctionAmount && (
                            <p className="mt-1 text-xs text-red-600 font-medium italic">
                              ₹ {formatINR(ps.sanctionAmount)} (
                              {numberToWords(ps.sanctionAmount)} Only)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* MD sees all fields */}

              {role === "md" && (
                <div className="space-y-4 mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Partner Sanctions (L1 & L2 Credits)
                  </p>
                  {partnerSanctions.map((ps, index) => (
                    <div
                      key={ps.partner}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-primary-600">
                          {ps.partner}
                        </span>
                        {isPartnerLocked(ps) ? (
                          <span className="text-xs font-bold uppercase text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1">
                            Locked
                          </span>
                        ) : ps.lanId ? (
                          <span className="text-xs text-gray-500">
                            LAN: {ps.lanId}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Sanction Amount (₹)
                          </label>
                          <input
                            type="number"
                            value={ps.sanctionAmount || ""}
                            onFocus={(e) => {
                              if (e.target.value === "0") e.target.value = "";
                            }}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => {
                              // MD should not edit sanction terms
                              e.preventDefault();
                            }}
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />

                          {ps.sanctionAmount && (
                            <p className="mt-1 text-sm text-red-700 font-semibold">
                              ₹ {formatINR(ps.sanctionAmount)}
                              <span className="block text-xs text-blue-700 italic">
                                ({numberToWords(ps.sanctionAmount)} Only)
                              </span>
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Tenor (Months)
                          </label>
                          <input
                            type="number"
                            value={ps.tenure || ""}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) =>
                              updatePartnerSanction(
                                index,
                                "tenure",
                                e.target.value === ""
                                  ? ""
                                  : parseInt(e.target.value),
                              )
                            }
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            ROI (%) (yearly)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={ps.interestRate || ""}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) =>
                              updatePartnerSanction(
                                index,
                                "interestRate",
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value),
                              )
                            }
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Penal Charges (%) (yearly)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={
                              ps.penalCharges === 0
                                ? ""
                                : (ps.penalCharges ?? "")
                            }
                            placeholder="Enter Penal Charges (%)"
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) =>
                              updatePartnerSanction(
                                index,
                                "penalCharges",
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value),
                              )
                            }
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Processing Fee
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={
                              ps.processingFees === 0
                                ? ""
                                : (ps.processingFees ?? "")
                            }
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) =>
                              updatePartnerSanction(
                                index,
                                "processingFees",
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value),
                              )
                            }
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Legal Charges (%)
                          </label>

                          <input
                            type="number"
                            step="0.01"
                            value={
                              ps.legalCharges === 0
                                ? ""
                                : (ps.legalCharges ?? "")
                            }
                            placeholder="Enter Legal Charges"
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) =>
                              updatePartnerSanction(
                                index,
                                "legalCharges",
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value),
                              )
                            }
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Service Fee Charges (%)
                          </label>

                          <input
                            type="number"
                            step="0.01"
                            value={
                              ps.serviceFee === 0 ? "" : (ps.serviceFee ?? "")
                            }
                            placeholder="Service Fee Charges"
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) =>
                              updatePartnerSanction(
                                index,
                                "serviceFee",
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value),
                              )
                            }
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Cash Collateral
                          </label>

                          <input
                            type="number"
                            step="0.01"
                            value={
                              ps.cashCollateral === 0
                                ? ""
                                : (ps.cashCollateral ?? "")
                            }
                            placeholder="Cash Collateral"
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) =>
                              updatePartnerSanction(
                                index,
                                "cashCollateral",
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value),
                              )
                            }
                            className="input-field text-sm"
                            readOnly={isPartnerLocked(ps)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Conditions
                          </label>
                          <input
                            type="text"
                            value={ps.conditions || ""}
                            onChange={(e) => {
                              e.preventDefault();
                            }}
                            className="input-field text-sm"
                            readOnly={true}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* RM sees read-only view */}
              {role === "relationship_manager" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Sanction Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={sanctionData.sanctionAmount}
                      className="input-field text-sm bg-gray-100"
                      readOnly={true}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Tenor (Months)
                    </label>
                    <input
                      type="number"
                      value={sanctionData.tenure}
                      className="input-field text-sm bg-gray-100"
                      readOnly={true}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Proposed ROI (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={sanctionData.interestRate}
                      className="input-field text-sm bg-gray-100"
                      readOnly={true}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <CreditNotepad
            customerId={id}
            sanctions={partnerSanctions.map((sanction) => ({
              key: sanction.partner,
              name: sanction.partner,
            }))}
          />

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Documents for Review
            </h2>
            {visibleDocuments.length > 0 ? (
              <div className="space-y-4">
                {visibleDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white rounded shadow-sm">
                          <FiFileText className="text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium">
                              {doc.fileName}
                            </p>
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
                          <p className="text-[10px] text-gray-400 uppercase font-bold">
                            {doc.documentType}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePreviewClick(doc)}
                          className={`px-3 py-1 rounded text-xs font-bold border transition-colors flex items-center space-x-1 ${previewedDocs.has(doc.id) ? "bg-green-100 text-green-700 border-green-200" : "bg-primary-50 text-primary-600 border-primary-200 hover:bg-primary-100"}`}
                        >
                          {previewedDocs.has(doc.id) ? (
                            <>
                              <FiCheck className="h-3 w-3" />
                              <span>VIEWED</span>
                            </>
                          ) : (
                            <>
                              <FiEye className="h-3 w-3" />
                              <span>VIEW</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDownloadClick(doc)}
                          className="px-3 py-1 rounded text-xs font-bold border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center space-x-1"
                          title="Download"
                        >
                          <FiDownload className="h-3 w-3" />
                          <span>DOWNLOAD</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">
                          Issue Date
                        </p>
                        <p className="text-xs text-gray-700">
                          {doc.issueDate ? formatDate(doc.issueDate) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">
                          Expiry Date
                        </p>
                        <p className="text-xs text-gray-700">
                          {doc.expiryDate ? formatDate(doc.expiryDate) : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">
                          RM Remarks
                        </p>
                        <p
                          className="text-xs text-gray-700 truncate"
                          title={doc.rmRemarks}
                        >
                          {doc.rmRemarks || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No documents visible for review.
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Approval Remarks
            </h2>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="input-field"
              rows={4}
              placeholder={
                isReadOnly ? "Read-only mode" : "Enter your remarks/comments..."
              }
              required={!isReadOnly}
              readOnly={isReadOnly}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <ApprovalTimeline approvals={formattedApprovals} />
          </div>

          {canManageCaseAsMD && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Case Control
              </h2>
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
                <button
                  type="button"
                  onClick={handleReassignRM}
                  disabled={isSubmitting}
                  className="w-full btn-secondary flex items-center justify-center space-x-2"
                >
                  <FiUserCheck className="h-5 w-5" />
                  <span>Reassign RM</span>
                </button>
                <button
                  type="button"
                  onClick={handleArchiveCase}
                  disabled={isSubmitting || customer.lifecycleStatus === "archived"}
                  className="w-full btn-danger flex items-center justify-center space-x-2"
                >
                  <FiArchive className="h-5 w-5" />
                  <span>Archive Case</span>
                </button>
              </div>
            </div>
          )}

          <div className="card">
            {!isReadOnly ? (
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={
                    isSubmitting ||
                    (!allDocsPreviewed && visibleDocuments.length > 0)
                  }
                  className={`w-full btn-success flex items-center justify-center space-x-2 ${!allDocsPreviewed && visibleDocuments.length > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSubmitting ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <FiCheck className="h-5 w-5" />
                      <span>
                        {!allDocsPreviewed && visibleDocuments.length > 0
                          ? "Preview Docs to Enable"
                          : "Approve"}
                      </span>
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
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                  Read Only Mode
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Case has been processed or is not at your stage.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalScreen;
