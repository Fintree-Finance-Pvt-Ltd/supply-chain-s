import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { workflowService } from '../../services/workflowService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import { FiCheck, FiX, FiEye } from 'react-icons/fi';

export default function InvoiceDiscountingOPSHead() {
  const [loading, setLoading] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [handledInvoices, setHandledInvoices] = useState([]);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [remarks, setRemarks] = useState('');

  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  
const loadData = async () => {
  try {
    setLoading(true);

    // Pending invoices
    const pendingResponse =
      await workflowService.getOPSHeadPendingInvoices();

    setPendingInvoices(
      pendingResponse?.data?.data ||
      pendingResponse?.data ||
      []
    );

    // ACTIVE invoices
    const activeInvoicesResponse =
      await workflowService.getActiveInvoices();

    setHandledInvoices(
      activeInvoicesResponse?.data?.data ||
      activeInvoicesResponse?.data ||
      []
    );

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
      if (actionType === 'approve') {
        await workflowService.opsHeadApprove(selectedInvoice.id, remarks);
        toast.success('Invoice approved successfully');
      } else {
        await workflowService.opsHeadReject(selectedInvoice.id, remarks);
        toast.success('Invoice rejected');
      }
      setShowModal(false);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Error processing invoice:', error);
      toast.error('Error processing invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (invoice) => {
    const invoiceDocs = invoice.invoiceFilePath
      ? [
          {
            id: invoice.id,
            fileName: invoice.invoiceNumber || 'Invoice Document',
            filePath: invoice.invoiceFilePath,
            documentType: 'INVOICE',
          },
        ]
      : [];

    setSelectedInvoice({
      ...invoice,
      invoiceDocuments: invoiceDocs,
    });

    setShowViewModal(true);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PENDING_OPS_HEAD_APPROVAL: {
        color: 'blue',
        label: 'Pending OPS Head Approval',
      },
      DRAFT: { color: 'gray', label: 'Draft' },
      PENDING_CUSTOMER_APPROVAL: {
        color: 'yellow',
        label: 'Pending Customer Approval',
      },
      PENDING_OPS_L1_APPROVAL: {
        color: 'blue',
        label: 'Pending OPS L1 Approval',
      },
      PENDING_OPS_L2_APPROVAL: {
        color: 'blue',
        label: 'Pending OPS L2 Approval',
      },
      PENDING_MD_APPROVAL: {
        color: 'blue',
        label: 'Pending MD Approval',
      },
      DISBURSEMENT_DATA_ENTRY: {
        color: 'yellow',
        label: 'Disbursement Data Entry',
      },
      PENDING_FINAL_OPS_L2_APPROVAL: {
        color: 'blue',
        label: 'Pending Final OPS L2',
      },
      ACTIVE: { color: 'green', label: 'Active' },
      REJECTED_BY_CUSTOMER: {
        color: 'red',
        label: 'Rejected by Customer',
      },
      REJECTED: { color: 'red', label: 'Rejected' },
    };

    const s = statusMap[status] || { color: 'gray', label: status || 'Unknown' };
    return <StatusBadge status={s.color} label={s.label} />;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>Invoice Discounting - OPS Head Dashboard</h2>

      {/* Pending */}
      <div
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ marginBottom: '20px' }}>
          Pending Final Approval ({pendingInvoices.length})
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                Invoice #
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                Customer
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                Supplier
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Amount
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Disbursement
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                Status
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {pendingInvoices.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No invoices pending final approval
                </td>
              </tr>
            ) : (
              pendingInvoices.map((invoice) => (
                <tr key={invoice.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{invoice.invoiceNumber}</td>
                  <td style={{ padding: '12px' }}>
                    {invoice.customer?.name ||
                      invoice.customer?.companyName ||
                      invoice.customerName ||
                      'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {invoice.supplier?.supplierName || invoice.supplierName || 'N/A'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ₹{invoice.invoiceAmount?.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ₹{invoice.disbursementAmount?.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(invoice.status)}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleVerify(invoice, 'approve')}
                      style={{
                        padding: '6px 12px',
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '8px',
                      }}
                    >
                      <FiCheck /> Approve
                    </button>

                    <button
                      onClick={() => handleViewInvoice(invoice)}
                      style={{
                        padding: '6px 12px',
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginRight: '8px',
                      }}
                    >
                      <FiEye size={14} /> View
                    </button>

                    <button
                      onClick={() => handleVerify(invoice, 'reject')}
                      style={{
                        padding: '6px 12px',
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <FiX /> Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Active Invoices (Read-Only) */}
      <div
        style={{
          marginTop: '20px',
          background: '#fff',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ marginBottom: '20px' }}>
          Active Invoices (Read Only) ({handledInvoices.length})
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                Invoice #
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                Customer
              </th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                Supplier
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Amount
              </th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                Disbursement
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                Status
              </th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {handledInvoices.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No previously handled invoices.
                </td>
              </tr>
            ) : (
              handledInvoices.map((invoice) => (
                <tr key={invoice.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>{invoice.invoiceNumber}</td>
                  <td style={{ padding: '12px' }}>
                    {invoice.customer?.name ||
                      invoice.customer?.companyName ||
                      invoice.customerName ||
                      'N/A'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {invoice.supplier?.supplierName || invoice.supplierName || 'N/A'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ₹{invoice.invoiceAmount?.toLocaleString?.() || invoice.invoiceAmount}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    ₹{invoice.disbursementAmount?.toLocaleString?.() || invoice.disbursementAmount}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(invoice.status)}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleViewInvoice(invoice)}
                      style={{
                        padding: '6px 12px',
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        margin: '0 auto',
                      }}
                    >
                      <FiEye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {showViewModal && selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '32px',
              borderRadius: '24px',
              width: '650px',
              maxHeight: '85vh',
              overflowY: 'auto',
              position: 'relative',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <button
              onClick={() => setShowViewModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                border: 'none',
                background: '#f1f5f9',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.2s',
              }}
            >
              <FiX size={18} />
            </button>

            <h3
              style={{
                marginBottom: '28px',
                fontSize: '22px',
                fontWeight: 800,
                color: '#1e293b',
                letterSpacing: '-0.02em',
              }}
            >
              Invoice Overview
            </h3>

            <div
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                padding: '20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}
                >
                  Invoice Number
                </div>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                  {selectedInvoice?.invoiceNumber}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}
                >
                  Current Status
                </div>
                <div>{getStatusBadge(selectedInvoice?.status)}</div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                padding: '0 4px',
              }}
            >
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Customer
                </label>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>
                  {selectedInvoice?.customer?.name || selectedInvoice?.customerName}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Supplier
                </label>
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>
                  {selectedInvoice?.supplier?.supplierName || selectedInvoice?.supplierName}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Invoice Amount
                </label>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '16px' }}>
                  ₹{selectedInvoice?.invoiceAmount?.toLocaleString()}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Disbursement
                </label>
                <div style={{ fontWeight: 800, color: '#6366f1', fontSize: '16px' }}>
                  ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}
                </div>
              </div>

              <div style={{ background: '#f5f3ff', padding: '12px', borderRadius: '12px' }}>
                <label style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  ROI
                </label>
                <div style={{ fontWeight: 700, color: '#4338ca', fontSize: '15px' }}>
                  {selectedInvoice?.roiPercentage}%
                </div>
              </div>

              <div style={{ background: '#fff1f2', padding: '12px', borderRadius: '12px' }}>
                <label style={{ fontSize: '11px', color: '#e11d48', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Penal Charges
                </label>
                <div style={{ fontWeight: 700, color: '#be123c', fontSize: '15px' }}>
                  {selectedInvoice?.penalCharges}%
                </div>
              </div>

              <div style={{ background: '#f1fff3', padding: '12px', borderRadius: '12px' }}>
                <label style={{ fontSize: '11px', color: '#074d31', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  Service Fee
                </label>
                <div style={{ fontWeight: 700, color: '#074d33', fontSize: '15px' }}>
                  {selectedInvoice?.serviceFee}%
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              <label style={{ fontSize: '13px', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '12px' }}>
                Attached Documents
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!selectedInvoice?.invoiceDocuments || selectedInvoice.invoiceDocuments.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No documents uploaded.</p>
                ) : (
                  selectedInvoice.invoiceDocuments.map((doc) => {
                    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
                    const baseUrl = apiBase.replace('/api', '');
                    const fileUrl = doc.filePath?.startsWith('http')
                      ? doc.filePath
                      : `${baseUrl}/${doc.filePath.replace(/\\/g, '/')}`;

                    return (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#f8fafc',
                          padding: '10px 16px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            color: '#1e293b',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '250px',
                          }}
                        >
                          📄 {doc.fileName}
                        </span>

                        <button
                          onClick={() => window.open(fileUrl, '_blank')}
                          style={{
                            background: '#6366f1',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)',
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

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  padding: '12px 32px',
                  background: '#1e293b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(30, 41, 59, 0.3)',
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showModal && selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '30px',
              borderRadius: '8px',
              width: '500px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <h3 style={{ marginBottom: '20px' }}>
              {actionType === 'approve' ? 'Final Approval' : 'Reject Invoice'}
            </h3>

            <div style={{ marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>Invoice Number:</strong> {selectedInvoice?.invoiceNumber}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Customer:</strong>{' '}
                {selectedInvoice?.customer?.name ||
                  selectedInvoice?.customer?.companyName ||
                  selectedInvoice?.customerName ||
                  'N/A'}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Supplier:</strong>{' '}
                {selectedInvoice?.supplier?.supplierName || selectedInvoice?.supplierName || 'N/A'}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Invoice Amount:</strong> ₹{selectedInvoice?.invoiceAmount?.toLocaleString()}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <strong>Disbursement Amount:</strong>{' '}
                ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}
              </div>
              {selectedInvoice?.disbursementUtr && (
                <div style={{ marginBottom: '10px' }}>
                  <strong>Disbursement UTR:</strong> {selectedInvoice.disbursementUtr}
                </div>
              )}
              {selectedInvoice?.disbursementDate && (
                <div style={{ marginBottom: '10px' }}>
                  <strong>Disbursement Date:</strong> {selectedInvoice.disbursementDate}
                </div>
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

