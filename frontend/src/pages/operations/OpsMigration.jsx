import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiUpload,
} from "react-icons/fi";
import { toast } from "react-toastify";
import DataTable from "../../components/DataTable";
import { operationsService } from "../../services/operationsService";

const migrationUploads = [
  {
    id: "customer",
    label: "Customer Excel",
    fileName: "customer_migration_format.xlsx",
    description: "Customer onboarding, sanction, generated LAN, and bank data.",
  },
  {
    id: "supplier",
    label: "Supplier Excel",
    fileName: "supplier_migration_format.xlsx",
    description: "Supplier onboarding mapped to generated customer LANs.",
  },
  {
    id: "invoice",
    label: "Invoice Excel",
    fileName: "invoice_migration_format.xlsx",
    description: "Bulk invoice migration by generated LAN or old partner LAN.",
  },
];

const migrationResultLabels = {
  customer: "Customer",
  supplier: "Supplier",
  invoice: "Invoice",
};

const emptyInvoiceMigrationForm = {
  lan: "",
  supplierCode: "",
  invoiceNumber: "",
  invoiceDate: "",
  invoiceAmount: "",
  disbursementAmount: "",
  disbursementUtr: "",
  disbursementDate: "",
  invoiceDueDate: "",
  roiPercentage: "",
  penalCharges: "",
  serviceFee: "",
  description: "",
  customerApprovalRemarks: "",
  opsRemarks: "",
};

const getReportFileName = (headers, fallbackName) => {
  const disposition =
    headers?.["content-disposition"] || headers?.["Content-Disposition"] || "";
  const match = disposition.match(
    /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i,
  );
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }
  return fallbackName;
};

const normalizeLan = (value) => String(value || "").trim().toUpperCase();

const OpsMigration = () => {
  const [downloadingTemplate, setDownloadingTemplate] = useState(null);
  const [migrationFiles, setMigrationFiles] = useState({
    customer: null,
    supplier: null,
    invoice: null,
  });
  const [migrationUploading, setMigrationUploading] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [invoiceMigrationForm, setInvoiceMigrationForm] = useState(
    emptyInvoiceMigrationForm,
  );
  const [invoiceMigrationSuppliers, setInvoiceMigrationSuppliers] = useState([]);
  const [
    invoiceMigrationSupplierLoading,
    setInvoiceMigrationSupplierLoading,
  ] = useState(false);
  const [invoiceMigrationSubmitting, setInvoiceMigrationSubmitting] =
    useState(false);

  useEffect(() => {
    const cleanLan = normalizeLan(invoiceMigrationForm.lan);
    if (cleanLan.length < 3) {
      setInvoiceMigrationSuppliers([]);
      setInvoiceMigrationSupplierLoading(false);
      setInvoiceMigrationForm((prev) =>
        prev.supplierCode ? { ...prev, supplierCode: "" } : prev,
      );
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setInvoiceMigrationSupplierLoading(true);
        const response =
          await operationsService.getInvoiceMigrationSuppliers(cleanLan);

        if (!cancelled) {
          const suppliers = response.data || [];
          setInvoiceMigrationSuppliers(suppliers);
          setInvoiceMigrationForm((prev) =>
            suppliers.some(
              (supplier) => supplier.supplierCode === prev.supplierCode,
            )
              ? prev
              : { ...prev, supplierCode: "" },
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Invoice migration supplier lookup failed:", error);
          setInvoiceMigrationSuppliers([]);
          setInvoiceMigrationForm((prev) =>
            prev.supplierCode ? { ...prev, supplierCode: "" } : prev,
          );
        }
      } finally {
        if (!cancelled) {
          setInvoiceMigrationSupplierLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [invoiceMigrationForm.lan]);

  const downloadMigrationTemplate = async (upload) => {
    try {
      setDownloadingTemplate(upload.id);
      const response = await operationsService.downloadMigrationTemplate(
        upload.id,
      );
      const blob = new Blob([response.data], {
        type:
          response.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getReportFileName(response.headers, upload.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${upload.label} format downloaded`);
    } catch (error) {
      console.error("Migration template download failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to download migration format",
      );
    } finally {
      setDownloadingTemplate(null);
    }
  };

  const uploadMigrationExcel = async (upload) => {
    const file = migrationFiles[upload.id];
    if (!file) {
      toast.info(`Select ${upload.label}`);
      return;
    }

    try {
      setMigrationUploading(upload.id);
      let response;
      if (upload.id === "customer") {
        response = await operationsService.uploadCustomerMigration(file);
      } else if (upload.id === "supplier") {
        response = await operationsService.uploadSupplierMigration(file);
      } else if (upload.id === "invoice") {
        response = await operationsService.uploadInvoiceMigration(file);
      } else {
        throw new Error("Unsupported migration upload");
      }

      setMigrationResult({
        type: upload.id,
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

  const setInvoiceMigrationField = (field, value) => {
    setInvoiceMigrationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getOptionalMigrationNumber = (value, label) => {
    const raw = String(value || "").trim();
    if (!raw) return undefined;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${label} must be a valid number`);
    }
    return parsed;
  };

  const uploadSingleInvoiceMigration = async () => {
    const cleanLan = normalizeLan(invoiceMigrationForm.lan);
    const supplierCode = invoiceMigrationForm.supplierCode.trim();
    const invoiceNumber = invoiceMigrationForm.invoiceNumber.trim();
    const disbursementUtr = invoiceMigrationForm.disbursementUtr.trim();

    const requiredFields = [
      [cleanLan, "LAN"],
      [supplierCode, "Supplier"],
      [invoiceNumber, "Invoice Number"],
      [invoiceMigrationForm.invoiceDate, "Invoice Date"],
      [invoiceMigrationForm.invoiceAmount, "Invoice Amount"],
      [invoiceMigrationForm.disbursementAmount, "Disbursement Amount"],
      [disbursementUtr, "Disbursement UTR"],
      [invoiceMigrationForm.disbursementDate, "Disbursement Date"],
    ];
    const missingField = requiredFields.find(
      ([value]) => !String(value || "").trim(),
    );
    if (missingField) {
      toast.info(`${missingField[1]} is required`);
      return;
    }

    const invoiceAmount = Number(invoiceMigrationForm.invoiceAmount);
    const disbursementAmount = Number(invoiceMigrationForm.disbursementAmount);
    if (!Number.isFinite(invoiceAmount) || invoiceAmount <= 0) {
      toast.error("Invoice Amount must be greater than 0");
      return;
    }
    if (!Number.isFinite(disbursementAmount) || disbursementAmount <= 0) {
      toast.error("Disbursement Amount must be greater than 0");
      return;
    }
    if (disbursementAmount > invoiceAmount) {
      toast.error("Disbursement Amount cannot exceed Invoice Amount");
      return;
    }

    let roiPercentage;
    let penalCharges;
    let serviceFee;
    try {
      roiPercentage = getOptionalMigrationNumber(
        invoiceMigrationForm.roiPercentage,
        "ROI Percentage",
      );
      penalCharges = getOptionalMigrationNumber(
        invoiceMigrationForm.penalCharges,
        "Penal Charges",
      );
      serviceFee = getOptionalMigrationNumber(
        invoiceMigrationForm.serviceFee,
        "Service Fee",
      );
    } catch (error) {
      toast.error(error.message);
      return;
    }

    const payload = {
      lan: cleanLan,
      supplierCode,
      invoiceNumber,
      invoiceDate: invoiceMigrationForm.invoiceDate,
      invoiceAmount,
      disbursementAmount,
      disbursementUtr,
      disbursementDate: invoiceMigrationForm.disbursementDate,
      invoiceDueDate: invoiceMigrationForm.invoiceDueDate || undefined,
      roiPercentage,
      penalCharges,
      serviceFee,
      description: invoiceMigrationForm.description.trim() || undefined,
      customerApprovalRemarks:
        invoiceMigrationForm.customerApprovalRemarks.trim() || undefined,
      opsRemarks: invoiceMigrationForm.opsRemarks.trim() || undefined,
    };

    try {
      setInvoiceMigrationSubmitting(true);
      const response = await operationsService.uploadSingleInvoiceMigration(
        payload,
      );

      setMigrationResult({
        type: "invoice",
        ...response,
      });

      if (response.success) {
        toast.success(response.message || "Invoice migration completed");
        setInvoiceMigrationForm((prev) => ({
          ...emptyInvoiceMigrationForm,
          lan: cleanLan,
          supplierCode: prev.supplierCode,
          roiPercentage: prev.roiPercentage,
          penalCharges: prev.penalCharges,
          serviceFee: prev.serviceFee,
        }));
      } else {
        toast.warning(response.message || "Invoice migration completed with issues");
      }
    } catch (error) {
      console.error("Invoice migration failed:", error);
      toast.error(error.message || "Invoice migration failed");
    } finally {
      setInvoiceMigrationSubmitting(false);
    }
  };

  const migrationColumns = [
    { key: "rowNumber", label: "Row" },
    {
      key: "reference",
      label: "Reference",
      render: (value) => value || "N/A",
    },
    {
      key: "name",
      label: "Name / LAN",
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
      label: "System",
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
          {value === "SENT" ? "DONE" : value}
        </span>
      ),
    },
    {
      key: "message",
      label: "Message",
      render: (value) => (
        <span className="block max-w-2xl whitespace-normal">
          {value || "-"}
        </span>
      ),
    },
  ];

  const migrationInputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100";
  const migrationLabelClass =
    "mb-1 block text-xs font-semibold uppercase text-slate-500";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-950">Migration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload old data by Excel or add one invoice at a time.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Old Data Migration
              </h2>
              <p className="text-sm text-slate-500">
                Upload customers first, then suppliers. Use invoice Excel for
                bulk migration.
              </p>
            </div>
            {migrationResult?.summary && (
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">Rows</p>
                  <p className="font-bold text-slate-950">
                    {migrationResult.summary.totalRows}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                  <p className="text-xs font-semibold text-emerald-600">
                    Done
                  </p>
                  <p className="font-bold text-emerald-700">
                    {migrationResult.summary.lmsSent}
                  </p>
                </div>
                <div className="rounded-lg bg-rose-50 px-3 py-2">
                  <p className="text-xs font-semibold text-rose-600">Failed</p>
                  <p className="font-bold text-rose-700">
                    {migrationResult.summary.failed}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 xl:grid-cols-3 xl:divide-x xl:divide-y-0">
          {migrationUploads.map((upload) => (
            <div key={upload.id} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-950">{upload.label}</h3>
                  <p className="text-sm text-slate-500">
                    {upload.description}
                  </p>
                </div>
                <FiFileText className="h-5 w-5 text-slate-500" />
              </div>

              <div className="mt-4 flex flex-col gap-3 xl:flex-row">
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(event) =>
                    setMigrationFiles((prev) => ({
                      ...prev,
                      [upload.id]: event.target.files?.[0] || null,
                    }))
                  }
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => downloadMigrationTemplate(upload)}
                    disabled={Boolean(downloadingTemplate)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                  >
                    <FiDownload
                      className={
                        downloadingTemplate === upload.id
                          ? "animate-pulse"
                          : ""
                      }
                    />
                    Format
                  </button>
                  <button
                    type="button"
                    onClick={() => uploadMigrationExcel(upload)}
                    disabled={Boolean(migrationUploading)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
                  >
                    <FiUpload
                      className={
                        migrationUploading === upload.id ? "animate-pulse" : ""
                      }
                    />
                    Upload
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-950">
                Single Invoice Migration
              </h3>
              <p className="text-sm text-slate-500">
                Submit one invoice at a time to preserve same-date disbursement
                order.
              </p>
            </div>
            <FiFileText className="h-5 w-5 text-slate-500" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className={migrationLabelClass}>LAN *</label>
              <input
                type="text"
                value={invoiceMigrationForm.lan}
                onChange={(event) =>
                  setInvoiceMigrationField("lan", event.target.value)
                }
                placeholder="Generated LAN"
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>Supplier *</label>
              <select
                value={invoiceMigrationForm.supplierCode}
                onChange={(event) =>
                  setInvoiceMigrationField("supplierCode", event.target.value)
                }
                disabled={
                  !normalizeLan(invoiceMigrationForm.lan) ||
                  invoiceMigrationSupplierLoading
                }
                className={`${migrationInputClass} disabled:bg-slate-50 disabled:text-slate-400`}
              >
                <option value="">
                  {invoiceMigrationSupplierLoading
                    ? "Loading suppliers..."
                    : normalizeLan(invoiceMigrationForm.lan)
                      ? "Select supplier"
                      : "Enter LAN first"}
                </option>
                {invoiceMigrationSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.supplierCode}>
                    {supplier.supplierName} - {supplier.supplierCode}
                  </option>
                ))}
              </select>
              {normalizeLan(invoiceMigrationForm.lan) &&
                !invoiceMigrationSupplierLoading &&
                invoiceMigrationSuppliers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No completed suppliers found for this LAN.
                  </p>
                )}
            </div>

            <div>
              <label className={migrationLabelClass}>Invoice Number *</label>
              <input
                type="text"
                value={invoiceMigrationForm.invoiceNumber}
                onChange={(event) =>
                  setInvoiceMigrationField("invoiceNumber", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>Invoice Date *</label>
              <input
                type="date"
                value={invoiceMigrationForm.invoiceDate}
                onChange={(event) =>
                  setInvoiceMigrationField("invoiceDate", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>Invoice Amount *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceMigrationForm.invoiceAmount}
                onChange={(event) =>
                  setInvoiceMigrationField("invoiceAmount", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>
                Disbursement Amount *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceMigrationForm.disbursementAmount}
                onChange={(event) =>
                  setInvoiceMigrationField(
                    "disbursementAmount",
                    event.target.value,
                  )
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>Disbursement UTR *</label>
              <input
                type="text"
                value={invoiceMigrationForm.disbursementUtr}
                onChange={(event) =>
                  setInvoiceMigrationField("disbursementUtr", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>
                Disbursement Date *
              </label>
              <input
                type="date"
                value={invoiceMigrationForm.disbursementDate}
                onChange={(event) =>
                  setInvoiceMigrationField(
                    "disbursementDate",
                    event.target.value,
                  )
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>Invoice Due Date</label>
              <input
                type="date"
                value={invoiceMigrationForm.invoiceDueDate}
                onChange={(event) =>
                  setInvoiceMigrationField("invoiceDueDate", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>ROI %</label>
              <input
                type="number"
                step="0.01"
                value={invoiceMigrationForm.roiPercentage}
                onChange={(event) =>
                  setInvoiceMigrationField("roiPercentage", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>Penal Charges %</label>
              <input
                type="number"
                step="0.01"
                value={invoiceMigrationForm.penalCharges}
                onChange={(event) =>
                  setInvoiceMigrationField("penalCharges", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div>
              <label className={migrationLabelClass}>Service Fee %</label>
              <input
                type="number"
                step="0.01"
                value={invoiceMigrationForm.serviceFee}
                onChange={(event) =>
                  setInvoiceMigrationField("serviceFee", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className={migrationLabelClass}>Description</label>
              <textarea
                rows={2}
                value={invoiceMigrationForm.description}
                onChange={(event) =>
                  setInvoiceMigrationField("description", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={migrationLabelClass}>
                Customer Approval Remarks
              </label>
              <input
                type="text"
                value={invoiceMigrationForm.customerApprovalRemarks}
                onChange={(event) =>
                  setInvoiceMigrationField(
                    "customerApprovalRemarks",
                    event.target.value,
                  )
                }
                className={migrationInputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={migrationLabelClass}>Ops Remarks</label>
              <input
                type="text"
                value={invoiceMigrationForm.opsRemarks}
                onChange={(event) =>
                  setInvoiceMigrationField("opsRemarks", event.target.value)
                }
                className={migrationInputClass}
              />
            </div>

            <div className="flex justify-end md:col-span-2 xl:col-span-4">
              <button
                type="button"
                onClick={uploadSingleInvoiceMigration}
                disabled={invoiceMigrationSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
              >
                <FiUpload
                  className={
                    invoiceMigrationSubmitting ? "animate-pulse" : ""
                  }
                />
                {invoiceMigrationSubmitting ? "Uploading..." : "Upload Invoice"}
              </button>
            </div>
          </div>
        </div>

        {migrationResult?.results?.length > 0 && (
          <div className="border-t border-slate-100">
            <div className="px-5 py-4">
              <h3 className="text-base font-bold text-slate-950">
                {migrationResultLabels[migrationResult.type] || "Migration"}{" "}
                Upload Result
              </h3>
            </div>
            <DataTable data={migrationResult.results} columns={migrationColumns} />
          </div>
        )}
      </section>
    </div>
  );
};

export default OpsMigration;
