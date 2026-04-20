import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { workflowService } from '../../services/workflowService';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import { FiSave, FiSend, FiUser, FiFileText, FiDollarSign, FiCalendar, FiArrowRight, FiCheck, FiX, FiMail } from 'react-icons/fi';

export default function InvoiceDiscountingRM() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loanAccounts, setLoanAccounts] = useState([]);
  const [selectedLAN, setSelectedLAN] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierBankDetails, setSupplierBankDetails] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    invoiceAmount: '',
    disbursementAmount: '',
  });

  useEffect(() => {
    loadCustomers();
    loadInvoices();
  }, []);

  const [savedInvoiceId, setSavedInvoiceId] = useState(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await workflowService.getCustomersForRM();
      // Backend returns { success: true, data: customers }
      const customerData = response?.data?.data || response?.data || [];
      console.log('Customer response raw:', response);
      console.log('Customer data:', customerData);
      setCustomers(Array.isArray(customerData) ? customerData : []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await workflowService.getRMInvoices();
      // Backend returns { success: true, data: { invoices: [...] } }
      const invoiceData = response?.data?.data?.invoices || response?.data?.invoices || response?.data || [];
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = async (customerId) => {
    // Convert string to number for comparison
    const customerIdNum = parseInt(customerId);
    const customer = customers.find(c => c.id === customerIdNum);
    setSelectedCustomer(customer || null);
    setSelectedLAN('');
    setLoanAccounts([]);
    setSelectedSupplier(null);
    setSupplierBankDetails(null);
    
    if (customerId && !isNaN(customerIdNum)) {
      try {
        setLoading(true);
        // Pass as string since API URL parameter is string
        const response = await workflowService.getLANsByCustomer(customerId);
        // Handle response format - could be { data: [...] } or { data: { data: [...] } }
        const lanData = response?.data?.data || response?.data || [];
        setLoanAccounts(Array.isArray(lanData) ? lanData : []);
      } catch (error) {
        console.error('Error loading LANs:', error);
        setLoanAccounts([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLANChange = async (lanId) => {
    setSelectedLAN(lanId);
    setSelectedSupplier(null);
    setSupplierBankDetails(null);
    
    if (lanId && selectedCustomer) {
      try {
        setLoading(true);
        const response = await workflowService.getSuppliersByCustomer(selectedCustomer.id);
        // Handle response format - could be { data: [...] } or { data: { data: [...] } }
        const supplierData = response?.data?.data || response?.data || [];
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      } catch (error) {
        console.error('Error loading suppliers:', error);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSupplierChange = async (supplierId) => {
    const supplierIdNum = parseInt(supplierId);
    const supplier = suppliers.find(s => s.id === supplierIdNum);
    setSelectedSupplier(supplier || null);
    
    if (supplierId && !isNaN(supplierIdNum)) {
      try {
        setLoading(true);
        const response = await workflowService.getSupplierBankDetails(supplierIdNum);
        // Handle response format
        setSupplierBankDetails(response?.data?.data || response?.data || null);
      } catch (error) {
        console.error('Error loading bank details:', error);
        setSupplierBankDetails(null);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = async () => {
    if (!selectedCustomer || !selectedLAN || !selectedSupplier) {
      toast.info('Please select Customer, LAN, and Supplier');
      return;
    }
    if (!formData.invoiceNumber || !formData.invoiceDate || !formData.invoiceAmount || !formData.disbursementAmount) {
      toast.info('Please fill all invoice details');
      return;
    }

    try {
      setLoading(true);
      const response = await workflowService.createInvoice({
        customerId: selectedCustomer.id,
        loanAccountId: selectedLAN,
        supplierId: selectedSupplier.id,
        ...formData,
      });
      // Get invoice ID from response - handle multiple response formats
      const invoiceData = response?.data?.data || response?.data;
      const invoiceId = invoiceData?.invoice?.id;
      setSavedInvoiceId(invoiceId);
      toast.success('Invoice saved successfully');
      // Refresh the invoice list
      loadInvoices();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Error saving invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // First create the invoice if not saved yet
    if (!savedInvoiceId) {
      if (!selectedCustomer || !selectedLAN || !selectedSupplier) {
        toast.info('Please select Customer, LAN, and Supplier');
        return;
      }
      if (!formData.invoiceNumber || !formData.invoiceDate || !formData.invoiceAmount || !formData.disbursementAmount) {
        toast.info('Please fill all invoice details');
        return;
      }

      try {
        setLoading(true);
        // First create the invoice
        const response = await workflowService.createInvoice({
          customerId: selectedCustomer.id,
          loanAccountId: selectedLAN,
          supplierId: selectedSupplier.id,
          ...formData,
        });
        // Get invoice ID from response
        const invoiceId = response?.data?.data?.invoice?.id || response?.data?.invoice?.id;
        if (!invoiceId) {
          throw new Error('Failed to create invoice');
        }
        
        // Now submit it
        await workflowService.submitInvoice(invoiceId, {});
        toast.success('Invoice submitted successfully - Pending Customer Approval');
        setFormData({
          invoiceNumber: '',
          invoiceDate: '',
          invoiceAmount: '',
          disbursementAmount: '',
        });
        setSelectedCustomer(null);
        setSelectedLAN('');
        setSelectedSupplier(null);
        setSupplierBankDetails(null);
        setSavedInvoiceId(null);
        loadInvoices();
      } catch (error) {
        console.error('Error submitting invoice:', error);
        toast.error('Error submitting invoice');
      } finally {
        setLoading(false);
      }
    } else {
      // Invoice already saved, just submit
      try {
        setLoading(true);
        await workflowService.submitInvoice(savedInvoiceId, {});
        toast.success('Invoice submitted successfully - Pending Customer Approval');
        setFormData({
          invoiceNumber: '',
          invoiceDate: '',
          invoiceAmount: '',
          disbursementAmount: '',
        });
        setSelectedCustomer(null);
        setSelectedLAN('');
        setSelectedSupplier(null);
        setSupplierBankDetails(null);
        setSavedInvoiceId(null);
        loadInvoices();
      } catch (error) {
        console.error('Error submitting invoice:', error);
        toast.error('Error submitting invoice');
      } finally {
        setLoading(false);
      }
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

  const handleSendApprovalEmail = async (invoiceId) => {
    try {
      setLoading(true);
      const baseUrl =import.meta.env.VITE_API_BASE_URL|| 'https://supplychain-prod.fintreelms.com/api';
      const response = await workflowService.sendCustomerApprovalEmail(invoiceId, baseUrl);
      if (response?.data?.success) {
        toast.success('Approval email sent successfully to customer');
      } else {
        toast.error(response?.data?.message || 'Failed to send approval email');
      }
    } catch (error) {
      console.error('Error sending approval email:', error);
      toast.error('Error sending approval email');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>Invoice Discounting - RM Dashboard</h2>
      
      {/* Invoice Entry Form */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginBottom: '20px' }}>Create New Invoice</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Customer Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              <FiUser style={{ marginRight: '8px' }} />Select Customer
            </label>
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => handleCustomerChange(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">Select Customer</option>
              {Array.isArray(customers) && customers.map(customer => (
                <option key={customer.id} value={Number(customer.id)}>
                  {customer.name || customer.companyName || 'Customer ' + customer.id}
                </option>
              ))}
            </select>
          </div>

          {/* Company Name (Auto-filled) */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Company Name</label>
            <input
              type="text"
              value={selectedCustomer?.companyName || ''}
              disabled
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', background: '#f5f5f5' }}
            />
          </div>

          {/* LAN Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              <FiFileText style={{ marginRight: '8px' }} />Select LAN
            </label>
            <select
              value={selectedLAN}
              onChange={(e) => handleLANChange(e.target.value)}
              disabled={!selectedCustomer}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">Select LAN</option>
              {Array.isArray(loanAccounts) && loanAccounts.map(lan => (
                <option key={lan.id} value={lan.id}>
                  {lan.lanId}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Supplier</label>
            <select
              value={selectedSupplier?.id || ''}
              onChange={(e) => handleSupplierChange(e.target.value)}
              disabled={!selectedLAN}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">Select Supplier</option>
              {Array.isArray(suppliers) && suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Bank Details */}
          {supplierBankDetails && (
            <div style={{ gridColumn: '1 / -1', background: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
              <h4 style={{ marginBottom: '10px' }}>Supplier Bank Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <strong>Bank Name:</strong> {supplierBankDetails.bankName}
                </div>
                <div>
                  <strong>Account Number:</strong> {supplierBankDetails.bankAccountNumber}
                </div>
                <div>
                  <strong>IFSC Code:</strong> {supplierBankDetails.ifscCode}
                </div>
                <div>
                  <strong>Account Holder:</strong> {supplierBankDetails.accountHolderName}
                </div>
              </div>
            </div>
          )}

          {/* Invoice Details */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              <FiFileText style={{ marginRight: '8px' }} />Invoice Number
            </label>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleInputChange}
              placeholder="Enter Invoice Number"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              <FiCalendar style={{ marginRight: '8px' }} />Invoice Date
            </label>
            <input
              type="date"
              name="invoiceDate"
              value={formData.invoiceDate}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              <FiDollarSign style={{ marginRight: '8px' }} />Invoice Amount
            </label>
            <input
              type="number"
              name="invoiceAmount"
              value={formData.invoiceAmount}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="Enter Invoice Amount"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              <FiDollarSign style={{ marginRight: '8px' }} />Disbursement Amount
            </label>
            <input
              type="number"
              name="disbursementAmount"
              value={formData.disbursementAmount}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="Enter Disbursement Amount"
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <FiSave /> Save
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              background: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <FiSend /> Submit for Approval
          </button>
        </div>
      </div>

      {/* Invoice List */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginBottom: '20px' }}>My Invoices</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Invoice #</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Customer</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Supplier</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Amount</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(invoices) || invoices.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
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
                  <td style={{ padding: '12px', textAlign: 'center' }}>{getStatusBadge(invoice.status)}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {invoice.status === 'PENDING_CUSTOMER_APPROVAL' && (
                      <button
                        onClick={() => handleSendApprovalEmail(invoice.id)}
                        disabled={loading}
                        style={{
                          padding: '6px 12px',
                          background: '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Send approval email to customer"
                      >
                        <FiMail size={12} /> Email
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/invoice-discounting/rm/${invoice.id}`)}
                      style={{
                        padding: '6px 12px',
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
