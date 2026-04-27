import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { workflowService } from "../../services/workflowService";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import { documentService } from "../../services/documentService";
import { FiUpload, FiEye } from "react-icons/fi";
import {
  FiSave,
  FiSend,
  FiUser,
  FiFileText,
  FiDollarSign,
  FiCalendar,
  FiArrowRight,
  FiCheck,
  FiX,
  FiMail,
} from "react-icons/fi";

export default function InvoiceDiscountingRM() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loanAccounts, setLoanAccounts] = useState([]);
  const [selectedLAN, setSelectedLAN] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierBankDetails, setSupplierBankDetails] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    invoiceDate: "",
    invoiceAmount: "",
    disbursementAmount: "",
    roiPercentage: "",
    penalCharges: "",
  });

  useEffect(() => {
    loadCustomers();
    loadInvoices();
  }, []);

  const [invoiceFiles, setInvoiceFiles] = useState([]);
  const [invoiceFileUrl, setInvoiceFileUrl] = useState(null);
  const [isInvoiceUploaded, setIsInvoiceUploaded] = useState(false);
  const [invoiceDocId, setInvoiceDocId] = useState(null); // ✅ important for delete

  const [savedInvoiceId, setSavedInvoiceId] = useState(null);
  const [selectedCustomerInvoices, setSelectedCustomerInvoices] = useState([]);
  const [selectedCustomerDocs, setSelectedCustomerDocs] = useState([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await workflowService.getCustomersForRM();
      // Backend returns { success: true, data: customers }
      const customerData = response?.data?.data || response?.data || [];
      console.log("Customer response raw:", response);
      console.log("Customer data:", customerData);
      setCustomers(Array.isArray(customerData) ? customerData : []);
    } catch (error) {
      console.error("Error loading customers:", error);
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
      const invoiceData =
        response?.data?.data?.invoices ||
        response?.data?.invoices ||
        response?.data ||
        [];
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
    } catch (error) {
      console.error("Error loading invoices:", error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCustomerInvoices = async (invoice) => {
    try {
      setLoading(true);

      const customerId = invoice.customer?.id;

      // ✅ get all invoices (filter locally)
      const customerInvoices = invoices.filter(
        (inv) => inv.customer?.id === customerId,
      );

      setSelectedCustomerInvoices(customerInvoices);
      setSelectedCustomerName(
        invoice.customer?.name || invoice.customer?.companyName || "Customer",
      );

      // ✅ get documents
      const res = await documentService.getDocumentsByCustomer(customerId);
      const docs = res?.data || [];

      const invoiceDocs = docs.filter((d) => d.documentType === "INVOICE");

      setSelectedCustomerDocs(invoiceDocs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = async (customerId) => {
    // Convert string to number for comparison
    const customerIdNum = parseInt(customerId);
    const customer = customers.find((c) => c.id === customerIdNum);
    setSelectedCustomer(customer || null);
    setSelectedLAN("");
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
        console.error("Error loading LANs:", error);
        setLoanAccounts([]);
      } finally {
        setLoading(false);
      }
    }
    if (customerId) {
      await loadInvoiceDocument(customerId);
    }
  };

  const handleLANChange = async (lanId) => {
    setSelectedLAN(lanId);
    setSelectedSupplier(null);
    setSupplierBankDetails(null);

    if (lanId && selectedCustomer) {
      try {
        setLoading(true);
        const response = await workflowService.getSuppliersByCustomer(
          selectedCustomer.id,
        );
        // Handle response format - could be { data: [...] } or { data: { data: [...] } }
        const supplierData = response?.data?.data || response?.data || [];
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      } catch (error) {
        console.error("Error loading suppliers:", error);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSupplierChange = async (supplierId) => {
    const supplierIdNum = parseInt(supplierId);
    const supplier = suppliers.find((s) => s.id === supplierIdNum);
    setSelectedSupplier(supplier || null);

    if (supplierId && !isNaN(supplierIdNum)) {
      try {
        setLoading(true);
        const response =
          await workflowService.getSupplierBankDetails(supplierIdNum);
        // Handle response format
        setSupplierBankDetails(response?.data?.data || response?.data || null);
      } catch (error) {
        console.error("Error loading bank details:", error);
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
      toast.info("Please select Customer, LAN, and Supplier");
      return;
    }
    if (
      !formData.invoiceNumber ||
      !formData.invoiceDate ||
      !formData.invoiceAmount ||
      !formData.disbursementAmount
    ) {
      toast.info("Please fill all invoice details");
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
      toast.success("Invoice saved successfully");
      // Refresh the invoice list
      loadInvoices();
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast.error("Error saving invoice");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // First create the invoice if not saved yet
    if (!savedInvoiceId) {
      if (!selectedCustomer || !selectedLAN || !selectedSupplier) {
        toast.info("Please select Customer, LAN, and Supplier");
        return;
      }
      if (
        !formData.invoiceNumber ||
        !formData.invoiceDate ||
        !formData.invoiceAmount ||
        !formData.disbursementAmount
      ) {
        toast.info("Please fill all invoice details");
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
        const invoiceId =
          response?.data?.data?.invoice?.id || response?.data?.invoice?.id;
        if (!invoiceId) {
          throw new Error("Failed to create invoice");
        }

        // Now submit it
        await workflowService.submitInvoice(invoiceId, {});
        toast.success(
          "Invoice submitted successfully - Pending Customer Approval",
        );
        setFormData({
          invoiceNumber: "",
          invoiceDate: "",
          invoiceAmount: "",
          disbursementAmount: "",
          roiPercentage: "",
          penalCharges: "",
        });
        setSelectedCustomer(null);
        setSelectedLAN("");
        setSelectedSupplier(null);
        setSupplierBankDetails(null);
        setSavedInvoiceId(null);
        loadInvoices();
      } catch (error) {
        console.error("Error submitting invoice:", error);
        toast.error("Error submitting invoice");
      } finally {
        setLoading(false);
      }
    } else {
      // Invoice already saved, just submit
      try {
        setLoading(true);
        await workflowService.submitInvoice(savedInvoiceId, {});
        toast.success(
          "Invoice submitted successfully - Pending Customer Approval",
        );
        setFormData({
          invoiceNumber: "",
          invoiceDate: "",
          invoiceAmount: "",
          disbursementAmount: "",
          roiPercentage: "",
          penalCharges: "",
        });
        setSelectedCustomer(null);
        setSelectedLAN("");
        setSelectedSupplier(null);
        setSupplierBankDetails(null);
        setSavedInvoiceId(null);
        loadInvoices();
      } catch (error) {
        console.error("Error submitting invoice:", error);
        toast.error("Error submitting invoice");
      } finally {
        setLoading(false);
      }
    }
  };

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

  const handleSendApprovalEmail = async (invoiceId) => {
    try {
      setLoading(true);
      const baseUrl =
        import.meta.env.VITE_API_BASE_URL ||
        "https://supplychain-prod.fintreelms.com/api";
      const response = await workflowService.sendCustomerApprovalEmail(
        invoiceId,
        baseUrl,
      );
      if (response?.data?.success) {
        toast.success("Approval email sent successfully to customer");
      } else {
        toast.error(response?.data?.message || "Failed to send approval email");
      }
    } catch (error) {
      console.error("Error sending approval email:", error);
      toast.error("Error sending approval email");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const handleInvoiceUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (!selectedCustomer?.id) {
      toast.error("Select customer first");
      return;
    }

    try {
      const uploaded = [];

      for (const file of files) {
        const res = await documentService.uploadDocument(
          selectedCustomer.id,
          file,
          "INVOICE",
          "applicant",
          0,
          null,
          {},
        );

        uploaded.push(res.data);
      }

      setInvoiceFiles((prev) => [...prev, ...uploaded]);

      toast.success("Invoice(s) uploaded");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    }
  };
  const handleRemoveInvoice = async (docId) => {
    try {
      await documentService.deleteDocument(docId);

      setInvoiceFiles((prev) => prev.filter((doc) => doc.id !== docId));

      toast.success("Removed");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const loadInvoiceDocument = async (customerId) => {
    try {
      const res = await documentService.getDocumentsByCustomer(customerId);

      const docs = res?.data || [];

      const invoiceDocs = docs.filter((d) => d.documentType === "INVOICE");

      setInvoiceFiles(invoiceDocs);

      if (invoiceDoc) {
        setInvoiceFile({
          name: invoiceDoc.fileName,
        });
        setInvoiceFileUrl(invoiceDoc.filePath);
        setInvoiceDocId(invoiceDoc.id);
        setIsInvoiceUploaded(true);
      } else {
        setIsInvoiceUploaded(false);
      }
    } catch (err) {
      console.error("Failed to load invoice doc", err);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "20px" }}>
        Invoice Discounting - RM Dashboard
      </h2>

      {/* Invoice Entry Form */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginBottom: "20px" }}>Create New Invoice</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          {/* Customer Selection */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiUser style={{ marginRight: "8px" }} />
              Select Customer
            </label>
            <select
              value={selectedCustomer?.id || ""}
              onChange={(e) => handleCustomerChange(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">Select Customer</option>
              {Array.isArray(customers) &&
                customers.map((customer) => (
                  <option key={customer.id} value={Number(customer.id)}>
                    {customer.name ||
                      customer.companyName ||
                      "Customer " + customer.id}
                  </option>
                ))}
            </select>
          </div>

          {/* Company Name (Auto-filled) */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              Company Name
            </label>
            <input
              type="text"
              value={selectedCustomer?.companyName || ""}
              disabled
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "#f5f5f5",
              }}
            />
          </div>

          {/* LAN Selection */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiFileText style={{ marginRight: "8px" }} />
              Select LAN
            </label>
            <select
              value={selectedLAN}
              onChange={(e) => handleLANChange(e.target.value)}
              disabled={!selectedCustomer}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">Select LAN</option>
              {Array.isArray(loanAccounts) &&
                loanAccounts.map((lan) => (
                  <option key={lan.id} value={lan.id}>
                    {lan.lanId}
                  </option>
                ))}
            </select>
          </div>

          {/* Supplier Selection */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              Select Supplier
            </label>
            <select
              value={selectedSupplier?.id || ""}
              onChange={(e) => handleSupplierChange(e.target.value)}
              disabled={!selectedLAN}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">Select Supplier</option>
              {Array.isArray(suppliers) &&
                suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
            </select>
          </div>

          {/* Supplier Bank Details */}
          {supplierBankDetails && (
            <div
              style={{
                gridColumn: "1 / -1",
                background: "#f9f9f9",
                padding: "15px",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ marginBottom: "10px" }}>Supplier Bank Details</h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "15px",
                }}
              >
                <div>
                  <strong>Bank Name:</strong> {supplierBankDetails.bankName}
                </div>
                <div>
                  <strong>Account Number:</strong>{" "}
                  {supplierBankDetails.bankAccountNumber}
                </div>
                <div>
                  <strong>IFSC Code:</strong> {supplierBankDetails.ifscCode}
                </div>
                <div>
                  <strong>Account Holder:</strong>{" "}
                  {supplierBankDetails.accountHolderName}
                </div>
              </div>
            </div>
          )}

          {/* Invoice Details */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiFileText style={{ marginRight: "8px" }} />
              Invoice Number
            </label>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleInputChange}
              placeholder="Enter Invoice Number"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiCalendar style={{ marginRight: "8px" }} />
              Invoice Date
            </label>
            <input
              type="date"
              name="invoiceDate"
              value={formData.invoiceDate}
              onChange={handleInputChange}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiDollarSign style={{ marginRight: "8px" }} />
              Invoice Amount
            </label>
            <input
              type="number"
              name="invoiceAmount"
              value={formData.invoiceAmount}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="Enter Invoice Amount"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
            {formData.invoiceAmount && (
              <p
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "purple",
                  fontWeight: "500",
                }}
              >
                ₹ {formatINR(formData.invoiceAmount)} (
                {numberToWords(formData.invoiceAmount)} Only)
              </p>
            )}
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiDollarSign style={{ marginRight: "8px" }} />
              Disbursement Amount
            </label>
            <input
              type="number"
              name="disbursementAmount"
              value={formData.disbursementAmount}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="Enter Disbursement Amount"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />

            {formData.disbursementAmount && (
              <p
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "purple",
                  fontWeight: "500",
                }}
              >
                ₹ {formatINR(formData.disbursementAmount)} (
                {numberToWords(formData.disbursementAmount)} Only)
              </p>
            )}
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiDollarSign style={{ marginRight: "8px" }} />
              ROI (%)
            </label>
            <input
              type="number"
              name="roiPercentage"
              value={formData.roiPercentage}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="e.g. 12.5"
              step="0.01"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              <FiDollarSign style={{ marginRight: "8px" }} />
              Penal Charges (%)
            </label>
            <input
              type="number"
              name="penalCharges"
              value={formData.penalCharges}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="e.g. 2.0"
              step="0.01"
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", marginTop: "15px" }}>
            <label style={{ fontWeight: "bold", marginBottom: "8px" }}>
              Upload Invoice Documents
            </label>

            {/* SHOW UPLOADED FILES */}
            {invoiceFiles.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                {invoiceFiles.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <FiFileText color="green" />

                    <span style={{ flex: 1 }}>{doc.fileName}</span>

                    <button
                      onClick={() => {
                        const baseUrl =
                          import.meta.env.VITE_API_BASE_URL?.replace(
                            "/api",
                            "",
                          ) || "http://localhost:4000";

                        const fileUrl = doc.filePath?.startsWith("http")
                          ? doc.filePath
                          : `${baseUrl}/${doc.filePath?.replace(/\\/g, "/")}`;

                        window.open(fileUrl, "_blank");
                      }}
                    >
                      <FiEye />
                    </button>

                    <button onClick={() => handleRemoveInvoice(doc.id)}>
                      <FiX color="red" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ALWAYS SHOW UPLOAD BUTTON */}
            <label
              style={{
                display: "block",
                border: "2px dashed #2563EB",
                padding: "20px",
                textAlign: "center",
                borderRadius: "10px",
                cursor: "pointer",
                background: "#EFF6FF",
              }}
            >
              <input
                type="file"
                multiple // ✅ KEY CHANGE
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleInvoiceUpload}
                style={{ display: "none" }}
              />

              <FiUpload size={28} color="#2563EB" />
              <p style={{ color: "#2563EB", fontWeight: "600" }}>
                Upload More Invoice(s)
              </p>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <FiSave /> Save
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <FiSend /> Submit for Approval
          </button>
        </div>
      </div>

      {/* Invoice List */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginBottom: "20px" }}>My Invoices</h3>

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
                ROI %
              </th>
              <th
                style={{
                  padding: "12px",
                  textAlign: "right",
                  borderBottom: "2px solid #ddd",
                }}
              >
                Penal %
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
            {!Array.isArray(invoices) || invoices.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#999",
                  }}
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
                    {invoice.roiPercentage ?? "-"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    {invoice.penalCharges ?? "-"}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    {invoice.status === "PENDING_CUSTOMER_APPROVAL" && (
                      <button
                        onClick={() => handleSendApprovalEmail(invoice.id)}
                        disabled={loading}
                        style={{
                          padding: "6px 12px",
                          background: "#28a745",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          marginRight: "5px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Send approval email to customer"
                      >
                        <FiMail size={12} /> Email
                      </button>
                    )}
                    <button
                      // onClick={() => navigate(`/invoice-discounting/rm/${invoice.id}`)}
                      onClick={() => {
                        handleViewCustomerInvoices(invoice);
                        setShowInvoiceModal(true);
                      }}
                      style={{
                        padding: "6px 12px",
                        background: "#007bff",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
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
      {showInvoiceModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          {/* MODAL BOX */}
          <div
            style={{
              width: "80%",
              maxHeight: "80vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "10px",
              padding: "20px",
              position: "relative",
            }}
          >
            {/* CLOSE BUTTON */}
            <button
              onClick={() => setShowInvoiceModal(false)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <FiX size={20} />
            </button>

            <h3 style={{ marginBottom: "15px" }}>
              {selectedCustomerName} - Invoice Details
            </h3>

            {selectedCustomerInvoices.map((inv) => (
              <div
                key={inv.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "15px",
                  marginBottom: "15px",
                  borderRadius: "6px",
                }}
              >
                <strong>Invoice #: {inv.invoiceNumber}</strong>
                <p>Amount: ₹{inv.invoiceAmount}</p>
                <p>ROI: {inv.roiPercentage}</p>
                <p>Penal: {inv.penalCharges}</p>

                {/* DOCUMENTS */}
                <div style={{ marginTop: "10px" }}>
                  <strong>Documents:</strong>

                  {selectedCustomerDocs.length === 0 ? (
                    <p>No documents</p>
                  ) : (
                    selectedCustomerDocs.map((doc) => {
                      const baseUrl =
                        import.meta.env.VITE_API_BASE_URL?.replace(
                          "/api",
                          "",
                        ) || "http://localhost:4000";

                      const fileUrl = doc.filePath?.startsWith("http")
                        ? doc.filePath
                        : `${baseUrl}/${doc.filePath?.replace(/\\/g, "/")}`;

                      return (
                        <div key={doc.id} style={{ marginTop: "5px" }}>
                          📄 {doc.fileName}
                          <button
                            onClick={() => window.open(fileUrl, "_blank")}
                            style={{ marginLeft: "10px" }}
                          >
                            View
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
    </div>
  );
}
