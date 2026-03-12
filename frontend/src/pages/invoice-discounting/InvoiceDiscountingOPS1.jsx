import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workflowService } from '../../services/workflowService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import { FiCheck, FiX, FiFileText, FiDollarSign, FiCalendar, FiArrowRight } from 'react-icons/fi';

export default function InvoiceDiscountingOPS1() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [disbursementInvoices, setDisbursementInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [remarks, setRemarks] = useState('');
  const [disbursementData, setDisbursementData] = useState({
    disbursementUtr: '',
    disbursementDate: '',
    invoiceDueDate: '',
  });
  const [activeTab, setActiveTab] = useState('pending');

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
      // Ensure data is always an array
      setPendingInvoices(Array.isArray(pendingRes?.data) ? pendingRes.data : []);
      setDisbursementInvoices(Array.isArray(disbursementRes?.data) ? disbursementRes.data : []);
    } catch (error) {
      console.error('Error loading data:', error);
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
      disbursementUtr: '',
      disbursementDate: '',
      invoiceDueDate: '',
    });
    setShowDisbursementModal(true);
  };

  const handleDisbursementDateChange = (date) => {
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 90);
    setDisbursementData({
      ...disbursementData,
      disbursementDate: date,
      invoiceDueDate: dueDate.toISOString().split('T')[0],
    });
  };

  const submitVerification = async () => {
    try {
      setLoading(true);
      if (actionType === 'approve') {
        await workflowService.opsL1Approve(selectedInvoice.id, remarks);
        alert('Invoice approved successfully');
      } else {
        await workflowService.opsL1Reject(selectedInvoice.id, remarks);
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

  const submitDisbursement = async () => {
    if (!disbursementData.disbursementUtr || !disbursementData.disbursementDate) {
      alert('Please fill all disbursement details');
      return;
    }

    try {
      setLoading(true);
      await workflowService.disburseInvoice(selectedInvoice.id, {
        ...disbursementData,
        loanAccountId: selectedInvoice.loanAccountId,
      });
      alert('Disbursement data saved successfully');
      setShowDisbursementModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving disbursement:', error);
      alert('Error saving disbursement data');
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

  const renderInvoiceTable = (invoices, showActions = true, showDisbursementButton = false) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f5f5f5' }}>
          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Invoice #</th>
          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Customer</th>
          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Supplier</th>
          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Amount</th>
          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Disbursement</th>
          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Status</th>
          {showActions && <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {invoices.length === 0 ? (
          <tr>
            <td colSpan={showActions ? 7 : 6} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
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
              {showActions && (
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {showDisbursementButton ? (
                    <button
                      onClick={() => handleDisbursementEntry(invoice)}
                      style={{
                        padding: '6px 12px',
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <FiFileText style={{ marginRight: '4px' }} /> Enter Disbursement
                    </button>
                  ) : (
                    <>
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
                    </>
                  )}
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>Invoice Discounting - OPS L1 Dashboard</h2>
      
      {/* Tabs */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'pending' ? '#007bff' : '#f5f5f5',
            color: activeTab === 'pending' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            marginRight: '4px',
          }}
        >
          Pending Verification ({pendingInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab('disbursement')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'disbursement' ? '#007bff' : '#f5f5f5',
            color: activeTab === 'disbursement' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
          }}
        >
          Disbursement Entry ({disbursementInvoices.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {activeTab === 'pending' ? (
          renderInvoiceTable(pendingInvoices, true, false)
        ) : (
          renderInvoiceTable(disbursementInvoices, true, true)
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
            
            <div style={{ marginBottom: '20px' }}>
              <strong>Invoice Number:</strong> {selectedInvoice?.invoiceNumber}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <strong>Customer:</strong> {selectedInvoice?.customerName}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <strong>Supplier:</strong> {selectedInvoice?.supplierName}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <strong>Amount:</strong> ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}
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

      {/* Disbursement Entry Modal */}
      {showDisbursementModal && (
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
            <h3 style={{ marginBottom: '20px' }}>Disbursement Data Entry</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <strong>Invoice Number:</strong> {selectedInvoice?.invoiceNumber}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <strong>Disbursement Amount:</strong> ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                <FiFileText style={{ marginRight: '8px' }} />Disbursement UTR
              </label>
              <input
                type="text"
                value={disbursementData.disbursementUtr}
                onChange={(e) => setDisbursementData({ ...disbursementData, disbursementUtr: e.target.value })}
                placeholder="Enter UTR Number"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                <FiCalendar style={{ marginRight: '8px' }} />Disbursement Date
              </label>
              <input
                type="date"
                value={disbursementData.disbursementDate}
                onChange={(e) => handleDisbursementDateChange(e.target.value)}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                <FiCalendar style={{ marginRight: '8px' }} />Invoice Due Date
              </label>
              <input
                type="text"
                value={disbursementData.invoiceDueDate}
                disabled
                placeholder="Auto-calculated (Disbursement Date + 90 days)"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', background: '#f5f5f5' }}
              />
              <small style={{ color: '#666' }}>Auto-calculated as Disbursement Date + 90 days</small>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDisbursementModal(false)}
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
                onClick={submitDisbursement}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save & Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
