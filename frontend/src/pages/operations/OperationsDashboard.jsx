import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiX, FiFileText, FiUpload, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import axios from "axios";
import { workflowService } from "../../services/workflowService";
import { operationsService } from "../../services/operationsService";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/format";
import { toast } from "react-toastify";

const OperationsDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isDashboardPage = location.pathname === "/operations/dashboard";
  const isPendingPage = location.pathname === "/operations/pending";

  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerMigrationFile, setCustomerMigrationFile] = useState(null);
  const [supplierMigrationFile, setSupplierMigrationFile] = useState(null);
  const [migrationUploading, setMigrationUploading] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);

  const [showViewModal, setShowViewModal] = useState(false);

  // ✅ NEW STATES
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    const loadCases = async () => {
      try {
        setIsLoading(true);

        const response = await workflowService.getOperationsDashboard();

        setCases(response.data?.data || []);
      } catch (error) {
        console.error("Error loading operations cases:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCases();
  }, []);

  const columns = [
    {
      key: "customerName",
      label: "Customer Name",
      render: (_, row) =>
        row.customer?.customerName ||
        row?.customer?.name?.trim() ||
        row?.customer?.companyName?.trim() ||
        "N/A",
    },
    {
      key: "customerCode",
      label: "Customer Code",
      render: (_, row) => row.customer?.customerCode || "N/A",
    },
    {
      key: "currentStatus",
      label: "Stage",
      render: (value) => (
        <StatusBadge
          status={value}
          label={value.replace(/_/g, " ").toUpperCase()}
        />
      ),
    },
    {
      key: "updatedAt",
      label: "Received Date",
      render: (value) => formatDate(value),
    },
  ];

  // ✅ UPDATED CLICK HANDLER
  const handleRowClick = async (row) => {
    try {
      // ✅ INVOICE DISCOUNTING
      if (row.workflowType === "INVOICE_DISCOUNTING") {
        setLoadingInvoice(true);

        // ✅ CALL INVOICE DETAILS API
        const token = localStorage.getItem("scf_token");

        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/workflows/invoices/${row.invoiceId}/details`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.data.success) {
          console.log("Invoice Details:", response.data.data);

          setInvoiceDetails(response.data.data);

          setSelectedInvoice(row);

          setShowViewModal(true);
        }

        setLoadingInvoice(false);

        return;
      }

      // ✅ CUSTOMER ONBOARDING FLOW
      navigate(`/operations/case/${row.customerId}`);
    } catch (error) {
      console.error("Error fetching invoice details:", error);

      setLoadingInvoice(false);
    }
  };

  const handleMigrationUpload = async (type) => {
    const file =
      type === "customer" ? customerMigrationFile : supplierMigrationFile;

    if (!file) {
      toast.error("Please select an .xlsx file");
      return;
    }

    try {
      setMigrationUploading(type);
      const response =
        type === "customer"
          ? await operationsService.uploadCustomerMigration(file)
          : await operationsService.uploadSupplierMigration(file);

      setMigrationResult({
        type,
        ...response,
      });

      if (response.success) {
        toast.success(response.message || "Migration completed");
      } else {
        toast.warning(response.message || "Migration completed with issues");
      }
    } catch (error) {
      console.error("Migration upload failed:", error);
      toast.error(error.message || "Migration upload failed");
    } finally {
      setMigrationUploading(null);
    }
  };

  const migrationColumns = [
    {
      key: "rowNumber",
      label: "Row",
    },
    {
      key: "reference",
      label: "Reference",
      render: (value) => value || "N/A",
    },
    {
      key: "name",
      label: "Name",
      render: (value) => value || "N/A",
    },
    {
      key: "localStatus",
      label: "Local",
      render: (value) => (
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
            value === "SAVED"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {value === "SAVED" ? <FiCheckCircle /> : <FiAlertTriangle />}
          {value}
        </span>
      ),
    },
    {
      key: "lmsStatus",
      label: "LMS",
      render: (value) => (
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
            value === "SENT"
              ? "bg-emerald-50 text-emerald-700"
              : value === "PENDING"
                ? "bg-amber-50 text-amber-700"
                : "bg-rose-50 text-rose-700"
          }`}
        >
          {value === "SENT" ? <FiCheckCircle /> : <FiAlertTriangle />}
          {value}
        </span>
      ),
    },
    {
      key: "message",
      label: "Message",
      render: (value) => value || "-",
    },
  ];

  const customerPending = (cases.pending || []).filter(
    (item) => item.workflowType === "CUSTOMER_ONBOARDING",
  );

  const customerHandled = (cases.handled || []).filter(
    (item) => item.workflowType === "CUSTOMER_ONBOARDING",
  );

  const invoiceHandled = (cases.handled || []).filter(
    (item) => item.workflowType === "INVOICE_DISCOUNTING",
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* TOP HEADER */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              Operations Dashboard
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Real-time workflow monitoring & invoice operations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-400 font-medium">
                Pending Cases
              </p>

              <h2 className="text-2xl font-black text-amber-500">
                {customerPending.length}
              </h2>
            </div>

            {/* <div className="px-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-400 font-medium">
              Handled Invoices
            </p>

            <h2 className="text-2xl font-black text-indigo-600">
              {invoiceHandled.length}
            </h2>
          </div> */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* KPI CARDS */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 text-white shadow-xl shadow-indigo-200">

          <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full blur-2xl" />

          <p className="text-indigo-100 text-sm font-medium">
            Pending Reviews
          </p>

          <h2 className="text-5xl font-black mt-4">
            {customerPending.length}
          </h2>

          <p className="mt-4 text-indigo-100 text-sm">
            Cases awaiting operational review
          </p>

        </div>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-xl shadow-emerald-200">

          <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full blur-2xl" />

          <p className="text-emerald-100 text-sm font-medium">
            Handled Customers
          </p>

          <h2 className="text-5xl font-black mt-4">
            {customerHandled.length}
          </h2>

          <p className="mt-4 text-emerald-100 text-sm">
            Successfully processed customer workflows
          </p>

        </div>

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 p-6 text-white shadow-xl shadow-cyan-200">

          <div className="absolute right-0 top-0 h-32 w-32 bg-white/10 rounded-full blur-2xl" />

          <p className="text-cyan-100 text-sm font-medium">
            Invoice Cases
          </p>

          <h2 className="text-5xl font-black mt-4">
            {invoiceHandled.length}
          </h2>

          <p className="mt-4 text-cyan-100 text-sm">
            Invoice discounting workflows completed
          </p>

        </div>

      </div> */}

        {isDashboardPage && (
          <section className="rounded-[24px] bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Customer & Supplier Migration
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Upload Excel data for only old customers and suppliers.
                </p>
              </div>

              {/* {migrationResult?.summary && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 px-4 py-2">
                    <p className="text-xs text-slate-400">Rows</p>
                    <p className="font-black text-slate-900">
                      {migrationResult.summary.totalRows}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-4 py-2">
                    <p className="text-xs text-emerald-500">LMS Sent</p>
                    <p className="font-black text-emerald-700">
                      {migrationResult.summary.lmsSent}
                    </p>
                  </div>
                  <div className="rounded-lg bg-rose-50 px-4 py-2">
                    <p className="text-xs text-rose-500">Failed</p>
                    <p className="font-black text-rose-700">
                      {migrationResult.summary.failed}
                    </p>
                  </div>
                </div>
              )} */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-6 border-b lg:border-b-0 lg:border-r border-slate-100">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Customer Excel
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Customers, sanctions, LAN and bank data.
                    </p>
                  </div>
                  <FiFileText className="h-6 w-6 text-indigo-500" />
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) =>
                      setCustomerMigrationFile(event.target.files?.[0] || null)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleMigrationUpload("customer")}
                    disabled={migrationUploading === "customer"}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                  >
                    <FiUpload />
                    {migrationUploading === "customer" ? "Uploading" : "Upload"}
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Supplier Excel
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Suppliers mapped to migrated customers or LANs.
                    </p>
                  </div>
                  <FiFileText className="h-6 w-6 text-emerald-500" />
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) =>
                      setSupplierMigrationFile(event.target.files?.[0] || null)
                    }
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleMigrationUpload("supplier")}
                    disabled={migrationUploading === "supplier"}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                  >
                    <FiUpload />
                    {migrationUploading === "supplier" ? "Uploading" : "Upload"}
                  </button>
                </div>
              </div>
            </div>

            {migrationResult?.results?.length > 0 && (
              <div className="border-t border-slate-100 p-2">
                <div className="px-6 py-4">
                  <h3 className="text-lg font-black text-slate-900">
                    {migrationResult.type === "customer"
                      ? "Customer"
                      : "Supplier"}{" "}
                    Upload Result
                  </h3>
                </div>
                <DataTable
                  data={migrationResult.results}
                  columns={migrationColumns}
                />
              </div>
            )}
          </section>
        )}

        {/* PENDING CUSTOMER SECTION */}
        {(isPendingPage || isDashboardPage) && (
          <section className="rounded-[32px] bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Pending Customer Reviews
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Operational approvals awaiting action
                </p>
              </div>

              {/* <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-600 text-sm font-bold border border-amber-100">
              {customerPending.length} Active
            </div> */}
            </div>

            <div className="p-2">
              {isLoading ? (
                <div className="py-24 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                <DataTable
                  data={customerPending}
                  columns={columns}
                  onRowClick={handleRowClick}
                />
              )}
            </div>
          </section>
        )}

        {/* HANDLED CUSTOMER */}
        {isDashboardPage && (
          <>
            <section className="rounded-[32px] bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Handled Customer Cases
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Completed onboarding & approvals
                  </p>
                </div>

                <div className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-bold border border-emerald-100">
                  {customerHandled.length} Completed
                </div>
              </div>

              <div className="p-2">
                <DataTable
                  data={customerHandled}
                  columns={columns}
                  onRowClick={handleRowClick}
                />
              </div>
            </section>

            {/* INVOICE SECTION */}
            <section className="rounded-[32px] bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Invoice Discounting
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Processed invoice financing workflows
                  </p>
                </div>

                <div className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-bold border border-indigo-100">
                  {invoiceHandled.length} Processed
                </div>
              </div>

              <div className="p-2">
                <DataTable
                  data={invoiceHandled}
                  columns={columns}
                  onRowClick={handleRowClick}
                />
              </div>
            </section>
          </>
        )}
      </div>

      {/* LOADING OVERLAY */}
      {loadingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 shadow-2xl flex flex-col items-center gap-4">
            <LoadingSpinner />

            <p className="text-sm font-medium text-slate-500">
              Loading invoice details...
            </p>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showViewModal && invoiceDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-5 transition-all">
          <div className="bg-white w-full max-w-5xl rounded-[32px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-200/60">
            {/* MODAL HEADER - Simple Smooth Slate Design */}
            <div className="relative bg-slate-50 border-b border-slate-100 px-10 py-8">
              {/* Close Button - Muted & Minimal */}
              <button
                onClick={() => setShowViewModal(false)}
                className="absolute right-8 top-8 h-10 w-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:shadow-sm flex items-center justify-center transition-all active:scale-95"
              >
                <FiX size={18} />
              </button>

              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-3xl bg-white/10 flex items-center justify-center">
                  <FiFileText size={28} />
                </div>

                <div>
                  <h2 className="text-3xl font-black">Invoice Details</h2>

                  <p className="text-black-100 mt-1">
                    Invoice #{invoiceDetails.invoiceNumber}
                  </p>
                </div>
              </div>
            </div>

            {/* BODY */}
            <div className="p-10 max-h-[80vh] overflow-y-auto">
              <div className="p-8 space-y-6">
                {/* TOP CARD */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                    <div>
                      <p className="text-xs text-slate-500">Invoice Number</p>
                      <p className="font-bold text-lg">
                        {invoiceDetails.invoiceNumber}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <StatusBadge
                        status={invoiceDetails.status}
                        label={invoiceDetails.status}
                      />
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Invoice Date</p>
                      <p className="font-bold">
                        {formatDate(invoiceDetails.invoiceDate)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Invoice Amount</p>
                      <p className="font-bold text-indigo-600">
                        ₹
                        {Number(
                          invoiceDetails.invoiceAmount || 0,
                        ).toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Disbursement Amount
                      </p>
                      <p className="font-bold text-emerald-600">
                        ₹
                        {Number(
                          invoiceDetails.disbursementAmount || 0,
                        ).toLocaleString("en-IN")}
                      </p>
                    </div>

                    {/* <div>
        <p className="text-xs text-slate-500">Sanction Amount</p>
        <p className="font-bold">
          ₹{Number(invoiceDetails.sanctionAmount || 0).toLocaleString('en-IN')}
        </p>
      </div> */}
                    {/* 
      <div>
        <p className="text-xs text-slate-500">Utilized Limit</p>
        <p className="font-bold text-rose-600">
          ₹{Number(invoiceDetails.utilizedLimit || 0).toLocaleString('en-IN')}
        </p>
      </div>

      <div>
        <p className="text-xs text-slate-500">Unutilized Limit</p>
        <p className="font-bold text-cyan-600">
          ₹{Number(invoiceDetails.unutilizedLimit || 0).toLocaleString('en-IN')}
        </p>
      </div> */}

                    <div>
                      <p className="text-xs text-slate-500">Invoice Due Date</p>
                      <p className="font-bold">
                        {invoiceDetails.invoiceDueDate
                          ? formatDate(invoiceDetails.invoiceDueDate)
                          : "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        Disbursement Date
                      </p>
                      <p className="font-bold">
                        {invoiceDetails.disbursementDate
                          ? formatDate(invoiceDetails.disbursementDate)
                          : "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">ROI Percentage</p>
                      <p className="font-bold">
                        {invoiceDetails.roiPercentage}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">ROI Amount</p>
                      <p className="font-bold">
                        ₹
                        {Number(invoiceDetails.roiAmount || 0).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                    </div>

                    {/* <div>
        <p className="text-xs text-slate-500">EMI Amount</p>
        <p className="font-bold">
          ₹{Number(invoiceDetails.emiAmount || 0).toLocaleString('en-IN')}
        </p>
      </div> */}

                    <div>
                      <p className="text-xs text-slate-500">Penal Charges</p>
                      <p className="font-bold text-rose-600">
                        {invoiceDetails.penalCharges}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Service Fee</p>
                      <p className="font-bold">
                        ₹
                        {Number(invoiceDetails.serviceFee || 0).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Disbursement UTR</p>
                      <p className="font-bold">
                        {invoiceDetails.disbursementUtr || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* FILE VIEW */}
                <div className="bg-white border rounded-2xl p-5">
                  <h4 className="font-bold text-slate-800 mb-4">
                    Invoice File
                  </h4>

                  {invoiceDetails.invoiceFilePath ? (
                    (() => {
                      const apiBase =
                        import.meta.env.VITE_API_BASE_URL ||
                        "http://localhost:4000/api";

                      const baseUrl = apiBase.replace("/api", "");

                      const fileUrl = `${baseUrl}/${invoiceDetails.invoiceFilePath.replace(/\\/g, "/")}`;

                      return (
                        <div className="flex items-center justify-between border rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <FiFileText className="text-indigo-600" />
                            <span className="font-medium text-sm">
                              Invoice Document
                            </span>
                          </div>

                          <button
                            onClick={() => window.open(fileUrl, "_blank")}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
                          >
                            View File
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-sm text-slate-400">
                      No invoice file uploaded
                    </p>
                  )}
                </div>

                {/* CLOSE BUTTON */}
                <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[20px] font-bold tracking-wide transition-all active:scale-[0.98] border border-slate-200/50"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsDashboard;
