import { useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiUpload,
} from "react-icons/fi";
import { toast } from "react-toastify";
import DataTable from "../../components/DataTable";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import { loanServicingService } from "../../services/loanServicingService";
import { operationsService } from "../../services/operationsService";
import { formatCurrency, formatDate } from "../../utils/format";

const scfReportExports = [
  { id: "fifteenDay", label: "15D Report", fileName: "SCF_15D_Report.xlsx" },
  { id: "asOfNow", label: "As of Now", fileName: "SCF_As_of_Now_Format.xlsx" },
  {
    id: "collections",
    label: "Collection Format",
    fileName: "SCF_Collection_Format.xlsx",
  },
  { id: "soa", label: "SOA", fileName: "SCF_SOA.xlsx" },
];

const migrationUploads = [
  {
    id: "customer",
    label: "Customer Excel",
    fileName: "customer_migration_format.xlsx",
    resultLabel: "Customer",
    description: "Customer onboarding, sanction, generated LAN, and bank data.",
  },
  {
    id: "supplier",
    label: "Supplier Excel",
    fileName: "supplier_migration_format.xlsx",
    resultLabel: "Supplier",
    description: "Supplier onboarding mapped to generated customer LANs.",
  },
  {
    id: "invoice",
    label: "Invoice Excel",
    fileName: "invoice_migration_format.xlsx",
    resultLabel: "Invoice",
    description: "Invoice onboarding and final Ops L2 booking by generated LAN.",
  },
];

const Metric = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <Icon className="h-5 w-5 text-slate-500" />
    </div>
    <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
  </div>
);

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

const OpsLoanSearch = () => {
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });
  const [lan, setLan] = useState("");
  const [account, setAccount] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [statement, setStatement] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(null);
  const [migrationFiles, setMigrationFiles] = useState({
    customer: null,
    supplier: null,
    invoice: null,
  });
  const [migrationUploading, setMigrationUploading] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);

  const snapshot = account?.snapshot;

  const demandTotals = useMemo(() => {
    return schedule.reduce(
      (totals, row) => ({
        due: totals.due + Number(row.totalDue || 0),
        paid: totals.paid + Number(row.totalPaid || 0),
        outstanding: totals.outstanding + Number(row.outstandingAmount || 0),
      }),
      { due: 0, paid: 0, outstanding: 0 },
    );
  }, [schedule]);

  const loadLan = async () => {
    const cleanLan = lan.trim().toUpperCase();
    if (!cleanLan) {
      toast.info("Enter a LAN");
      return;
    }

    try {
      setLoading(true);
      const [accountRes, scheduleRes, statementRes] = await Promise.all([
        loanServicingService.getAccount(cleanLan),
        loanServicingService.getSchedule(cleanLan),
        loanServicingService.getStatement(cleanLan, filters),
      ]);
      setLan(cleanLan);
      setAccount(accountRes.data);
      setSchedule(scheduleRes.data || []);
      setStatement(statementRes.data || []);
    } catch (error) {
      console.error("Loan detail search failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to load loan details",
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadScfReport = async (report) => {
    const cleanLan = lan.trim().toUpperCase();
    if (!cleanLan) {
      toast.info("Enter a LAN");
      return;
    }

    try {
      setDownloadingReport(report.id);
      const response = await loanServicingService.downloadScfReport(report.id, {
        ...filters,
        lan: cleanLan,
      });
      const blob = new Blob([response.data], {
        type:
          response.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getReportFileName(
        response.headers,
        `${cleanLan}_${report.fileName}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${report.label} generated`);
    } catch (error) {
      console.error("SCF report download failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to generate SCF report",
      );
    } finally {
      setDownloadingReport(null);
    }
  };

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
      } else {
        response = await operationsService.uploadInvoiceMigration(file);
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

  const scheduleColumns = [
    { key: "invoiceNumber", label: "Invoice" },
    { key: "dueDate", label: "Due Date", render: (value) => formatDate(value) },
    {
      key: "principalDue",
      label: "Principal",
      render: (value) => formatCurrency(value),
    },
    {
      key: "interestDue",
      label: "Interest",
      render: (value) => formatCurrency(value),
    },
    {
      key: "penalDue",
      label: "Penal",
      render: (value) => formatCurrency(value),
    },
    {
      key: "totalDue",
      label: "Total Due",
      render: (value) => formatCurrency(value),
    },
    {
      key: "totalPaid",
      label: "Paid",
      render: (value) => formatCurrency(value),
    },
    {
      key: "outstandingAmount",
      label: "Outstanding",
      render: (value) => formatCurrency(value),
    },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusBadge status={value} label={value} />,
    },
  ];

  const statementColumns = [
    { key: "lan", label: "LAN" },
    { key: "product", label: "Product" },
    { key: "invoiceId", label: "Invoice ID" },
    {
      key: "transactionDate",
      label: "Transaction Date",
      render: (value) => formatDate(value),
    },
    { key: "remarks", label: "Remarks" },
    { key: "debit", label: "Debit", render: (value) => formatCurrency(value) },
    {
      key: "credit",
      label: "Credit",
      render: (value) => formatCurrency(value),
    },
    {
      key: "closingBalance",
      label: "Closing Balance",
      render: (value) => formatCurrency(value),
    },
  ];

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">
            Customer Loan Search
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Search any customer LAN, view loan details, and generate SCF
            reports.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              From
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  startDate: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              To
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, endDate: event.target.value }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={loadLan}
            disabled={loading || !lan.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            type="text"
            value={lan}
            onChange={(event) => setLan(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadLan();
            }}
            placeholder="Enter LAN to search customer loan details"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          <button
            type="button"
            onClick={loadLan}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            <FiSearch />
            Search
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {scfReportExports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => downloadScfReport(report)}
              disabled={Boolean(downloadingReport) || !lan.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              <FiDownload
                className={
                  downloadingReport === report.id ? "animate-pulse" : ""
                }
              />
              {report.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Old Data Migration
              </h2>
              <p className="text-sm text-slate-500">
                Upload customers first, then suppliers, then invoices by the generated system LAN.
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

        {migrationResult?.results?.length > 0 && (
          <div className="border-t border-slate-100">
            <div className="px-5 py-4">
              <h3 className="text-base font-bold text-slate-950">
                {migrationUploads.find((upload) => upload.id === migrationResult.type)
                  ?.resultLabel || "Migration"}{" "}
                Upload Result
              </h3>
            </div>
            <DataTable data={migrationResult.results} columns={migrationColumns} />
          </div>
        )}
      </section>

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {!loading && snapshot && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric
            label="Sanctioned"
            value={formatCurrency(snapshot.sanctionedAmount)}
            icon={FiDollarSign}
          />
          <Metric
            label="Outstanding"
            value={formatCurrency(snapshot.totalOutstanding)}
            icon={FiFileText}
          />
          <Metric
            label="Overdue"
            value={formatCurrency(snapshot.overdueAmount)}
            icon={FiFileText}
          />
          <Metric label="DPD" value={snapshot.dpd || 0} icon={FiCreditCard} />
        </div>
      )}

      {!loading && account && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Demand Schedule
            </h2>
            <p className="text-sm text-slate-500">
              Due {formatCurrency(demandTotals.due)}, paid{" "}
              {formatCurrency(demandTotals.paid)}, outstanding{" "}
              {formatCurrency(demandTotals.outstanding)}
            </p>
          </div>
          <DataTable data={schedule} columns={scheduleColumns} />
        </section>
      )}

      {!loading && account && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Ledger Statement
            </h2>
          </div>
          <DataTable data={statement} columns={statementColumns} />
        </section>
      )}
    </div>
  );
};

export default OpsLoanSearch;
