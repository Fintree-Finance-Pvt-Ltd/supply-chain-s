import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { workflowService } from '../../services/workflowService';
import { invoiceApprovalBatchService } from '../../services/invoiceApprovalBatchService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import { FiCheck, FiX, FiFileText, FiUser, FiDollarSign, FiCalendar, FiAlertCircle } from 'react-icons/fi';

export default function InvoiceDiscountingCustomer() {
  const [loading, setLoading] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [pendingBatches, setPendingBatches] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invoiceResponse, batchData] = await Promise.all([
        workflowService.getCustomerPendingInvoices(),
        invoiceApprovalBatchService.getPendingBatches(),
      ]);
      // Backend returns { success: true, data: [...] }
      setPendingInvoices(invoiceResponse?.data?.data || []);
      setPendingBatches(batchData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (invoice, type) => {
    setSelectedInvoice(invoice);
    setSelectedBatch(null);
    setActionType(type);
    setShowModal(true);
  };

  const handleBatchAction = (batch, type) => {
    setSelectedBatch(batch);
    setSelectedInvoice(null);
    setActionType(type);
    setShowModal(true);
  };

  const submitAction = async () => {
    try {
      setLoading(true);
      if (selectedBatch) {
        await invoiceApprovalBatchService.customerApproveBatch(selectedBatch.id, actionType === 'approve', remarks);
        toast.success(actionType === 'approve' ? 'Invoice batch approved successfully' : 'Invoice batch rejected');
      } else if (actionType === 'approve') {
        await workflowService.customerApprove(selectedInvoice.id, remarks);
        toast.success('Invoice approved successfully');
      } else {
        await workflowService.customerReject(selectedInvoice.id, remarks);
        toast.success('Invoice rejected');
      }
      setShowModal(false);
      setRemarks('');
      setSelectedBatch(null);
      setSelectedInvoice(null);
      loadData();
    } catch (error) {
      console.error('Error processing invoice:', error);
      toast.error('Error processing invoice');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'PENDING_CUSTOMER_APPROVAL': { color: 'yellow', label: 'Pending Your Approval' },
      'ACTIVE': { color: 'green', label: 'Active' },
      'REJECTED_BY_CUSTOMER': { color: 'red', label: 'Rejected by You' },
      'DRAFT': { color: 'gray', label: 'Draft' },
      'PENDING_OPS_L1_APPROVAL': { color: 'blue', label: 'Pending OPS L1 Approval' },
      'PENDING_OPS_L2_APPROVAL': { color: 'blue', label: 'Pending OPS L2 Approval' },
      'PENDING_MD_APPROVAL': { color: 'blue', label: 'Pending MD Approval' },
      'PENDING_OPS_HEAD_APPROVAL': { color: 'blue', label: 'Pending OPS Head Approval' },
      'DISBURSEMENT_DATA_ENTRY': { color: 'yellow', label: 'Disbursement Data Entry' },
      'PENDING_FINAL_OPS_L2_APPROVAL': { color: 'blue', label: 'Pending Final OPS L2' },
      'REJECTED': { color: 'red', label: 'Rejected' },
    };
    const s = statusMap[status] || { color: 'gray', label: status || 'Unknown' };
    return <StatusBadge status={s.color} label={s.label} />;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ marginBottom: '10px' }}>Invoice Discounting - Customer Portal</h2>
        <p style={{ color: '#666' }}>Review and approve your invoice discounting requests</p>
      </div>

      {/* Same-day Batch Approval Section */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiAlertCircle /> Same-Day Approval Requests ({pendingBatches.length})
        </h3>

        {pendingBatches.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
            No same-day approval requests pending
          </div>
        ) : (
          pendingBatches.map(batch => {
            const invoices = batch.invoices || [];
            const totalDisbursement = invoices.reduce((sum, invoice) => sum + Number(invoice.disbursementAmount || 0), 0);

            return (
              <div key={batch.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Batch #{batch.batchCode}</h4>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {invoices.length} invoices - Rs. {totalDisbursement.toLocaleString('en-IN')}
                    </div>
                  </div>
                  {getStatusBadge(batch.status)}
                </div>

                <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                    <div><strong>Customer:</strong> {batch.customer?.companyName || batch.customer?.name || 'N/A'}</div>
                    <div><strong>Common UTR:</strong> {batch.expectedDisbursementUtr || 'To be updated at disbursement'}</div>
                    <div><strong>Common Date:</strong> {batch.expectedDisbursementDate || 'To be updated at disbursement'}</div>
                    <div><strong>Status:</strong> {batch.status}</div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  {invoices.map(invoice => (
                    <div key={invoice.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                      <div>
                        <strong>Invoice #{invoice.invoiceNumber}</strong>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {invoice.supplier?.supplierName || invoice.supplierName || 'Supplier'} - {invoice.loanAccount?.lanId || invoice.lanNumber || 'LAN'}
                        </div>
                      </div>
                      <strong>Rs. {Number(invoice.disbursementAmount || 0).toLocaleString('en-IN')}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleBatchAction(batch, 'reject')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    <FiX /> Reject Batch
                  </button>
                  <button
                    onClick={() => handleBatchAction(batch, 'approve')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      background: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                  >
                    <FiCheck /> Approve Batch
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Pending Approval Section */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiAlertCircle /> Pending Your Approval ({pendingInvoices.length})
        </h3>
        
        {pendingInvoices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            No invoices pending your approval
          </div>
        ) : (
          pendingInvoices.map(invoice => (
            <div key={invoice.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: 0 }}>Invoice #{invoice.invoiceNumber}</h4>
                {getStatusBadge(invoice.status)}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiUser style={{ color: '#666' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Customer</div>
                    <div style={{ fontWeight: 'bold' }}>{invoice.customer?.name || invoice.customerName || 'N/A'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Company Name</div>
                  <div style={{ fontWeight: 'bold' }}>{invoice.customer?.companyName || invoice.companyName || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Loan Account Number</div>
                  <div style={{ fontWeight: 'bold' }}>{invoice.loanAccount?.lanId || invoice.lanNumber || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Supplier Name</div>
                  <div style={{ fontWeight: 'bold' }}>{invoice.supplier?.supplierName || invoice.supplierName || 'N/A'}</div>
                </div>
              </div>
              
              {/* Supplier Bank Details */}
              {(invoice.supplierBankDetail || invoice.supplier?.bankDetail) && (
                <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Supplier Bank Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                    <div><strong>Bank:</strong> {(invoice.supplierBankDetail || invoice.supplier?.bankDetail)?.bankName}</div>
                    <div><strong>A/C:</strong> {(invoice.supplierBankDetail || invoice.supplier?.bankDetail)?.bankAccountNumber}</div>
                    <div><strong>IFSC:</strong> {(invoice.supplierBankDetail || invoice.supplier?.bankDetail)?.ifscCode}</div>
                    <div><strong>Holder:</strong> {(invoice.supplierBankDetail || invoice.supplier?.bankDetail)?.accountHolderName}</div>
                  </div>
                </div>
              )}
              
              {/* Invoice Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiFileText style={{ color: '#666' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Invoice Number</div>
                    <div style={{ fontWeight: 'bold' }}>{invoice.invoiceNumber}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCalendar style={{ color: '#666' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Invoice Date</div>
                    <div style={{ fontWeight: 'bold' }}>{invoice.invoiceDate}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiDollarSign style={{ color: '#666' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Invoice Amount</div>
                    <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#28a745' }}>₹{invoice.invoiceAmount?.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiDollarSign style={{ color: '#666' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Disbursement Amount</div>
                    <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#007bff' }}>₹{invoice.disbursementAmount?.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleAction(invoice, 'reject')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  <FiX /> Reject
                </button>
                <button
                  onClick={() => handleAction(invoice, 'approve')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    background: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  <FiCheck /> Approve
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Modal */}
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
              {actionType === 'approve'
                ? `Approve ${selectedBatch ? 'Invoice Batch' : 'Invoice'}`
                : `Reject ${selectedBatch ? 'Invoice Batch' : 'Invoice'}`}
            </h3>
            
            <div style={{ marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
              {selectedBatch && (
                <>
                  <div style={{ marginBottom: '10px' }}><strong>Batch Code:</strong> {selectedBatch.batchCode}</div>
                  <div style={{ marginBottom: '10px' }}><strong>Invoices:</strong> {(selectedBatch.invoices || []).length}</div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Total Disbursement:</strong> Rs. {(selectedBatch.invoices || [])
                      .reduce((sum, invoice) => sum + Number(invoice.disbursementAmount || 0), 0)
                      .toLocaleString('en-IN')}
                  </div>
                </>
              )}
              {!selectedBatch && (
                <>
              <div style={{ marginBottom: '10px' }}><strong>Invoice Number:</strong> {selectedInvoice?.invoiceNumber}</div>
              <div style={{ marginBottom: '10px' }}><strong>Disbursement Amount:</strong> ₹{selectedInvoice?.disbursementAmount?.toLocaleString()}</div>
                </>
              )}
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                {actionType === 'approve' ? 'Remarks (Optional)' : 'Reason for Rejection'}
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={actionType === 'approve' ? 'Enter any remarks...' : 'Please provide a reason...'}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', minHeight: '100px' }}
                required={actionType === 'reject'}
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
                onClick={submitAction}
                disabled={loading || (actionType === 'reject' && !remarks)}
                style={{
                  padding: '10px 20px',
                  background: actionType === 'approve' ? '#28a745' : '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  opacity: loading || (actionType === 'reject' && !remarks) ? 0.6 : 1,
                }}
              >
                {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
