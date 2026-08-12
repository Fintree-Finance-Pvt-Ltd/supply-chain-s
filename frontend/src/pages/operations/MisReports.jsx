import { useState } from "react";
import {
  FiCalendar,
  FiDownload,
  FiFileText,
  FiRefreshCw,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { loanServicingService } from "../../services/loanServicingService";

const misReportExports = [
  {
    id: "fifteenDay",
    label: "15D Report",
    fileName: "All_Customers_SCF_15D_Report.xlsx",
    description: "Outstanding invoices due in the next 15 days across the portfolio.",
    dateBasis: "Due date",
  },
  {
    id: "asOfNow",
    label: "As of Now",
    fileName: "All_Customers_SCF_As_of_Now_Format.xlsx",
    description: "Current outstanding position across every customer LAN.",
    dateBasis: "As-of date",
  },
  {
    id: "collections",
    label: "Collection Format",
    fileName: "All_Customers_SCF_Collection_Format.xlsx",
    description: "Collection allocation format for all posted repayments.",
    dateBasis: "Collection date",
  },
];

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

const MisReports = () => {
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    asOfDate: "",
  });
  const [downloadingReport, setDownloadingReport] = useState(null);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ startDate: "", endDate: "", asOfDate: "" });
  };

  const downloadMisReport = async (report) => {
    if (
      filters.startDate &&
      filters.endDate &&
      new Date(filters.startDate) > new Date(filters.endDate)
    ) {
      toast.error("From date cannot be after To date");
      return;
    }

    try {
      setDownloadingReport(report.id);
      const response = await loanServicingService.downloadScfReport(report.id, filters);
      const blob = new Blob([response.data], {
        type:
          response.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getReportFileName(response.headers, report.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${report.label} generated`);
    } catch (error) {
      console.error("MIS report download failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to generate MIS report",
      );
    } finally {
      setDownloadingReport(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">MIS Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Portfolio-wide SCF exports for all customers.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Report Filters</h2>
            <p className="text-sm text-slate-500">
              Leave dates blank to use each report default.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(150px,180px))_auto]">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                As Of
              </label>
              <input
                type="date"
                value={filters.asOfDate}
                onChange={(event) => updateFilter("asOfDate", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                From
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(event) => updateFilter("startDate", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                To
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(event) => updateFilter("endDate", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:self-end"
            >
              <FiRefreshCw />
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {misReportExports.map((report) => (
          <article
            key={report.id}
            className="flex min-h-[220px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    {report.label}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {report.description}
                  </p>
                </div>
                <FiFileText className="h-6 w-6 flex-none text-slate-500" />
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                <FiCalendar />
                {report.dateBasis}
              </div>
            </div>

            <button
              type="button"
              onClick={() => downloadMisReport(report)}
              disabled={Boolean(downloadingReport)}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <FiDownload
                className={downloadingReport === report.id ? "animate-pulse" : ""}
              />
              {downloadingReport === report.id ? "Generating" : "Download"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
};

export default MisReports;
