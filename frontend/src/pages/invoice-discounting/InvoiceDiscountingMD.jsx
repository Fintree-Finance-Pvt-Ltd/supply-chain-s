import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { workflowService } from "../../services/workflowService";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import { FiCheck, FiX, FiEye } from "react-icons/fi";



import { documentService } from "../../services/documentService"; 

export default function InvoiceDiscountingMD() {
  const [loading, setLoading] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState("");
  const [remarks, setRemarks] = useState("");


  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
const [selectedCustomerInvoices, setSelectedCustomerInvoices] = useState([]);
const [selectedCustomerDocs, setSelectedCustomerDocs] = useState([]);
const [selectedCustomerName, setSelectedCustomerName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await workflowService.getMDPendingInvoices();
      // Backend returns { success: true, data: [...] }
      setPendingInvoices(response?.data?.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (invoice, type) => {
    setSelectedInvoice(invoice);
    setActionType(type);
    setShowModal(true);
  };

  const submitVerification = async () => {
    try {
      setLoading(true);
      if (actionType === "approve") {
        await workflowService.mdApprove(selectedInvoice.id, remarks);
        toast.success("Invoice approved successfully");
      } else {
        await workflowService.mdReject(selectedInvoice.id, remarks);
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

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING_MD_APPROVAL: { color: "blue", label: "Pending MD Approval" },
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

  if (loading) return <LoadingSpinner />;



const handleViewCustomerInvoices = async (invoice) => {
  try {
    setLoading(true);

    const customerId = invoice.customer?.id;

    // Already fetched invoice data
    const customerInvoices = pendingInvoices.filter(
      (inv) => inv.customer?.id === customerId
    );

    setSelectedCustomerInvoices(customerInvoices);

    setSelectedCustomerName(
      invoice.customer?.name ||
      invoice.customer?.companyName ||
      "Customer"
    );

    // CREATE DOC MAP FROM INVOICE TABLE ITSELF
    const map = {};

    customerInvoices.forEach((inv) => {
      map[inv.id] = inv.invoiceFilePath
        ? [
            {
              id: inv.id,
              fileName: inv.invoiceNumber || "Invoice File",
              filePath: inv.invoiceFilePath,
              uploadedByUser: {
                name: inv.createdBy?.name || "System",
              },
            },
          ]
        : [];
    });

    setSelectedCustomerDocs(map);

  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  
  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "20px" }}>
        Invoice Discounting - MD Dashboard
      </h2>

      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginBottom: "20px" }}>
          Pending Approval ({pendingInvoices.length})
        </h3>

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
              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                  borderBottom: "2px solid #ddd",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pendingInvoices.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#999",
                  }}
                >
                  No invoices pending approval
                </td>
              </tr>
            ) : (
              pendingInvoices.map((invoice) => (
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
               <td style={{ padding: "12px", textAlign: "center" }}>
  <div
    style={{
      display: "flex",
      gap: "8px",
      justifyContent: "center",
      flexWrap: "wrap",
    }}
  >
    <button
      onClick={() => {
        handleViewCustomerInvoices(invoice);
        setShowInvoiceModal(true);
      }}
      style={{
        padding: "6px 12px",
        background: "#eef2ff",
        color: "#4f46e5",
        border: "1px solid #6366f1",
        borderRadius: "4px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <FiEye size={14} />
      View
    </button>

    <button
      onClick={() => handleVerify(invoice, "approve")}
      style={{
        padding: "6px 12px",
        background: "#28a745",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      <FiCheck /> Approve
    </button>

    <button
      onClick={() => handleVerify(invoice, "reject")}
      style={{
        padding: "6px 12px",
        background: "#dc3545",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      <FiX /> Reject
    </button>
  </div>
</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


{/* Invoice Details Modal */}
{showInvoiceModal && (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(15,23,42,0.65)",
      backdropFilter: "blur(4px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    }}
  >
    <div
      style={{
        width: "850px",
        maxHeight: "90vh",
        overflowY: "auto",
        background: "#fff",
        borderRadius: "20px",
        padding: "28px",
        position: "relative",
        boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
      }}
    >
      {/* CLOSE BUTTON */}
      <button
        onClick={() => setShowInvoiceModal(false)}
        style={{
          position: "absolute",
          top: "18px",
          right: "18px",
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          border: "none",
          background: "#f1f5f9",
          cursor: "pointer",
          fontSize: "18px",
          fontWeight: "bold",
        }}
      >
        ×
      </button>

      <h2
        style={{
          marginBottom: "25px",
          color: "#1e293b",
          fontSize: "22px",
          fontWeight: "700",
        }}
      >
        {selectedCustomerName} - Invoice Details
      </h2>

      {selectedCustomerInvoices.map((inv) => (
        <div
          key={inv.id}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "22px",
            marginBottom: "22px",
            background: "#ffffff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          {/* TOP */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "18px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#1e293b",
                }}
              >
                Invoice #{inv.invoiceNumber}
              </div>

              <div
                style={{
                  marginTop: "5px",
                  fontSize: "13px",
                  color: "#64748b",
                }}
              >
                Supplier:{" "}
                {inv.supplier?.supplierName ||
                  inv.supplierName ||
                  "N/A"}
              </div>
            </div>

            <div
              style={{
                fontSize: "22px",
                fontWeight: "800",
                color: "#4f46e5",
              }}
            >
              ₹{inv.invoiceAmount?.toLocaleString()}
            </div>
          </div>

          {/* DETAILS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              marginBottom: "20px",
            }}
          >
            <div>
              <span style={{ color: "#64748b" }}>
                Disbursement:
              </span>{" "}
              <strong>
                ₹{inv.disbursementAmount?.toLocaleString()}
              </strong>
            </div>

            <div>
              <span style={{ color: "#64748b" }}>
                ROI:
              </span>{" "}
              <strong>{inv.roiPercentage || 0}%</strong>
            </div>

            <div>
              <span style={{ color: "#64748b" }}>
                Penal Charges:
              </span>{" "}
              <strong>{inv.penalCharges || 0}%</strong>
            </div>

            <div>
              <span style={{ color: "#64748b" }}>
                Service Fee:
              </span>{" "}
              <strong>{inv.serviceFee || 0}</strong>
            </div>

            <div>
              <span style={{ color: "#64748b" }}>
                Status:
              </span>{" "}
              {getStatusBadge(inv.status)}
            </div>
          </div>


          {/* UTILIZED LIMIT */}
<div
  style={{
    background: "#fff7ed",
    padding: "12px",
    marginBottom: "14px",
    borderRadius: "12px",
  }}
>
  <label
    style={{
      fontSize: "11px",
      color: "#ea580c",
      fontWeight: "700",
      textTransform: "uppercase",
      display: "block",
      marginBottom: "2px",
    }}
  >
    Utilized Limit
  </label>

  <div
    style={{
      fontWeight: "700",
      color: "#c2410c",
      fontSize: "15px",
  
    }}
  >
    ₹
    {Number(
      selectedInvoice?.utilizedLimit || 0
    ).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}
  </div>
</div>

{/* UNUTILIZED LIMIT */}
<div
  style={{
    background: "#ecfeff",
    padding: "12px",
    borderRadius: "12px",
  }}
>
  <label
    style={{
      fontSize: "11px",
      color: "#0891b2",
      fontWeight: "700",
      textTransform: "uppercase",
      display: "block",
      marginBottom: "2px",
    }}
  >
    Unutilized Limit
  </label>

  <div
    style={{
      fontWeight: "700",
      color: "#0e7490",
      fontSize: "15px",
    }}
  >
    ₹
    {Number(
      selectedInvoice?.unutilizedLimit || 0
    ).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}
  </div>
</div>

          {/* DOCUMENTS */}
          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              paddingTop: "18px",
            }}
          >
            <div
              style={{
                marginBottom: "12px",
                fontWeight: "700",
                color: "#334155",
              }}
            >
              Uploaded Documents
            </div>

            {(selectedCustomerDocs[inv.id] || []).length === 0 ? (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "14px",
                }}
              >
                No documents uploaded
              </div>
            ) : (
              (selectedCustomerDocs[inv.id] || []).map((doc) => {
                const baseUrl =
                  import.meta.env.VITE_API_BASE_URL?.replace(
                    "/api",
                    ""
                  ) || "http://localhost:4000";

                const fileUrl = doc.filePath?.startsWith("http")
                  ? doc.filePath
                  : `${baseUrl}/${doc.filePath.replace(/\\/g, "/")}`;

                return (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: "600",
                          color: "#1e293b",
                          fontSize: "14px",
                        }}
                      >
                        📄 {doc.fileName}
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginTop: "4px",
                        }}
                      >
                        Uploaded By:{" "}
                        {doc.uploadedByUser?.name}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        window.open(fileUrl, "_blank")
                      }
                      style={{
                        background: "#4f46e5",
                        color: "#fff",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
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
      ))}
    </div>
  </div>
)}
      

      {/* Verification Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "30px",
              borderRadius: "8px",
              width: "500px",
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <h3 style={{ marginBottom: "20px" }}>
              {actionType === "approve" ? "Approve Invoice" : "Reject Invoice"}
            </h3>

            <div
              style={{
                marginBottom: "20px",
                background: "#f9f9f9",
                padding: "15px",
                borderRadius: "4px",
              }}
            >
              <div style={{ marginBottom: "10px" }}>
                <strong>Invoice Number:</strong>{" "}
                {selectedInvoice?.invoiceNumber}
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Customer:</strong>{" "}
                {selectedInvoice?.customer?.name ||
                  selectedInvoice?.customer?.companyName ||
                  selectedInvoice?.customerName ||
                  "N/A"}
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Supplier:</strong>{" "}
                {selectedInvoice?.supplier?.supplierName ||
                  selectedInvoice?.supplier?.name ||
                  selectedInvoice?.supplierName ||
                  "N/A"}
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Invoice Amount:</strong> ₹
                {selectedInvoice?.invoiceAmount?.toLocaleString()}
              </div>
              <div style={{ marginBottom: "10px" }}>
                <strong>Disbursement Amount:</strong> ₹
                {selectedInvoice?.disbursementAmount?.toLocaleString()}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                }}
              >
                Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  minHeight: "100px",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "10px 20px",
                  background: "#6c757d",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitVerification}
                disabled={loading}
                style={{
                  padding: "10px 20px",
                  background: actionType === "approve" ? "#28a745" : "#dc3545",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {actionType === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
