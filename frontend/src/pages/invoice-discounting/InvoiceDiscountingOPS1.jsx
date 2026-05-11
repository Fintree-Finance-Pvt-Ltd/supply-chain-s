import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { workflowService } from "../../services/workflowService";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import {
  FiCheck,
  FiX,
  FiFileText,
  FiDollarSign,
  FiCalendar,
  FiArrowRight,
} from "react-icons/fi";

export default function InvoiceDiscountingOPS1() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [disbursementInvoices, setDisbursementInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [actionType, setActionType] = useState("");
  const [remarks, setRemarks] = useState("");
  const [showViewModal, setShowViewModal] = useState(false);
  const [disbursementData, setDisbursementData] = useState({
    disbursementUtr: "",
    disbursementDate: "",
    invoiceDueDate: "",
  });
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pendingRes, disbursementRes] = await Promise.all([
        workflowService.getOPS1PendingInvoices(),
        workflowService.getDisbursementEntryInvoices(),
      ]);
      // Backend returns { success: true, data: [...] }
      setPendingInvoices(
        Array.isArray(pendingRes?.data?.data) ? pendingRes.data.data : [],
      );
      setDisbursementInvoices(
        Array.isArray(disbursementRes?.data?.data)
          ? disbursementRes.data.data
          : [],
      );
    } catch (error) {
      console.error("Error loading data:", error);
      setPendingInvoices([]);
      setDisbursementInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (invoice, type) => {
    setSelectedInvoice(invoice);
    setActionType(type);
    setShowModal(true);
  };

  const handleDisbursementEntry = (invoice) => {
    setSelectedInvoice(invoice);
    // Auto-calculate invoice due date as disbursement date + 90 days
    setDisbursementData({
      disbursementUtr: "",
      disbursementDate: "",
      invoiceDueDate: "",
    });
    setShowDisbursementModal(true);
  };

  const handleViewInvoice = (invoice) => {

      const invoiceDocs = invoice.invoiceFilePath
    ? [
        {
          id: invoice.id,

          fileName:
            invoice.invoiceNumber || "Invoice Document",

          filePath: invoice.invoiceFilePath,

          documentType: "INVOICE",
        },
      ]
    : [];

  setSelectedInvoice({
    ...invoice,

    invoiceDocuments: invoiceDocs,
  });

    // setSelectedInvoice(invoice);
    setShowViewModal(true);
   
  };

  const handleDisbursementDateChange = (date) => {
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 90);
    setDisbursementData({
      ...disbursementData,
      disbursementDate: date,
      invoiceDueDate: dueDate.toISOString().split("T")[0],
    });
  };

  const submitVerification = async () => {
    try {
      setLoading(true);
      if (actionType === "approve") {
        await workflowService.opsL1Approve(selectedInvoice.id, remarks);
        toast.success("Invoice approved successfully");
      } else {
        await workflowService.opsL1Reject(selectedInvoice.id, remarks);
        toast.success("Invoice rejected");
      }
      setShowModal(false);
      setRemarks("");
      loadData();
    } catch (error) {
      console.error("Error processing invoice:", error);
      toast.error("Error processing invoice");
    } finally {
      setLoading(false);
    }
  };

  const submitDisbursement = async () => {
    if (
      !disbursementData.disbursementUtr ||
      !disbursementData.disbursementDate
    ) {
      toast.info("Please fill all disbursement details");
      return;
    }

    try {
      setLoading(true);
      await workflowService.disburseInvoice(selectedInvoice.id, {
        ...disbursementData,
        loanAccountId: selectedInvoice.loanAccountId,
      });
      toast.success("Disbursement data saved successfully");
      setShowDisbursementModal(false);
      loadData();
    } catch (error) {
      console.error("Error saving disbursement:", error);
      toast.error("Error saving disbursement data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      DRAFT: { color: "gray", label: "Draft" },
      PENDING_CUSTOMER_APPROVAL: {
        color: "yellow",
        label: "Pending Customer Approval",
      },
      PENDING_OPS_L1_APPROVAL: {
        color: "blue",
        label: "Pending OPS L1 Approval",
      },
      PENDING_OPS_L2_APPROVAL: {
        color: "blue",
        label: "Pending OPS L2 Approval",
      },
      PENDING_MD_APPROVAL: { color: "blue", label: "Pending MD Approval" },
      PENDING_OPS_HEAD_APPROVAL: {
        color: "blue",
        label: "Pending OPS Head Approval",
      },
      DISBURSEMENT_DATA_ENTRY: {
        color: "yellow",
        label: "Disbursement Data Entry",
      },
      PENDING_FINAL_OPS_L2_APPROVAL: {
        color: "blue",
        label: "Pending Final OPS L2",
      },
      ACTIVE: { color: "green", label: "Active" },
      REJECTED_BY_CUSTOMER: { color: "red", label: "Rejected by Customer" },
      REJECTED: { color: "red", label: "Rejected" },
    };
    const s = statusMap[status] || {
      color: "gray",
      label: status || "Unknown",
    };
    return <StatusBadge status={s.color} label={s.label} />;
  };

  const renderInvoiceTable = (
    invoices,
    showActions = true,
    showDisbursementButton = false,
  ) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#f5f5f5" }}>
          <th
            style={{
              padding: "12px",
              textAlign: "left",
              borderBottom: "2px solid #ddd",
            }}
          >
            Invoice #
          </th>
          <th
            style={{
              padding: "12px",
              textAlign: "left",
              borderBottom: "2px solid #ddd",
            }}
          >
            Customer
          </th>
          <th
            style={{
              padding: "12px",
              textAlign: "left",
              borderBottom: "2px solid #ddd",
            }}
          >
            Supplier
          </th>
          <th
            style={{
              padding: "12px",
              textAlign: "right",
              borderBottom: "2px solid #ddd",
            }}
          >
            Amount
          </th>
          <th
            style={{
              padding: "12px",
              textAlign: "right",
              borderBottom: "2px solid #ddd",
            }}
          >
            Disbursement
          </th>
          <th
            style={{
              padding: "12px",
              textAlign: "center",
              borderBottom: "2px solid #ddd",
            }}
          >
            Status
          </th>
          {showActions && (
            <th
              style={{
                padding: "12px",
                textAlign: "center",
                borderBottom: "2px solid #ddd",
              }}
            >
              Actions
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {invoices.length === 0 ? (
          <tr>
            <td
              colSpan={showActions ? 7 : 6}
              style={{ padding: "20px", textAlign: "center", color: "#999" }}
            >
              No invoices found
            </td>
          </tr>
        ) : (
          invoices.map((invoice) => (
            <tr key={invoice.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "12px" }}>{invoice.invoiceNumber}</td>
              <td style={{ padding: "12px" }}>
                {invoice.customer?.name ||
                  invoice.customer?.companyName ||
                  invoice.customerName ||
                  "N/A"}
              </td>
              <td style={{ padding: "12px" }}>
                {invoice.supplier?.supplierName ||
                  invoice.supplierName ||
                  "N/A"}
              </td>
              <td style={{ padding: "12px", textAlign: "right" }}>
                ₹{invoice.invoiceAmount?.toLocaleString()}
              </td>
              <td style={{ padding: "12px", textAlign: "right" }}>
                ₹{invoice.disbursementAmount?.toLocaleString()}
              </td>
              <td style={{ padding: "12px", textAlign: "center" }}>
                {getStatusBadge(invoice.status)}
              </td>
              {showActions && (
                <td style={{ padding: "12px", textAlign: "center" }}>
                  {showDisbursementButton ? (
                    <button
                      onClick={() => handleDisbursementEntry(invoice)}
                      style={{
                        padding: "6px 12px",
                        background: "#28a745",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      <FiFileText style={{ marginRight: "4px" }} /> Enter
                      Disbursement
                    </button>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        justifyContent: "center",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* VIEW */}
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        style={{
                          padding: "6px 12px",
                          background: "#007bff",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        👁 View
                      </button>

                      {/* APPROVE */}
                      <button
                        onClick={() => handleVerify(invoice, "approve")}
                        style={{
                          padding: "6px 12px",
                          background: "#28a745",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <FiCheck /> Approve
                      </button>

                      {/* REJECT */}
                      <button
                        onClick={() => handleVerify(invoice, "reject")}
                        style={{
                          padding: "6px 12px",
                          background: "#dc3545",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <FiX /> Reject
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>

      {showViewModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "32px",
              borderRadius: "24px",
              width: "650px",
              maxHeight: "85vh",
              overflowY: "auto",
              position: "relative",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            {/* CLOSE BUTTON */}
            <button
              onClick={() => setShowViewModal(false)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                border: "none",
                background: "#f1f5f9",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#64748b",
                transition: "all 0.2s",
              }}
            >
              <FiX size={18} />
            </button>

            <h3 style={{
              marginBottom: "28px",
              fontSize: "22px",
              fontWeight: "800",
              color: "#1e293b",
              letterSpacing: "-0.02em"
            }}>
              Invoice Overview
            </h3>

            {/* TOP HIGHLIGHT CARD */}
            <div style={{
              background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
              padding: "20px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>
                  Invoice Number
                </div>
                <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "15px" }}>
                  {selectedInvoice?.invoiceNumber}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>
                  Current Status
                </div>
                <div>{getStatusBadge(selectedInvoice?.status)}</div>
              </div>
            </div>

            {/* DATA GRID */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              padding: "0 4px"
            }}>
              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  Customer
                </label>
                <div style={{ fontWeight: "600", color: "#334155", fontSize: "14px" }}>
                  {selectedInvoice?.customer?.name || selectedInvoice?.customerName}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  Supplier
                </label>
                <div style={{ fontWeight: "600", color: "#334155", fontSize: "14px" }}>
                  {selectedInvoice?.supplier?.supplierName || selectedInvoice?.supplierName}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px", marginTop: "4px" }}>
                <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  Invoice Amount
                </label>
                <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "16px" }}>
                  ₹{selectedInvoice?.invoiceAmount?.toLocaleString()}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px", marginTop: "4px" }}>
                <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  Disbursement
                </label>
                <div style={{ fontWeight: "800", color: "#6366f1", fontSize: "16px" }}>
                  ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}
                </div>
              </div>

              <div style={{ background: "#f5f3ff", padding: "12px", borderRadius: "12px" }}>
                <label style={{ fontSize: "11px", color: "#6366f1", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                  ROI
                </label>
                <div style={{ fontWeight: "700", color: "#4338ca", fontSize: "15px" }}>
                  {selectedInvoice?.roiPercentage}%
                </div>
              </div>

              <div style={{ background: "#fff1f2", padding: "12px", borderRadius: "12px" }}>
                <label style={{ fontSize: "11px", color: "#e11d48", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                  Penal Charges
                </label>
                <div style={{ fontWeight: "700", color: "#be123c", fontSize: "15px" }}>
                  {selectedInvoice?.penalCharges}%
                </div>


              </div>


              <div style={{ background: "#f1fff3", padding: "12px", borderRadius: "12px" }}>
                <label style={{ fontSize: "11px", color: "#074d31", fontWeight: "700", textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                  Service Fee
                </label>
                <div style={{ fontWeight: "700", color: "#074d33", fontSize: "15px" }}>
                  {selectedInvoice?.serviceFee}%
                </div>


              </div>
            </div>

            {/* DOCUMENTS SECTION */}
            <div style={{ marginTop: "24px", borderTop: "1px solid #f1f5f9", paddingTop: "20px" }}>
              <label style={{ fontSize: "13px", color: "#475569", fontWeight: "700", display: "block", marginBottom: "12px" }}>
                Attached Documents
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {!selectedInvoice?.invoiceDocuments || selectedInvoice.invoiceDocuments.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>No documents uploaded.</p>
                ) : (
                  selectedInvoice.invoiceDocuments.map((doc) => {
                    const apiBase =
                      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

                    const baseUrl = apiBase.replace("/api", "");
                    const fileUrl = doc.filePath?.startsWith("http")
                      ? doc.filePath
                      : `${baseUrl}/${doc.filePath.replace(/\\/g, "/")}`;

                    return (
                      <div key={doc.id} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#f8fafc",
                        padding: "10px 16px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0"
                      }}>
                        <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "250px" }}>
                          📄 {doc.fileName}
                        </span>
                        <button
                          onClick={() =>
                             window.open(fileUrl, "_blank")}
                          style={{
                            background: "#6366f1",
                            color: "#fff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            boxShadow: "0 4px 6px -1px rgba(99, 102, 241, 0.2)"
                          }}
                        >
                          View File
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* FOOTER ACTION */}
            <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  padding: "12px 32px",
                  background: "#1e293b",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 10px 15px -3px rgba(30, 41, 59, 0.3)",
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </table>
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div
      style={{
        padding: "30px",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#1e293b",
      }}
    >
      <h2
        style={{
          marginBottom: "30px",
          fontSize: "26px",
          fontWeight: "700",
          color: "#0f172a",
          letterSpacing: "-0.025em",
        }}
      >
        Invoice Discounting{" "}
        <span style={{ color: "#6366f1", fontWeight: "400" }}>
          — OPS L1 Dashboard
        </span>
      </h2>

      {/* Tabs */}
      <div
        style={{
          marginBottom: "0px",
          display: "flex",
          gap: "4px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "12px 24px",
            background: activeTab === "pending" ? "#fff" : "transparent",
            color: activeTab === "pending" ? "#6366f1" : "#64748b",
            border: "1px solid #e2e8f0",
            borderBottom:
              activeTab === "pending"
                ? "3px solid #6366f1"
                : "1px solid transparent",
            borderRadius: "12px 12px 0 0",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            transition: "all 0.2s ease",
            marginBottom: "-1px",
            zIndex: activeTab === "pending" ? 2 : 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Pending Verification
          <span
            style={{
              background: activeTab === "pending" ? "#eef2ff" : "#f1f5f9",
              color: activeTab === "pending" ? "#6366f1" : "#94a3b8",
              padding: "2px 8px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "700",
            }}
          >
            {pendingInvoices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("disbursement")}
          style={{
            padding: "12px 24px",
            background: activeTab === "disbursement" ? "#fff" : "transparent",
            color: activeTab === "disbursement" ? "#6366f1" : "#64748b",
            border: "1px solid #e2e8f0",
            borderBottom:
              activeTab === "disbursement"
                ? "3px solid #6366f1"
                : "1px solid transparent",
            borderRadius: "12px 12px 0 0",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            transition: "all 0.2s ease",
            marginBottom: "-1px",
            zIndex: activeTab === "disbursement" ? 2 : 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Disbursement Entry
          <span
            style={{
              background: activeTab === "disbursement" ? "#eef2ff" : "#f1f5f9",
              color: activeTab === "disbursement" ? "#6366f1" : "#94a3b8",
              padding: "2px 8px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: "700",
            }}
          >
            {disbursementInvoices.length}
          </span>
        </button>
      </div>

      {/* Content Container */}
      <div
        style={{
          background: "#fff",
          padding: "0px", // Table looks better with 0 padding at container level
          borderRadius: "0 0 20px 20px",
          boxShadow:
            "0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
          border: "1px solid #e2e8f0",
          borderTop: "none",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "24px" }}>
          {activeTab === "pending"
            ? renderInvoiceTable(pendingInvoices, true, false)
            : renderInvoiceTable(disbursementInvoices, true, true)}
        </div>
      </div>

      {/* Verification Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "28px",
              width: "100%",
              maxWidth: "540px",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {/* Header Section */}
            <div
              style={{
                padding: "32px 40px",
                background: actionType === "approve"
                  ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)"
                  : "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: actionType === "approve" ? "#10b981" : "#ef4444",
                color: "#fff",
                fontSize: "20px"
              }}>
                {actionType === "approve" ? <FiCheck /> : <FiX />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
                  {actionType === "approve" ? "Verify & Approve" : "Reject Application"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748b", fontWeight: "500" }}>
                  Please review the details before proceeding
                </p>
              </div>
            </div>

            <div style={{ padding: "32px 40px", overflowY: "auto" }}>
              {/* Info Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
                {[
                  { label: "Invoice ID", value: selectedInvoice?.invoiceNumber },
                  { label: "Customer", value: selectedInvoice?.customer?.name || "N/A" },
                  { label: "Supplier", value: selectedInvoice?.supplier?.supplierName || "N/A" },
                  { label: "Release Amount", value: `₹${selectedInvoice?.disbursementAmount?.toLocaleString()}`, highlight: true },
                ].map((item, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "#f8fafc",
                    borderRadius: "14px",
                    border: "1px solid #f1f5f9"
                  }}>
                    <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.025em" }}>
                      {item.label}
                    </span>
                    <span style={{
                      fontSize: item.highlight ? "16px" : "14px",
                      fontWeight: "700",
                      color: item.highlight ? "#6366f1" : "#1e293b"
                    }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Remarks Input */}
              <div style={{ marginBottom: "8px" }}>
                <label style={{ display: "block", marginBottom: "10px", fontWeight: "700", fontSize: "13px", color: "#475569", marginLeft: "4px" }}>
                  Internal Remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Provide a brief reason for this action..."
                  style={{
                    width: "100%",
                    padding: "16px",
                    border: "2px solid #f1f5f9",
                    borderRadius: "16px",
                    minHeight: "110px",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    outline: "none",
                    backgroundColor: "#fdfdfd",
                    transition: "all 0.2s ease",
                    resize: "none"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                  onBlur={(e) => (e.target.style.borderColor = "#f1f5f9")}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{
              padding: "24px 40px 40px",
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
              background: "#fff"
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "14px 24px",
                  background: "#fff",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "14px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => (e.target.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.target.style.background = "#fff")}
              >
                Cancel
              </button>
              <button
                onClick={submitVerification}
                disabled={loading}
                style={{
                  padding: "14px 32px",
                  background: actionType === "approve" ? "#10b981" : "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "14px",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "14px",
                  boxShadow: actionType === "approve"
                    ? "0 10px 20px -6px rgba(16, 185, 129, 0.4)"
                    : "0 10px 20px -6px rgba(239, 68, 68, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                {loading ? "Processing..." : (actionType === "approve" ? "Release Approval" : "Confirm Rejection")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disbursement Entry Modal */}
      {showDisbursementModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "40px",
              borderRadius: "24px",
              width: "520px",
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <h3
              style={{
                marginBottom: "28px",
                fontSize: "22px",
                fontWeight: "800",
                color: "#1e293b",
              }}
            >
              Confirm Disbursement
            </h3>

            <div
              style={{
                marginBottom: "30px",
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                padding: "24px",
                borderRadius: "16px",
                display: "flex",
                justifyContent: "space-between",
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  Invoice Reference
                </div>
                <div style={{ fontWeight: "700", fontSize: "15px" }}>
                  {selectedInvoice?.invoiceNumber}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  Net Payment
                </div>
                <div
                  style={{
                    fontWeight: "800",
                    color: "#059669",
                    fontSize: "20px",
                  }}
                >
                  ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "10px",
                  fontWeight: "700",
                  fontSize: "14px",
                  color: "#475569",
                }}
              >
                <FiFileText style={{ marginRight: "8px", color: "#6366f1" }} />
                Bank UTR Number
              </label>
              <input
                type="text"
                value={disbursementData.disbursementUtr}
                onChange={(e) =>
                  setDisbursementData({
                    ...disbursementData,
                    disbursementUtr: e.target.value,
                  })
                }
                placeholder="Enter Transaction Reference"
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "2px solid #f1f5f9",
                  borderRadius: "12px",
                  fontSize: "14px",
                  outline: "none",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.target.style.borderColor = "#f1f5f9")}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "10px",
                  fontWeight: "700",
                  fontSize: "14px",
                  color: "#475569",
                }}
              >
                <FiCalendar style={{ marginRight: "8px", color: "#6366f1" }} />
                Payment Date
              </label>
              <input
                type="date"
                value={disbursementData.disbursementDate}
                onChange={(e) => handleDisbursementDateChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "2px solid #f1f5f9",
                  borderRadius: "12px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div
              style={{
                marginBottom: "30px",
                padding: "16px",
                background: "#f5f3ff",
                borderRadius: "12px",
                border: "1px dashed #c7d2fe",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "#4338ca",
                    fontWeight: "600",
                  }}
                >
                  Calculated Due Date:
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "#4338ca",
                  }}
                >
                  {disbursementData.invoiceDueDate || "--"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "14px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowDisbursementModal(false)}
                style={{
                  padding: "12px 24px",
                  background: "#f1f5f9",
                  color: "#64748b",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontWeight: "700",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitDisbursement}
                disabled={loading}
                style={{
                  padding: "12px 30px",
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "14px",
                  boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.4)",
                }}
              >
                Release Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
