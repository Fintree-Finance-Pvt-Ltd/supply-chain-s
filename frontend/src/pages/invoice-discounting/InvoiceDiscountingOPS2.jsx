import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { workflowService } from '../../services/workflowService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import { FiCheck, FiX, FiFileText, FiDollarSign, FiCalendar } from 'react-icons/fi';

export default function InvoiceDiscountingOPS2() {
  const [loading, setLoading] = useState(false);
  const [pendingL1Invoices, setPendingL1Invoices] = useState([]);
  const [pendingFinalInvoices, setPendingFinalInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [activeTab, setActiveTab] = useState('initial');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [l1Res, finalRes] = await Promise.all([
        workflowService.getOPS2PendingInvoices(),
        workflowService.getFinalOPS2PendingInvoices(),
      ]);
      // Backend returns { success: true, data: [...] }
      setPendingL1Invoices(l1Res?.data?.data || []);
      setPendingFinalInvoices(finalRes?.data?.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
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
      setSubmitError('');

      if (actionType === 'approve') {
        if (activeTab === 'initial') {
          await workflowService.opsL2Approve(selectedInvoice.id, remarks);
        } else {
          await workflowService.finalOpsL2Approve(selectedInvoice.id, remarks);
        }
        toast.success('Invoice approved successfully');
      } else {
        await workflowService.opsL2Reject(selectedInvoice.id, remarks);
        toast.success('Invoice rejected');
      }

      setShowModal(false);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Error processing invoice:', error);

      // Direct inline error handling
      let errorMessage = 'Error processing invoice';

      const data = error?.response?.data;

      if (typeof data?.message === 'string' && data.message.trim()) {
        errorMessage = data.message;
      } 
      else if (Array.isArray(data?.errors)) {
        const messages = data.errors
          .map(item => typeof item === 'string' ? item : item?.message)
          .filter(Boolean);
        if (messages.length > 0) {
          errorMessage = messages.join(', ');
        }
      } 
      else if (typeof data === 'string' && data.trim()) {
        errorMessage = data;
      } 
      else if (error?.message) {
        errorMessage = error.message;
      }

      setSubmitError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'DRAFT': { color: 'gray', label: 'Draft' },
      'PENDING_CUSTOMER_APPROVAL': { color: 'yellow', label: 'Pending Customer Approval' },
      'PENDING_OPS_L1_APPROVAL': { color: 'blue', label: 'Pending OPS L1 Approval' },
      'PENDING_OPS_L2_APPROVAL': { color: 'blue', label: 'Pending OPS L2 Approval' },
      'PENDING_MD_APPROVAL': { color: 'blue', label: 'Pending MD Approval' },
      'PENDING_OPS_HEAD_APPROVAL': { color: 'blue', label: 'Pending OPS Head Approval' },
      'DISBURSEMENT_DATA_ENTRY': { color: 'yellow', label: 'Disbursement Data Entry' },
      'PENDING_FINAL_OPS_L2_APPROVAL': { color: 'blue', label: 'Pending Final OPS L2' },
      'ACTIVE': { color: 'green', label: 'Active' },
      'REJECTED_BY_CUSTOMER': { color: 'red', label: 'Rejected by Customer' },
      'REJECTED': { color: 'red', label: 'Rejected' },
    };
    const s = statusMap[status] || { color: 'gray', label: status || 'Unknown' };
    return <StatusBadge status={s.color} label={s.label} />;
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
  const renderInvoiceTable = (invoices) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f5f5f5' }}>
          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Invoice #</th>
          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Customer</th>
          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Supplier</th>
          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Amount</th>
          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Disbursement</th>
          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Status</th>
          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {invoices.length === 0 ? (
          <tr>
            <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              No invoices found
            </td>
          </tr>
        ) : (
          invoices.map(invoice => (
            <tr key={invoice.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px' }}>{invoice.invoiceNumber}</td>
              <td style={{ padding: '12px' }}>{invoice.customer?.name || invoice.customer?.companyName || invoice.customerName || 'N/A'}</td>
              <td style={{ padding: '12px' }}>{invoice.supplier?.supplierName || invoice.supplierName || 'N/A'}</td>
              <td style={{ padding: '12px', textAlign: 'right' }}>₹{invoice.invoiceAmount?.toLocaleString()}</td>
              <td style={{ padding: '12px', textAlign: 'right' }}>₹{invoice.disbursementAmount?.toLocaleString()}</td>
              <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(invoice.status)}</td>
              <td
  style={{
    padding: "12px",
    textAlign: "center",
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",
      flexWrap: "wrap",
    }}
  >
    {/* APPROVE */}
    <button
      onClick={() => handleVerify(invoice, "approve")}
      style={{
        minWidth: "110px",
        height: "40px",
        padding: "0 16px",
        background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "13px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: "0 4px 12px rgba(34,197,94,0.25)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = "translateY(0)";
      }}
    >
      <FiCheck size={15} />
      Approve
    </button>

    {/* VIEW */}
    <button
      onClick={() => handleViewInvoice(invoice)}
      style={{
        minWidth: "90px",
        height: "40px",
        padding: "0 16px",
        background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "13px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = "translateY(0)";
      }}
    >
      View
    </button>

    {/* REJECT */}
    <button
      onClick={() => handleVerify(invoice, "reject")}
      style={{
        minWidth: "105px",
        height: "40px",
        padding: "0 16px",
        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "700",
        fontSize: "13px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: "0 4px 12px rgba(239,68,68,0.25)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = "translateY(0)";
      }}
    >
      <FiX size={15} />
      Reject
    </button>
  </div>
</td>
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
      
                 {/* MAIN CONTAINER */}
<div style={{
  background: "#f8fafc",
  padding: "20px",
  borderRadius: "24px",
  fontFamily: "'Inter', sans-serif",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
}}>
  
  {/* TOP SECTION: ENTITY NAMES */}
  <div style={{ 
    display: "flex", 
    justifyContent: "space-between", 
    marginBottom: "24px",
    padding: "0 8px"
  }}>
    <div style={{ width: "45%" }}>
      <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer</p>
      <h3 style={{ margin: "4px 0 0", fontSize: "16px", color: "#1e293b", fontWeight: "600" }}>
        {selectedInvoice?.customer?.name || selectedInvoice?.customerName}
      </h3>
    </div>
    <div style={{ width: "45%", textAlign: "right" }}>
      <p style={{ margin: 0, fontSize: "11px", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>Supplier</p>
      <h3 style={{ margin: "4px 0 0", fontSize: "16px", color: "#1e293b", fontWeight: "600" }}>
        {selectedInvoice?.supplier?.supplierName || selectedInvoice?.supplierName}
      </h3>
    </div>
  </div>

  {/* MIDDLE SECTION: PRIMARY FIGURES */}
  <div style={{ 
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    justifyContent: "space-around",
    border: "1px solid #e2e8f0",
    marginBottom: "16px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
  }}>
    <div style={{ textAlign: "center" }}>
      <span style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>Invoice Amount

</span>
      <span style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
        ₹{selectedInvoice?.invoiceAmount?.toLocaleString("en-IN")}
      </span>
    </div>
    <div style={{ width: "1px", background: "#f1f5f9" }}></div>
    <div style={{ textAlign: "center" }}>
      <span style={{ fontSize: "12px", color: "#6366f1", display: "block", marginBottom: "6px", fontWeight: "600" }}>Disbursement</span>
      <span style={{ fontSize: "20px", fontWeight: "800", color: "#6366f1" }}>
        ₹{selectedInvoice?.disbursementAmount?.toLocaleString("en-IN")}
      </span>
    </div>
  </div>

  {/* GRID SECTION: PERCENTAGES & LIMITS */}
  <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px"
  }}>
    {/* Percentage Badges */}
    {[
      { label: "ROI", val: selectedInvoice?.roiPercentage, color: "#4f46e5" },
      { label: "Penal", val: selectedInvoice?.penalCharges, color: "#e11d48" },
      { label: "Service", val: selectedInvoice?.serviceFee, color: "#10b981" }
    ].map((item, i) => (
      <div key={i} style={{ 
        textAlign: "center", 
        padding: "12px 8px", 
        background: "rgba(255, 255, 255, 0.5)", 
        borderRadius: "16px",
        border: "1px solid #073768"
      }}>
        <div style={{ fontSize: "10px", fontWeight: "700", color: "#94a3b8", marginBottom: "4px" }}>{item.label}</div>
        <div style={{ fontSize: "14px", fontWeight: "700", color: item.color }}>{item.val}%</div>
      </div>
    ))}

    {/* Limit Bars (Full Width Spanning) */}
    <div style={{ 
      gridColumn: "span 3", 
      background: "#0c254ae2", 
      borderRadius: "16px", 
      padding: "16px",
      marginTop: "8px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <div>
        <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600" }}>UTILIZED LIMIT</div>
        <div style={{ fontSize: "15px", color: "#ffffff", fontWeight: "700" }}>
          ₹{Number(
  selectedInvoice?.loanAccount?.utilizedLimit || 0
).toLocaleString("en-IN")}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: "600" }}>UNUTILIZED</div>
        <div style={{ fontSize: "15px", color: "#38bdf8", fontWeight: "700" }}>
         ₹{Number(
  selectedInvoice?.loanAccount?.unutilizedLimit || 0
).toLocaleString("en-IN")}
        </div>
      </div>
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
                                onClick={() => window.open(fileUrl, "_blank")}
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
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>Invoice Discounting - OPS L2 Dashboard</h2>
      
      {/* Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('initial')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'initial' ? '#007bff' : '#f5f5f5',
            color: activeTab === 'initial' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            marginRight: '4px',
          }}
        >
          Initial Verification ({pendingL1Invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('final')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'final' ? '#007bff' : '#f5f5f5',
            color: activeTab === 'final' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
          }}
        >
          Final Verification ({pendingFinalInvoices.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {activeTab === 'initial' ? (
          renderInvoiceTable(pendingL1Invoices)
        ) : (
          renderInvoiceTable(pendingFinalInvoices)
        )}
      </div>

      {/* Verification Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', width: '500px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {actionType === 'approve' ? 'Approve Invoice' : 'Reject Invoice'}
            </h3>
            
            {/* Invoice Details */}
            <div style={{ marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
              <div style={{ marginBottom: '10px' }}><strong>Invoice Number:</strong> {selectedInvoice?.invoiceNumber}</div>
             <div style={{ marginBottom: '10px' }}>
            <strong>Customer:</strong> {selectedInvoice?.customer?.name || 'N/A'}</div>
            <div style={{ marginBottom: '10px' }}>
            <strong>Supplier:</strong> {selectedInvoice?.supplier?.supplierName || 'N/A'}</div>
              <div style={{ marginBottom: '10px' }}><strong>Invoice Amount:</strong> ₹{selectedInvoice?.invoiceAmount?.toLocaleString()}</div>
              <div style={{ marginBottom: '10px' }}><strong>Disbursement Amount:</strong> ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}</div>
              {selectedInvoice?.disbursementUtr && (
                <div style={{ marginBottom: '10px' }}><strong>Disbursement UTR:</strong> {selectedInvoice.disbursementUtr}</div>
              )}
              {selectedInvoice?.disbursementDate && (
                <div style={{ marginBottom: '10px' }}><strong>Disbursement Date:</strong> {selectedInvoice.disbursementDate}</div>
              )}
              {selectedInvoice?.invoiceDueDate && (
                <div style={{ marginBottom: '10px' }}><strong>Invoice Due Date:</strong> {selectedInvoice.invoiceDueDate}</div>
              )}
              {selectedInvoice?.roiPercentage && (
                <div style={{ marginBottom: '10px' }}><strong>ROI Percentage:</strong> {selectedInvoice.roiPercentage}%</div>
              )}
              {selectedInvoice?.roiAmount && (
                <div style={{ marginBottom: '10px' }}><strong>ROI Amount:</strong> ₹{selectedInvoice.roiAmount?.toLocaleString()}</div>
              )}
              {selectedInvoice?.emiAmount && (
                <div style={{ marginBottom: '10px' }}><strong>EMI Amount:</strong> ₹{selectedInvoice.emiAmount?.toLocaleString()}</div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '100px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitVerification}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: actionType === 'approve' ? '#28a745' : '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
