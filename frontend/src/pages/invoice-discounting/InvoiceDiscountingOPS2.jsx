import React, { useState, useEffect } from 'react';
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
  const [remarks, setRemarks] = useState('');
  const [activeTab, setActiveTab] = useState('initial');

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
      setPendingL1Invoices(l1Res.data || []);
      setPendingFinalInvoices(finalRes.data || []);
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
        if (activeTab === 'initial') {
          await workflowService.opsL2Approve(selectedInvoice.id, remarks);
        } else {
          await workflowService.finalOpsL2Approve(selectedInvoice.id, remarks);
        }
        alert('Invoice approved successfully');
      } else {
        await workflowService.opsL2Reject(selectedInvoice.id, remarks);
        alert('Invoice rejected');
      }
      setShowModal(false);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Error processing invoice:', error);
      alert('Error processing invoice');
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
              <div style={{ marginBottom: '10px' }}><strong>Customer:</strong> {selectedInvoice?.customerName}</div>
              <div style={{ marginBottom: '10px' }}><strong>Supplier:</strong> {selectedInvoice?.supplierName}</div>
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
