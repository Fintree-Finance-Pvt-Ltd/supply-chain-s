import { useEffect, useMemo, useState } from "react";
import {
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import { toast } from "react-toastify";
import DataTable from "../../components/DataTable";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import { loanServicingService } from "../../services/loanServicingService";
import { operationsService } from "../../services/operationsService";
import { formatCurrency, formatDate } from "../../utils/format";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../constants/roles";

const scfReportExports = [
  { id: "soa", label: "SOA", fileName: "SCF_SOA.xlsx" },
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

const getCustomerDisplayName = (customer) =>
  customer?.companyName ||
  customer?.customerName ||
  customer?.customerCode ||
  "Selected customer";

const getLoanAccounts = (customer) =>
  Array.isArray(customer?.loanAccounts) ? customer.loanAccounts : [];

const normalizeLan = (value) => String(value || "").trim().toUpperCase();

const loanAccountMatchesLan = (loanAccount, cleanLan) =>
  [loanAccount?.lanId, loanAccount?.partnerLanId].some(
    (value) => normalizeLan(value) === cleanLan,
  );

const findCustomerByLan = (customers, cleanLan) =>
  (customers || []).find((customer) =>
    getLoanAccounts(customer).some((loanAccount) =>
      loanAccountMatchesLan(loanAccount, cleanLan),
    ),
  ) || null;

const buildCustomerFromAccount = (accountData) => {
  const loanAccount = accountData?.loanAccount;
  const customer = loanAccount?.customer;
  if (!loanAccount?.lanId || !customer) return null;

  return {
    customerId: customer.id || loanAccount.customerId,
    companyName: customer.companyName || null,
    customerName: customer.customerName || customer.name || null,
    customerCode: customer.customerCode || null,
    status: customer.status || null,
    loanAccounts: [
      {
        id: loanAccount.id,
        lanId: loanAccount.lanId,
        partnerLanId: loanAccount.partnerLanId || null,
        lender: loanAccount.lender || null,
        partnerName: loanAccount.partner?.name || null,
        status: loanAccount.status || null,
        sanctionedAmount: loanAccount.sanctionedAmount ?? null,
        disbursedAmount: loanAccount.disbursedAmount ?? null,
      },
    ],
  };
};

const getLanOptionLabel = (loanAccount) =>
  [
    loanAccount.lanId,
    loanAccount.partnerName || loanAccount.lender,
    loanAccount.status,
  ]
    .filter(Boolean)
    .join(" - ");

const OpsLoanSearch = () => {
  const { user } = useAuth();

  const userRoles = useMemo(
    () =>
      [
        ...(user?.roles || []).map((role) => role?.name || role),
        user?.role,
        user?.defaultRole,
      ]
        .filter(Boolean)
        .map((role) => String(role).trim().toLowerCase()),
    [user],
  );

  const isSuperAdmin = userRoles.includes(
    String(ROLES.SUPERADMIN || "superadmin").toLowerCase(),
  );
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });
  const [lan, setLan] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerMatches, setCustomerMatches] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [account, setAccount] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [statement, setStatement] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(null);
  const [deletingCollections, setDeletingCollections] = useState(false);
  const [deletingInvoices, setDeletingInvoices] = useState(false);

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

  useEffect(() => {
    const search = customerSearch.trim();
    if (search.length < 2 || selectedCustomer) {
      setCustomerMatches([]);
      setCustomerSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setCustomerSearchLoading(true);
        const response = await operationsService.searchLoanCustomers({
          companyName: search,
          limit: 8,
        });

        if (!cancelled) {
          setCustomerMatches(response.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Customer loan search failed:", error);
          setCustomerMatches([]);
        }
      } finally {
        if (!cancelled) {
          setCustomerSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerSearch, selectedCustomer]);

  const loadLan = async (targetLan) => {
    const lanToSearch = typeof targetLan === "string" ? targetLan : lan;
    const cleanLan = normalizeLan(lanToSearch);
    if (!cleanLan) {
      toast.info("Enter a LAN");
      return;
    }

    try {
      setLoading(true);
      const customerContextPromise = operationsService
        .searchLoanCustomers({
          q: cleanLan,
          limit: 20,
        })
        .catch((error) => {
          console.error("Customer context lookup failed:", error);
          return { data: [] };
        });

      const [accountRes, scheduleRes, statementRes, customerContextRes] =
        await Promise.all([
          loanServicingService.getAccount(cleanLan),
          loanServicingService.getSchedule(cleanLan),
          loanServicingService.getStatement(cleanLan, filters),
          customerContextPromise,
        ]);
      const accountData = accountRes.data;
      const matchedCustomer =
        findCustomerByLan(customerContextRes.data, cleanLan) ||
        buildCustomerFromAccount(accountData);

      setLan(cleanLan);
      setAccount(accountData);
      setSchedule(scheduleRes.data || []);
      setStatement(statementRes.data || []);
      setSelectedCustomer(matchedCustomer);
      setCustomerSearch(
        matchedCustomer ? getCustomerDisplayName(matchedCustomer) : "",
      );
      setCustomerMatches([]);
    } catch (error) {
      console.error("Loan detail search failed:", error);
      toast.error(
        error.response?.data?.message || "Failed to load loan details",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer) => {
    const loanAccounts = getLoanAccounts(customer);
    setSelectedCustomer(customer);
    setCustomerSearch(getCustomerDisplayName(customer));
    setCustomerMatches([]);

    if (loanAccounts.length === 0) {
      setLan("");
      setAccount(null);
      setSchedule([]);
      setStatement([]);
      toast.info("No LAN found for selected customer");
      return;
    }

    if (loanAccounts.length === 1) {
      setLan(loanAccounts[0].lanId);
      loadLan(loanAccounts[0].lanId);
      return;
    }

    setLan("");
    setAccount(null);
    setSchedule([]);
    setStatement([]);
  };

  const handleSelectedCustomerLanChange = (value) => {
    setLan(value);
    if (value) {
      loadLan(value);
    }
  };

  const downloadScfReport = async (report) => {
    const cleanLan = lan.trim().toUpperCase();
    if (!cleanLan && !isSuperAdmin) {
      toast.info("Enter a LAN");
      return;
    }

    try {
      setDownloadingReport(report.id);
      const today = new Date().toISOString().slice(0, 10);

      const params = cleanLan
        ? {
            ...filters,
            lan: cleanLan,
          }
        : {
            ...filters,
            allCases: true,
            endDate: filters.endDate || today,
          };

      const response = await loanServicingService.downloadScfReport(
        report.id,
        params,
      );

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
        cleanLan
          ? `${cleanLan}_${report.fileName}`
          : `ALL_CASES_${report.fileName}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(
        cleanLan
          ? `${report.label} generated`
          : `${report.label} generated for all cases`,
      );
    } catch (error) {
      console.error("SCF report download failed:", error);
      toast.error(
        error.message ||
          error.response?.data?.message ||
          "Failed to generate SCF report",
      );
    } finally {
      setDownloadingReport(null);
    }
  };

  const deleteCollectionsForLan = async () => {
    const cleanLan = lan.trim().toUpperCase();
    if (!cleanLan) {
      toast.info("Enter a LAN");
      return;
    }

    const confirmed = window.confirm(
      `Delete all collections for LAN ${cleanLan}? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setDeletingCollections(true);
      const response = await loanServicingService.deleteCollectionsByLan(
        cleanLan,
      );
      toast.success(response.message || "Collections deleted");
      await loadLan(cleanLan);
    } catch (error) {
      console.error("Collection delete failed:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete collections",
      );
    } finally {
      setDeletingCollections(false);
    }
  };

  const deleteInvoicesForLan = async () => {
    const cleanLan = lan.trim().toUpperCase();
    if (!cleanLan) {
      toast.info("Enter a LAN");
      return;
    }

    const customerName = selectedCustomer
      ? getCustomerDisplayName(selectedCustomer)
      : "this customer";
    const confirmed = window.confirm(
      `Delete all invoices for ${customerName} on LAN ${cleanLan}? Delete collections first if this LAN has payments. This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setDeletingInvoices(true);
      const response = await loanServicingService.deleteInvoicesByLan(cleanLan);
      toast.success(response.message || "Invoices deleted");
      await loadLan(cleanLan);
    } catch (error) {
      console.error("Invoice delete failed:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete invoices",
      );
    } finally {
      setDeletingInvoices(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">
            Customer Loan Search
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Search by company name or customer LAN, view loan details, and
            generate SOA.
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
                setFilters((prev) => ({
                  ...prev,
                  endDate: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => loadLan()}
            disabled={loading || !lan.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Company
            </label>
            <input
              type="text"
              value={customerSearch}
              onChange={(event) => {
                setCustomerSearch(event.target.value);
                setSelectedCustomer(null);
              }}
              placeholder="Search company name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            {customerSearch.trim().length >= 2 && !selectedCustomer && (
              <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {customerSearchLoading ? (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    Searching...
                  </div>
                ) : customerMatches.length > 0 ? (
                  customerMatches.map((customer) => {
                    const loanAccounts = getLoanAccounts(customer);
                    return (
                      <button
                        key={customer.customerId}
                        type="button"
                        onClick={() => handleCustomerSelect(customer)}
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="block text-sm font-semibold text-slate-900">
                          {getCustomerDisplayName(customer)}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {customer.customerCode ||
                            `Customer #${customer.customerId}`}{" "}
                          - {loanAccounts.length} LAN
                          {loanAccounts.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    No matching customers
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Customer LAN
            </label>
            <select
              value={selectedCustomer ? lan : ""}
              onChange={(event) =>
                handleSelectedCustomerLanChange(event.target.value)
              }
              disabled={!selectedCustomer || loading}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {selectedCustomer ? "Select LAN" : "Select customer"}
              </option>
              {getLoanAccounts(selectedCustomer).map((loanAccount) => (
                <option key={loanAccount.id} value={loanAccount.lanId}>
                  {getLanOptionLabel(loanAccount)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
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
            onClick={() => loadLan()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            <FiSearch />
            Search
          </button>
        </div>

        {selectedCustomer && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Company Name
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {getCustomerDisplayName(selectedCustomer)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedCustomer.customerCode ||
                `Customer #${selectedCustomer.customerId}`}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {scfReportExports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => downloadScfReport(report)}
                disabled={
                  Boolean(downloadingReport) ||
                  (!isSuperAdmin && !lan.trim())
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              >
                <FiDownload
                  className={
                    downloadingReport === report.id ? "animate-pulse" : ""
                  }
                />
                {isSuperAdmin && !lan.trim()
                  ? `${report.label} - All Cases`
                  : report.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            <button
              type="button"
              onClick={deleteCollectionsForLan}
              disabled={deletingCollections || loading || !lan.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              <FiTrash2
                className={deletingCollections ? "animate-pulse" : ""}
              />
              {deletingCollections ? "Deleting..." : "Delete Collections"}
            </button>

            <button
              type="button"
              onClick={deleteInvoicesForLan}
              disabled={deletingInvoices || loading || !lan.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <FiTrash2 className={deletingInvoices ? "animate-pulse" : ""} />
              {deletingInvoices ? "Deleting..." : "Delete Invoices"}
            </button>
          </div>
        </div>
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
