import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { workflowService } from "../../services/workflowService";
import { customerService } from "../../services/customerService";
import { partnerService } from "../../services/partnerService";
import api from "../../services/api";
import ApprovalTimeline from "../../components/ApprovalTimeline";
import LoadingSpinner from "../../components/LoadingSpinner";
import CustomerFullDetails from "../../components/CustomerFullDetails";
import { formatDate } from "../../utils/format";
import { FiCheck, FiX, FiEye, FiFileText } from "react-icons/fi";

const ApprovalScreen = () => {
  const { id } = useParams(); // This is now customerId
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [customer, setCustomer] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  // For CEO: support multiple partner sanctions
  const [partnerSanctions, setPartnerSanctions] = useState([]);
  const [sanctionData, setSanctionData] = useState({
    sanctionAmount: "",
    tenure: "",
    interestRate: "",
    penalCharges: "",
    processingFees: "",
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
  // For CEO/MD roles: they don't fetch from API, so use fallback
  const PARTNERS = partners.length > 0 ? partners : ["FFPL"];

  // Get user role (lowercase for comparison)
  const userRole = (user?.role || "").toLowerCase();

  // Fetch partners from API - role-based logic
  // credit_l1: fetch from partners table (for new sanctions)
  // other roles (ceo, md, credit_l2, etc.): DO NOT fetch from partners table - use partners from sanction records
  useEffect(() => {
    // EARLY RETURN: Only credit_team_l1 should fetch from partners table
    // All other roles (ceo, md, credit_l2, etc.) should get partners from sanction records
    if (userRole !== "credit_team_l1") {
      console.log(
        "fetchPartners: Skipping - userRole is",
        userRole,
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
  }, [userRole]);

  // Track if initial data load is done (useRef to persist across renders)
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    // Reset dataLoadedRef when id changes
    dataLoadedRef.current = false;

    const loadData = async () => {
      // Prevent multiple calls - only load once
      if (dataLoadedRef.current) {
        return;
      }

      // For credit_team_l1, wait for partners to load first (they come from partners table)
      if (userRole === "credit_team_l1" && partnersLoading) {
        console.log("loadData: credit_team_l1 waiting for partners to load");
        return;
      }

      try {
        setIsLoading(true);

        // Fetch customer details and sanctions separately (like credit L2)
        const custResponse = await customerService.getCustomerById(id);
        setCustomer(custResponse.data);

        // Fetch sanctions using the dedicated API (like credit L2 for non-CREDIT_L1 roles)
        const sanctionsResponse = await api.get(`/sanctions/customer/${id}`);
        const sanctionsData = sanctionsResponse.data;
        const sanctions = Array.isArray(sanctionsData)
          ? sanctionsData
          : sanctionsData.sanctions || [];

        // For CEO: load all partner sanctions from credit_sanctions table
        // This is the correct source of truth - use partner field for mapping
        if (sanctions.length > 0) {
          // Build partner map from credit_sanctions using 'partner' field
          const partnerMap = {};
          sanctions.forEach((item) => {
            const partner = item.partner;
            partnerMap[partner] = {
              partner: partner,
              sanctionAmount: item.sanctionAmount || 0,
              tenure: item.tenure || 0,
              interestRate: item.interestRate || 0,
              penalCharges: item.penalCharges || 0,
              processingFees: item.processingFees || 0,
              conditions: item.conditions || "",
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
            conditions: partnerMap[p]?.conditions || "",
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
                sanctionAmount: item.sanctionAmount || 0,
                tenure: item.tenure || 0,
                interestRate: item.interestRate || 0,
                lanId: item.lanId || "",
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
  }, [id, partnersLoading]);

  const handleApprove = async () => {
    if (!comments.trim()) {
      alert("Please add comments before approving");
      return;
    }

    setIsSubmitting(true);
    try {
      const userRole = (user?.role || "").toLowerCase();

      // For CEO and MD: use partnerSanctions format
      if (userRole === "ceo") {
        const ceoSanctionData = {
          partnerSanctions: partnerSanctions.map((ps) => ({
            partner: ps.partner,
            sanctionAmount: ps.sanctionAmount || 0,
            // CEO can only modify sanctionAmount
          })),
        };
        await workflowService.approveCEO(id, true, comments, {
          partnerSanctions: ceoSanctionData.partnerSanctions,
        });
      } else if (userRole === "md") {
        // MD can modify all fields
        const mdSanctionData = {
          partnerSanctions: partnerSanctions.map((ps) => ({
            partner: ps.partner,
            sanctionAmount: ps.sanctionAmount || 0,
            tenure: ps.tenure || 0,
            interestRate: ps.interestRate || 0,
            penalCharges: ps.penalCharges || 0,
            processingFees: ps.processingFees || 0,
            conditions: ps.conditions || "",
          })),
        };
        await workflowService.approveMD(id, true, comments, {
          partnerSanctions: mdSanctionData.partnerSanctions,
        });
      } else {
        throw new Error("Unauthorized role for this action");
      }

      alert("Approval processed successfully");
      navigate("/management/dashboard");
    } catch (error) {
      alert(
        "Failed to approve: " +
          (error.response?.data?.message || error.message || error),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      alert("Please add rejection reason");
      return;
    }

    setIsSubmitting(true);
    try {
      const userRole = (user?.role || "").toLowerCase();
      if (userRole === "ceo") {
        await workflowService.approveCEO(id, false, comments);
      } else if (userRole === "md") {
        await workflowService.approveMD(id, false, comments);
      } else {
        throw new Error("Unauthorized role for this action");
      }

      alert("Approval rejected");
      navigate("/management/dashboard");
    } catch (error) {
      alert(
        "Failed to reject: " +
          (error.response?.data?.message || error.message || error),
      );
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

  const handlePreview = (doc) => {
    setPreviewedDocs((prev) => new Set(prev).add(doc.id));
    const fileUrl = `${import.meta.env.VITE_API_BASE_URL}/documents/download/${doc.id}`;
    window.open(fileUrl, "_blank");
  };

  const role = (user?.role || "").toLowerCase();

  // RM, MD, and CEO can access sanction details
  const canAccessSanctionDetails = () => {
    return role === "relationship_manager" || role === "md" || role === "ceo";
  };

  const isReadOnly =
    customer.status === "credit_l2_rejected" ||
    customer.status === "ceo_rejected" ||
    customer.status === "md_rejected" ||
    customer.status === "rejected" ||
    customer.status === "completed" ||
    customer.status.includes("ops") ||
    (role === "ceo" && customer.status !== "credit_l2_approved") ||
    (role === "md" &&
      !["ceo_approved", "md_terms_submitted"].includes(customer.status));

  const visibleDocuments = customer.documents || [];
  // Management (CEO/MD) can approve even without viewing documents as per new request
  const allDocsPreviewed = true;

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
            <div className="card border-l-4 border-primary-500">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Sanction Details (Review & Revise)
              </h2>

              {/* CEO sees only sanction amount, MD sees all fields */}
              {role === "ceo" && (
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
                        {ps.lanId && (
                          <span className="text-xs text-gray-500">
                            LAN: {ps.lanId}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Sanction Amount (₹)
                          </label>
                          <input
                            type="number"
                            value={ps.sanctionAmount}
                            onChange={(e) => {
                              const updated = [...partnerSanctions];
                              updated[index].sanctionAmount =
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value);
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                        {ps.lanId && (
                          <span className="text-xs text-gray-500">
                            LAN: {ps.lanId}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Sanction Amount (₹)
                          </label>
                          <input
                            type="number"
                            value={ps.sanctionAmount}
                            onChange={(e) => {
                              const updated = [...partnerSanctions];
                              updated[index].sanctionAmount =
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value);
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Tenor (Months)
                          </label>
                          <input
                            type="number"
                            value={ps.tenure}
                            onChange={(e) => {
                              const updated = [...partnerSanctions];
                              updated[index].tenure =
                                e.target.value === ""
                                  ? ""
                                  : parseInt(e.target.value);
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            ROI (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={ps.interestRate}
                            onChange={(e) => {
                              const updated = [...partnerSanctions];
                              updated[index].interestRate =
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value);
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly}
                          />
                        </div>
                      </div>
                      {/* MD can also edit penal charges, processing fees, and conditions */}
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Penal Charges (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={ps.penalCharges ?? ""}
                            onChange={(e) => {
                              const updated = [...partnerSanctions];
                              updated[index].penalCharges =
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value);
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Processing Fee (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={ps.processingFees ?? ""}
                            onChange={(e) => {
                              const updated = [...partnerSanctions];
                              updated[index].processingFees =
                                e.target.value === ""
                                  ? ""
                                  : parseFloat(e.target.value);
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly}
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
                              const updated = [...partnerSanctions];
                              updated[index].conditions = e.target.value;
                              setPartnerSanctions(updated);
                            }}
                            className="input-field text-sm"
                            readOnly={isReadOnly}
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
                      <button
                        onClick={() => handlePreview(doc)}
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
                            <span>VIEW DOCUMENT</span>
                          </>
                        )}
                      </button>
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

          <div className="card">
            {!isReadOnly ? (
              <div className="space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={
                    isSubmitting ||
                    (!allDocsPreviewed && visibleDocuments.length > 0)
                  }
                  className={`w-full btn-primary flex items-center justify-center space-x-2 ${!allDocsPreviewed && visibleDocuments.length > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
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
