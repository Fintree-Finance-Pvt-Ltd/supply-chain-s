import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { workflowService } from "../../services/workflowService";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import { documentService } from "../../services/documentService";
import { FiUpload, FiEye } from "react-icons/fi";
import api from "../../services/api"; 

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

  const [customerLimits, setCustomerLimits] = useState({
  sanctionAmount: 0,
  utilizedAmount: 0,
  unutilizedAmount: 0,
});

  

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    invoiceDate: "",
    invoiceAmount: "",
    disbursementAmount: "",
    roiPercentage: "",
    penalCharges: "",
    serviceFee: "",
    sanctionAmount: "",
    utilizedAmount: "",
    unutilizedAmount: "",

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

    const customerInvoices = invoices.filter(
      (inv) => inv.customer?.id === customerId
    );

    setSelectedCustomerInvoices(customerInvoices);

    setSelectedCustomerName(
      invoice.customer?.name ||
      invoice.customer?.companyName ||
      "Customer"
    );

    const res = await documentService.getDocumentsByCustomer(customerId);
    const docs = res?.data || [];

    // ✅ only invoice docs
    const invoiceDocs = docs
      .filter((d) => d.documentType === "INVOICE")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // ✅ map invoice → doc
    const map = {};
    customerInvoices
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((inv, index) => {
        map[inv.id] = invoiceDocs[index] ? [invoiceDocs[index]] : [];
      });

    setSelectedCustomerDocs(map); 
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
        selectedCustomer.id
      );
      const supplierData = response?.data?.data || response?.data || [];
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);

      // ✅ FIXED ROI/ServiceFee fetch
      const ratesUrl = `/workflows/invoices/customers/${selectedCustomer.id}/lans/${lanId}/rates`;
      console.log('🔄 Fetching:', ratesUrl);
      
      try {
        const ratesResponse = await api.get(ratesUrl);
        console.log('✅ Response:', ratesResponse.data);
        
        if (ratesResponse.data?.success) {
          setFormData(prev => ({
            ...prev,
            roiPercentage: ratesResponse.data.data.roi || '',
              penalCharges: ratesResponse.data.data.penalCharges || '',
            serviceFee: ratesResponse.data.data.serviceFee || '',
            sanctionAmount: ratesResponse.data.data.sanctionAmount || '',
          utilizedAmount: ratesResponse.data.data.utilizedLimit || '',
          unutilizedAmount: ratesResponse.data.data.unutilizedLimit || '',
          }));

// ✅ set limit card values
 // ✅ customer limit cards
  setCustomerLimits({
    sanctionAmount: Number(
      data.sanctionAmount || 0
    ),

    utilizedAmount: Number(
      data.utilizedLimit || 0
    ),

    unutilizedAmount: Number(
      data.unutilizedLimit || 0
    ),
  });
// setCustomerLimits({
//   sanctionAmount: Number(data.sanctionAmount || 0),

//   utilizedAmount: Number(
//     data.utilizedLimit ||
//     data.utilized_limit ||
//     0
//   ),

//   unutilizedAmount: Number(
//     data.unutilizedLimit ||
//     data.unutilized_limit ||
//     (
//       Number(data.sanctionAmount || 0) -
//       Number(data.utilizedLimit || 0)
//     )
//   ),
// });
        }
      } catch (ratesError) {
        console.error('❌ Rates Error:', ratesError.response?.data || ratesError.message);
      }

    } catch (error) {
      console.error('Suppliers Error:', error);
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
  const fetchInvoiceDetails = (
  invoiceNumber,
  invoiceDate
) => {

  // ❌ both required
  if (
    !invoiceNumber ||
    !invoiceDate
  ) {
    return;
  }

  const existingInvoice =
    invoices.find(
      (inv) =>
        // same invoice number
        inv.invoiceNumber ?.toLowerCase() ?.trim() ===
        invoiceNumber
          ?.toLowerCase()
          ?.trim()

        &&

        // same invoice date
        inv.invoiceDate
          ?.split("T")[0] ===
        invoiceDate
    );

  console.log(
    "Existing Invoice:",
    existingInvoice
  );

  // ✅ auto fill amount
  if (existingInvoice) {

    setFormData((prev) => ({
      ...prev,
         invoiceAmount:
        existingInvoice.invoiceAmount || "",
    }));

    toast.info(
      "Invoice amount loaded"
    );

  } else {

    // clear amount
    setFormData((prev) => ({
      ...prev,

      invoiceAmount: "",
    }));
  }
};

const handleInvoiceNumberChange = (e) => {
  const value = e.target.value;

  setFormData((prev) => ({
    ...prev,
    invoiceNumber: value,
  }));

  // ✅ fetch using latest values
  fetchInvoiceDetails(
    value,
    formData.invoiceDate
  );
};

// const handleInvoiceNumberChange = async (e) => {
//   const value = e.target.value;

//   // set invoice number first
//   setFormData((prev) => ({
//     ...prev,
//     invoiceNumber: value,
//   }));

//   if (!value) return;

//   try {
//     console.log("Searching invoice:", value);

//     // find existing invoice
//     // const existingInvoice = invoices.find(
//     //   (inv) =>
//     //     inv.invoiceNumber?.toLowerCase().trim() ===
//     //     value.toLowerCase().trim()
//     // );



//     console.log("Existing Invoice:", existingInvoice);

//     // if invoice exists then auto fill
//     if (existingInvoice) {
//       setFormData((prev) => ({
//         ...prev,
//         invoiceNumber: existingInvoice.invoiceNumber || "",
//         invoiceDate: existingInvoice.invoiceDate
//           ? existingInvoice.invoiceDate.split("T")[0]
//           : "",
//         invoiceAmount: existingInvoice.invoiceAmount || "",
//       }));

//       toast.info("Invoice details loaded");
//     }
//   } catch (error) {
//     console.error("Error fetching invoice:", error);
//   }
// };



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

  // ✅ save uploaded invoice file path
  invoiceFilePath:
    invoiceFiles?.[0]?.filePath || "",
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

        const response = await workflowService.createInvoice({
  customerId: selectedCustomer.id,

  loanAccountId: selectedLAN,

  supplierId: selectedSupplier.id,

  ...formData,

  // ✅ uploaded invoice document path
  invoiceFilePath:
    invoiceFiles?.[0]?.filePath || "",
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
          serviceFee: "",
          sanctionAmount: "",
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
          serviceFee: "",
          sanctionAmount: "",

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

      // ONLY upload document
      const res = await documentService.uploadDocument(
        selectedCustomer.id,
        file,
        "INVOICE",
        "applicant",
        0,
        null,
        {}
      );

      uploaded.push(res.data);
    }

    // store uploaded docs in state
    setInvoiceFiles((prev) => [...prev, ...uploaded]);

    toast.success("Invoice uploaded successfully");

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


  // ✅ LAN wise invoice date validation days
const getAllowedInvoiceDays = () => {

  // selected LAN object
  const selectedLanObj = loanAccounts.find(
    (lan) => String(lan.id) === String(selectedLAN)
  );

  // LAN name/id
  const lanName =
    selectedLanObj?.lanId?.toUpperCase() || "";

  // FFPL → 90 Days
  if (lanName.includes("FFPL")) {
    return 90;
  }

  // KT → 120 Days
  if (
    lanName.includes("KT")
  ) {
    return 120;
  }

  // MF → 40 Days
  if (lanName.includes("MF")) {
    return 40;
  }

  // default
  return 90;
};

 return (
    <div style={{ 
      padding: "30px", 
      backgroundColor: "#f8fafc", 
      minHeight: "100vh", 
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#1e293b"
    }}>
      <h2 style={{ 
        marginBottom: "30px", 
        fontSize: "26px", 
        fontWeight: "700", 
        color: "#0f172a",
        letterSpacing: "-0.025em"
      }}>
        Invoice Discounting <span style={{ color: "#6366f1", fontWeight: "400" }}>— RM Dashboard</span>
      </h2>

      {/* Invoice Entry Form */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(10px)",
          padding: "32px",
          borderRadius: "16px",
          marginBottom: "32px",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 10px -2px rgba(0, 0, 0, 0.02)",
          border: "1px solid rgba(226, 232, 240, 0.8)",
        }}
      >
        <h3 style={{ marginBottom: "24px", fontSize: "18px", fontWeight: "600", color: "#334155" }}>
          Create New Invoice
        </h3>


        {/* Customer Limit Details Card */}
{selectedCustomer && (
  <div
    style={{
      marginBottom: "28px",
      padding: "24px",
      borderRadius: "18px",
      background:
        "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      border: "1px solid #e2e8f0",
      boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "18px",
      }}
    >
      <div>
        <h4
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          Customer Limit Details
        </h4>

        <p
          style={{
            margin: "4px 0 0",
            fontSize: "13px",
            color: "#64748b",
          }}
        >
          {selectedCustomer.companyName || selectedCustomer.name}
        </p>
      </div>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "18px",
      }}
    >
      {/* Section Amount */}
      <div
        style={{
          padding: "20px",
          borderRadius: "16px",
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#1d4ed8",
            marginBottom: "8px",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Sanction Amount
        </div>

        <div
          style={{
            fontSize: "28px",
            fontWeight: "800",
            color: "#1e3a8a",
          }}
        >
        
          ₹ {formatINR(formData.sanctionAmount)}
        </div>
      </div>

      {/* Utilized */}
      <div
        style={{
          padding: "20px",
          borderRadius: "16px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#dc2626",
            marginBottom: "8px",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Utilized
        </div>

        <div
          style={{
            fontSize: "28px",
            fontWeight: "800",
            color: "#991b1b",
          }}
        >
          ₹ {formatINR(formData.utilizedAmount)}
        </div>
      </div>

      {/* Unutilized */}
      <div
        style={{
          padding: "20px",
          borderRadius: "16px",
          background: "#ecfdf5",
          border: "1px solid #bbf7d0",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#059669",
            marginBottom: "8px",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Unutilized
        </div>

        <div
          style={{
            fontSize: "28px",
            fontWeight: "800",
            color: "#065f46",
          }}
        >
          ₹ {formatINR(formData.unutilizedAmount)}
        </div>
      </div>
    </div>
  </div>
)}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
          }}
        >
          {/* Customer Selection */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "14px",
                color: "#202b3a"
              }}
            >
              <FiUser style={{ marginRight: "8px", color: "#6366f1" }} />
              Select Customer
            </label>
            <select
              value={selectedCustomer?.id || ""}
              onChange={(e) => handleCustomerChange(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                backgroundColor: "#fff",
                fontSize: "14px",
                outline: "none",
                transition: "border-color 0.2s",
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
                fontWeight: "600",
                fontSize: "14px",
                color: "#202b3a"
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
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                background: "#f1f5f9",
                color: "#94a3b8",
                fontSize: "14px",
              }}
            />
          </div>

          {/* LAN Selection */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "14px",
                color: "#202b3a"
              }}
            >
              <FiFileText style={{ marginRight: "8px", color: "#6366f1" }} />
              Select LAN
            </label>
            <select
              value={selectedLAN}
              onChange={(e) => handleLANChange(e.target.value)}
              disabled={!selectedCustomer}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                backgroundColor: selectedCustomer ? "#fff" : "#f1f5f9",
                fontSize: "14px",
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
                fontWeight: "600",
                fontSize: "14px",
                color: "#202b3a"
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
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                backgroundColor: selectedLAN ? "#fff" : "#f1f5f9",
                fontSize: "16px",
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
                background: "#f8fafc",
                padding: "20px",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <h4 style={{ marginBottom: "16px", fontSize: "16px", color: "#6366f1", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Supplier Bank Details
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "20px",
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", color: "#94a3b8" }}>Bank Name</div>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>{supplierBankDetails.bankName}</div>
                </div>
                <div>
                  <div style={{ fontSize: "14px", color: "#94a3b8" }}>Account Number</div>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>{supplierBankDetails.bankAccountNumber}</div>
                </div>
                <div>
                  <div style={{ fontSize: "14px", color: "#94a3b8" }}>IFSC Code</div>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>{supplierBankDetails.ifscCode}</div>
                </div>
                <div>
                  <div style={{ fontSize: "14px", color: "#94a3b8" }}>Account Holder</div>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>{supplierBankDetails.accountHolderName}</div>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Details */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "16px",
                color: "#202b3a"
              }}
            >
              <FiFileText style={{ marginRight: "8px", color: "#6366f1" }} />
              Invoice Number
            </label>
            <input
              type="text"
              name="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={handleInvoiceNumberChange}
              placeholder="INV-001"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "16px",
              }}
            />
          </div>
<div>
  <label
    style={{
      display: "flex",
      alignItems: "center",
      marginBottom: "8px",
      fontWeight: "600",
      fontSize: "16px",
      color: "#202b3a"
    }}
  >
    <FiCalendar style={{ marginRight: "8px", color: "#6366f1" }} />
    Invoice Date
  </label>

  <input
    type="date"
    name="invoiceDate"
    value={formData.invoiceDate}
    onChange={(e) => {
      const selectedValue = e.target.value;
      const selectedDate = new Date(selectedValue);

      const today = new Date();

      // ✅ dynamic days based on LAN
      const allowedDays = getAllowedInvoiceDays();

      const minDate = new Date();

      minDate.setDate(today.getDate() - allowedDays);

      // remove time
      selectedDate.setHours(0,0,0,0);
      today.setHours(0,0,0,0);
      minDate.setHours(0,0,0,0);

      // ❌ future date
      if (selectedDate > today) {
        toast.error(
          "Future invoice date is not allowed"
        );
        return;
      }

      // ❌ older than allowed days
      if (selectedDate < minDate) {
        toast.error(
          `Invoice date cannot be older than ${allowedDays} days`
        );
        return;
      }
  // ✅ update state FIRST
  setFormData((prev) => {

    const updatedData = {
      ...prev,

      invoiceDate: selectedValue,
    };

    // ✅ fetch invoice after state update
    const existingInvoice =
      invoices.find(
        (inv) =>

          inv.invoiceNumber
            ?.toLowerCase()
            ?.trim() ===

          updatedData.invoiceNumber
            ?.toLowerCase()
            ?.trim()

          &&

          inv.invoiceDate
            ?.split("T")[0] ===
          selectedValue
      );

    // ✅ auto fill invoice amount
    if (existingInvoice) {

      updatedData.invoiceAmount =
        existingInvoice.invoiceAmount || "";

      toast.info(
        "Invoice amount loaded"
      );

    } else {

      updatedData.invoiceAmount = "";
    }

    return updatedData;
  });

}}
//     onChange={(e) => {
//       fetchInvoiceDetails(
//   formData.invoiceNumber,
//   e.target.value
// );

//       const selectedDate = new Date(e.target.value);

//       const today = new Date();

//       // ✅ dynamic days based on LAN
//       const allowedDays = getAllowedInvoiceDays();

//       const minDate = new Date();

//       minDate.setDate(today.getDate() - allowedDays);

//       // remove time
//       selectedDate.setHours(0,0,0,0);
//       today.setHours(0,0,0,0);
//       minDate.setHours(0,0,0,0);

//       // ❌ future date
//       if (selectedDate > today) {
//         toast.error(
//           "Future invoice date is not allowed"
//         );
//         return;
//       }

//       // ❌ older than allowed days
//       if (selectedDate < minDate) {
//         toast.error(
//           `Invoice date cannot be older than ${allowedDays} days`
//         );
//         return;
//       }

//       handleInputChange(e);
//     }}

    // ✅ dynamic calendar restriction
    min={
      new Date(
        new Date().setDate(
          new Date().getDate() - getAllowedInvoiceDays()
        )
      )
        .toISOString()
        .split("T")[0]
    }

    max={new Date().toISOString().split("T")[0]}

    disabled={!selectedLAN}

    style={{
      width: "100%",
      padding: "12px",
      border: "1px solid #e2e8f0",
      borderRadius: "10px",
      fontSize: "16px",
      background: selectedLAN ? "#fff" : "#f1f5f9",
    }}
  />

  <p
    style={{
      marginTop: "6px",
      fontSize: "12px",
      color: "#64748b",
    }}
  >
    Invoice date must be within last{" "}
    <strong>{getAllowedInvoiceDays()} days</strong>
  </p>
</div>

          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "16px",
                color: "#202b3a"
              }}
            >
              <FiDollarSign style={{ marginRight: "8px", color: "#6366f1" }} />
              Invoice Amount
            </label>
            <input
              type="number"
              name="invoiceAmount"
              value={formData.invoiceAmount}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600"
              }}
            />
            {formData.invoiceAmount && (
              <p
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#6366f1",
                  background: "#eef2ff",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  display: "inline-block",
                  fontWeight: "600",
                }}
              >
                ₹ {formatINR(formData.invoiceAmount)} ({numberToWords(formData.invoiceAmount)} Only)
              </p>
            )}
          </div>

          {/* <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "16px",
                color: "#202b3a"
              }}
            >
              <FiDollarSign style={{ marginRight: "8px", color: "#6366f1" }} />
              Disbursement Amount
            </label>
            <input
              type="number"
              name="disbursementAmount"
              value={formData.disbursementAmount}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "600"
              }}
            />

            {formData.disbursementAmount && (
              <p
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#6366f1",
                  background: "#eef2ff",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  display: "inline-block",
                  fontWeight: "600",
                }}
              >
                ₹ {formatINR(formData.disbursementAmount)} ({numberToWords(formData.disbursementAmount)} Only)
              </p>
            )}
          </div> */}
<div>
<label

    style={{

      display: "flex",

      alignItems: "center",

      marginBottom: "8px",

      fontWeight: "600",

      fontSize: "16px",

      color: "#202b3a"

    }}
>
<FiDollarSign style={{ marginRight: "8px", color: "#6366f1" }} />

    Disbursement Amount
</label>
 
  <input

    type="number"

    name="disbursementAmount"

    value={formData.disbursementAmount}

    onWheel={(e) => e.target.blur()}
 
    onChange={(e) => {
 
      const value = e.target.value;
 
      // ✅ convert values

      const enteredAmount = Number(value || 0);
 
    const availableLimit = Number(
  formData.unutilizedAmount || formData.sanctionAmount || 0
);

// ✅ existing utilized disbursement against same invoice
const existingDisbursement = invoices
  .filter(
    (inv) =>
      // ✅ same invoice number
      (
        inv.invoiceNumber === formData.invoiceNumber ||
        inv.invoiceNumber?.startsWith(
          `${formData.invoiceNumber}_`
        )
      ) &&
      // ✅ same supplier
      String(inv.supplier?.id || inv.supplierId) ===
        String(selectedSupplier?.id)
      &&
      // ✅ same invoice date
      (
        inv.invoiceDate
          ?.split("T")[0] ===
        formData.invoiceDate
      )
  )
  .reduce(
    (sum, inv) =>
      sum + Number(inv.disbursementAmount || 0),
    0
  );

// ✅ current invoice amount
const invoiceAmount = Number(
  formData.invoiceAmount || 0
);

// ✅ total after current entry
const totalDisbursement =
  existingDisbursement + enteredAmount;

// ❌ invoice amount exceeded
if (totalDisbursement > invoiceAmount) {

  toast.error(
    `Total disbursement cannot exceed invoice amount.
    
Already Utilized: ₹${formatINR(existingDisbursement)}
Invoice Amount: ₹${formatINR(invoiceAmount)}
Remaining Allowed: ₹${formatINR(
      invoiceAmount - existingDisbursement
    )}`
  );

  return;
}
 
      // ❌ validation

      if (enteredAmount > availableLimit) {
 
        toast.error(

          `Disbursement amount cannot exceed unutilized limit of ₹${formatINR(availableLimit)}`

        );
 
        return;

      }
 
      handleInputChange(e);

    }}
 
    placeholder="0.00"
 
    style={{

      width: "100%",

      padding: "12px",

      border:

        Number(formData.disbursementAmount || 0) >

        Number(customerLimits.unutilizedAmount || 0)

          ? "1px solid #ef4444"

          : "1px solid #e2e8f0",
 
      borderRadius: "10px",

      fontSize: "16px",

      fontWeight: "600",

    }}

  />
 
  {/* LIMIT INFO */}
<div

    style={{

      marginTop: "8px",

      display: "flex",

      justifyContent: "space-between",

      alignItems: "center",

      flexWrap: "wrap",

      gap: "8px",

    }}
>
<p

      style={{

        fontSize: "12px",

        color: "#64748b",

        margin: 0,

      }}
>

      Available Limit:
<strong style={{ color: "#059669" }}>

        {" "}

        ₹ {formatINR(customerLimits.unutilizedAmount)}
</strong>
</p>
 
    {formData.disbursementAmount && (
<p

        style={{

          fontSize: "13px",

          color: "#6366f1",

          background: "#eef2ff",

          padding: "4px 10px",

          borderRadius: "20px",

          display: "inline-block",

          fontWeight: "600",

          margin: 0,

        }}
>

        ₹ {formatINR(formData.disbursementAmount)} (

        {numberToWords(formData.disbursementAmount)} Only)
</p>

    )}
</div>
</div>
 
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "16px",
                color: "#202b3a"
              }}
            >
              <FiDollarSign style={{ marginRight: "8px", color: "#6366f1" }} />
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
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "16px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "14px",
                color: "#202b3a"
              }}
            >
              <FiDollarSign style={{ marginRight: "8px", color: "#6366f1" }} />
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
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "8px",
                fontWeight: "600",
                fontSize: "14px",
                color: "#202b3a"
              }}
            >
              <FiDollarSign style={{ marginRight: "8px", color: "#6366f1" }} />
             Service Fee
            </label>
            
            <input
              type="number"
              name="serviceFee"
              value={formData.serviceFee}
              onWheel={(e) => e.target.blur()}
              onChange={handleInputChange}
              placeholder="e.g. 2.0"
              step="0.01"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "14px",
              }}
            />
          </div>


          <div style={{ gridColumn: "1 / -1", marginTop: "24px" }}>
            <label style={{ fontWeight: "600", fontSize: "14px", color: "#334155", display: "block", marginBottom: "12px" }}>
              Upload Invoice Documents
            </label>

            {/* SHOW UPLOADED FILES */}
            {invoiceFiles.length > 0 && (
              <div style={{ marginBottom: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {invoiceFiles.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                    }}
                  >
                    <FiFileText color="#10b981" size={18} />

                    <span style={{ flex: 1, fontSize: "13px", fontWeight: "500", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.fileName}
                    </span>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        style={{ border: "none", background: "#f1f5f9", padding: "6px", borderRadius: "6px", cursor: "pointer", color: "#202b3a" }}
                        onClick={() => {
                          const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "http://localhost:4000";
                          const fileUrl = doc.filePath?.startsWith("http") ? doc.filePath : `${baseUrl}/${doc.filePath?.replace(/\\/g, "/")}`;
                          window.open(fileUrl, "_blank");
                        }}
                      >
                        <FiEye size={14} />
                      </button>

                      <button 
                        style={{ border: "none", background: "#fef2f2", padding: "6px", borderRadius: "6px", cursor: "pointer", color: "#ef4444" }}
                        onClick={() => handleRemoveInvoice(doc.id)}
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ALWAYS SHOW UPLOAD BUTTON */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: "2px dashed #6366f1",
                padding: "30px",
                textAlign: "center",
                borderRadius: "16px",
                cursor: "pointer",
                background: "#f5f3ff",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleInvoiceUpload}
                style={{ display: "none" }}
              />

              <FiUpload size={32} color="#6366f1" style={{ marginBottom: "12px" }} />
              <p style={{ color: "#4338ca", fontWeight: "600", margin: 0, fontSize: "15px" }}>
                Click to upload or drag & drop
              </p>
              <p style={{ color: "#6366f1", fontSize: "12px", marginTop: "4px" }}>
                PDF, JPG or PNG (Max 10MB)
              </p>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: "32px", display: "flex", gap: "16px", justifyContent: "flex-end" }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 24px",
              background: "#fff",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s"
            }}
          >
            <FiSave /> Save Draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 28px",
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
              transition: "all 0.2s"
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
          padding: "0",
          borderRadius: "16px",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
          border: "1px solid #e2e8f0",
          overflow: "hidden"
        }}
      >
        <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
           <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#334155" }}>My Invoices</h3>
           <span style={{ fontSize: "12px", background: "#f1f5f9", padding: "4px 12px", borderRadius: "20px", color: "#202b3a", fontWeight: "600" }}>
             Total: {invoices.length}
           </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>Invoice #</th>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>Customer</th>
              <th style={{ padding: "16px 24px", textAlign: "left", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>Supplier</th>
              <th style={{ padding: "16px 24px", textAlign: "right", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>Amount</th>
              <th style={{ padding: "16px 24px", textAlign: "right", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>ROI %</th>
              <th style={{ padding: "16px 24px", textAlign: "right", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>Penal %</th>
              <th style={{ padding: "16px 24px", textAlign: "center", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>Status</th>
              <th style={{ padding: "16px 24px", textAlign: "center", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#202b3a", fontWeight: "700" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!Array.isArray(invoices) || invoices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                  No invoices found in your history
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.2s" }}>
                  <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>{invoice.invoiceNumber}</td>
                  <td style={{ padding: "16px 24px", fontSize: "14px", color: "#475569" }}>
                    {invoice.customer?.name || invoice.customer?.companyName || invoice.customerName || "N/A"}
                  </td>
                  <td style={{ padding: "16px 24px", fontSize: "14px", color: "#475569" }}>
                    {invoice.supplier?.supplierName || invoice.supplierName || "N/A"}
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
                    ₹{invoice.invoiceAmount?.toLocaleString()}
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "14px" }}>{invoice.roiPercentage ?? "-"}</td>
                  <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "14px" }}>{invoice.penalCharges ?? "-"}</td>
                  <td style={{ padding: "16px 24px", textAlign: "right", fontSize: "14px" }}>{invoice.serviceFee ?? "-"}</td>

                  <td style={{ padding: "16px 24px", textAlign: "center" }}>
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      {invoice.status === "PENDING_CUSTOMER_APPROVAL" && (
                        <button
                          onClick={() => handleSendApprovalEmail(invoice.id)}
                          disabled={loading}
                          style={{
                            padding: "6px 12px",
                            background: "#ecfdf5",
                            color: "#059669",
                            border: "1px solid #10b981",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <FiMail size={12} /> Email
                        </button>
                      )}
                      <button
                        onClick={() => {
                          handleViewCustomerInvoices(invoice);
                          setShowInvoiceModal(true);
                        }}
                        style={{
                          padding: "6px 16px",
                          background: "#eef2ff",
                          color: "#4f46e5",
                          border: "1px solid #6366f1",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        View
                      </button>
                    </div>
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
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          {/* MODAL BOX */}
          <div
            style={{
              width: "800px",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "20px",
              padding: "32px",
              position: "relative",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            {/* CLOSE BUTTON */}
            <button
              onClick={() => setShowInvoiceModal(false)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                border: "none",
                background: "#f1f5f9",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#202b3a"
              }}
            >
              <FiX size={18} />
            </button>

            <h3 style={{ marginBottom: "24px", fontSize: "20px", fontWeight: "700", color: "#1e293b", paddingRight: "40px" }}>
              {selectedCustomerName} <span style={{ fontWeight: "400", color: "#202b3a" }}>Details</span>
            </h3>
{selectedCustomerInvoices.map((inv) => (
  <div
    key={inv.id}
    style={{
      background: "#fff",
      padding: "20px",
      marginBottom: "24px", // Increased margin for better separation
      borderRadius: "16px",
      border: "1px solid #e2e8f0", // Subtle but visible border
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)", // Soft shadow for depth
      position: "relative",
      overflow: "hidden"
    }}
  >
    {/* Decorative side accent to clearly mark the start of a new card */}
    <div style={{
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: "4px",
      background: "#6366f1"
    }} />

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
      <strong style={{ fontSize: "16px", color: "#1e293b" }}>Invoice #{inv.invoiceNumber}</strong>
      <span style={{ fontSize: "18px", fontWeight: "800", color: "#6366f1" }}>₹{inv.invoiceAmount}</span>
    </div>
    
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        <div style={{ fontSize: "13px" }}><span style={{ color: "#94a3b8" }}>ROI:</span> <span style={{ fontWeight: "600" }}>{inv.roiPercentage}%</span></div>
        <div style={{ fontSize: "13px" }}><span style={{ color: "#94a3b8" }}>Penal:</span> <span style={{ fontWeight: "600" }}>{inv.penalCharges}%</span></div>
        <div style={{ fontSize: "13px" }}><span style={{ color: "#94a3b8" }}>Service Fee:</span> <span style={{ fontWeight: "600" }}>{inv.serviceFee}</span></div>
    </div>

    {/* DOCUMENTS */}
    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
      <strong style={{ fontSize: "13px", color: "#475569", display: "block", marginBottom: "10px" }}>Attached Documents:</strong>

      {selectedCustomerDocs.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>No documents available</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
       {(() => {
  const docs = selectedCustomerDocs[inv.id] || [];

  if (docs.length === 0) {
    return (
      <p style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>
        No documents available
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {docs.map((doc) => {
        const baseUrl =
          import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ||
          "http://localhost:4000";

        const fileUrl = doc.filePath?.startsWith("http")
          ? doc.filePath
          : `${baseUrl}/${doc.filePath?.replace(/\\/g, "/")}`;

        return (
          <div
            key={doc.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#f8fafc",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              📄 {doc.fileName}
            </span>

            <button
              onClick={() => window.open(fileUrl, "_blank")}
              style={{
                background: "#6366f1",
                color: "#fff",
                border: "none",
                padding: "5px 12px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              View File
            </button>
          </div>
        );
      })}
    </div>
  );
})()}
        </div>
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
