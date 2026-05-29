import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowService } from '../../services/workflowService'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/format'
import axios from "axios";
import { FiX, FiFileText } from "react-icons/fi";

const ManagementDashboard = () => {
  const navigate = useNavigate()

  const [dashboardData, setDashboardData] = useState({
    pending: [],
    handled: [],
  })

  const [isLoading, setIsLoading] = useState(true)


  const [showViewModal, setShowViewModal] = useState(false);
const [invoiceDetails, setInvoiceDetails] = useState(null);
const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    const loadCases = async () => {
      try {
        setIsLoading(true)

        const response =
          await workflowService.getExecutiveDashboard()

        setDashboardData(
          response.data?.data || {
            pending: [],
            handled: [],
          },
        )
      } catch (error) {
        console.error(
          'Error loading executive cases:',
          error,
        )

        setDashboardData({
          pending: [],
          handled: [],
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadCases()
  }, [])

  /// CUSTOMER ONBOARDING
  const customerPending = (
    dashboardData.pending || []
  ).filter(
    (item) =>
      item.workflowType ===
      'CUSTOMER_ONBOARDING',
  )

  const customerHandled = (
    dashboardData.handled || []
  ).filter(
    (item) =>
      item.workflowType ===
      'CUSTOMER_ONBOARDING',
  )

  /// INVOICE DISCOUNTING
  const invoiceHandled = (
    dashboardData.handled || []
  ).filter(
    (item) =>
      item.workflowType ===
      'INVOICE_DISCOUNTING',
  )

  const columns = [
    {
      key: 'customerName',
      label: 'Customer Name',

      render: (_, row) =>
        row?.customer?.name?.trim() ||
        row?.customer?.companyName?.trim() ||
        'N/A',
    },

    {
      key: 'customerCode',
      label: 'Customer Code',

      render: (_, row) =>
        row.customer?.customerCode || 'N/A',
    },

    {
      key: 'currentStatus',
      label: 'Stage',

      render: (value) => (
        <StatusBadge
          status={value}
          label={value
            .replace(/_/g, ' ')
            .toUpperCase()}
        />
      ),
    },

    {
      key: 'updatedAt',
      label: 'Last Updated',

      render: (value) => formatDate(value),
    },
  ]

const handleRowClick = async (row) => {
  try {
    if (row.workflowType === "INVOICE_DISCOUNTING") {
      setLoadingInvoice(true);

      const token = localStorage.getItem("scf_token");

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/workflows/invoices/${row.invoiceId}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setInvoiceDetails(response.data.data);
        setShowViewModal(true);
      }

      setLoadingInvoice(false);
      return;
    }

    navigate(`/management/approval/${row.customerId}`);
  } catch (error) {
    console.error("Error fetching invoice details:", error);
    setLoadingInvoice(false);
  }
};
  // const totalCases =
  //   customerPending.length +
  //   customerHandled.length

  // const completionRate =
  //   totalCases > 0
  //     ? Math.round(
  //         (customerHandled.length /
  //           totalCases) *
  //           100,
  //       )
  //     : 0



      /// REJECTED CASES
const allCases = [
  ...(dashboardData.pending || []),
  ...(dashboardData.handled || []),
];

const rejectedCustomerCases = allCases.filter(
  (item) =>
    item.workflowType === "CUSTOMER_ONBOARDING" &&
    item.isRejected === true
);

const rejectedInvoiceCases = allCases.filter(
  (item) =>
    item.workflowType === "INVOICE_DISCOUNTING" &&
    item.isRejected === true
);

/// TOTAL CASES
const totalCases =
  customerPending.length +
  customerHandled.length +
  invoiceHandled.length

/// COMPLETION %
const completionRate =
  totalCases > 0
    ? Math.round(
        (customerHandled.length / totalCases) *
          100,
      )
    : 0


  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Management Dashboard
        </h1>

        <p className="text-gray-600 mt-2">
          Review and manage customer onboarding
          & invoice discounting cases
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
  {/* PENDING */}
  <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-l-4 border-yellow-500">
    <p className="text-sm text-gray-600 font-medium">
      Pending Approvals
    </p>

    <p className="text-4xl font-bold text-yellow-600 mt-2">
      {customerPending.length}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      Awaiting your review
    </p>
  </div>

  {/* CUSTOMER COMPLETED */}
  <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-500">
    <p className="text-sm text-gray-600 font-medium">
      Customer onboarding handled
    </p>

    <p className="text-4xl font-bold text-green-600 mt-2">
      {customerHandled.length}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      Customer Cases 
    </p>
  </div>

  {/* INVOICE CASES */}
  <div className="card bg-gradient-to-br from-indigo-50 to-blue-50 border-l-4 border-indigo-500">
    <p className="text-sm text-gray-600 font-medium">
      Invoice Cases
    </p>

    <p className="text-4xl font-bold text-indigo-600 mt-2">
      {invoiceHandled.length}
    </p>

    <p className="text-xs text-gray-500 mt-1">
      Invoice discounting handled
    </p>
  </div>

  {/* REJECTED CASES */}
{/* REJECTED CUSTOMER CASES */}
<div className="card bg-gradient-to-br from-red-50 to-rose-50 border-l-4 border-red-500">
  <p className="text-sm text-gray-600 font-medium">
    Rejected Customers
  </p>

  <p className="text-4xl font-bold text-red-600 mt-2">
    {rejectedCustomerCases.length}
  </p>

  <p className="text-xs text-gray-500 mt-1">
    Customer onboarding rejected
  </p>
</div>

{/* REJECTED INVOICE CASES */}
<div className="card bg-gradient-to-br from-pink-50 to-red-50 border-l-4 border-pink-500">
  <p className="text-sm text-gray-600 font-medium">
    Rejected Invoices
  </p>

  <p className="text-4xl font-bold text-pink-600 mt-2">
    {rejectedInvoiceCases.length}
  </p>

  <p className="text-xs text-gray-500 mt-1">
    Invoice discounting rejected
  </p>
</div>

  {/* TOTAL */}


  {/* COMPLETION RATE */}
 
</div>

      {/* PENDING CUSTOMER CASES */}
      <div className="card border-t-4 border-yellow-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-yellow-600">
            Pending Customer Cases
          </h2>

          <div className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-semibold">
            {customerPending.length} Pending
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : customerPending.length > 0 ? (
          <DataTable
            data={customerPending}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No pending customer cases</p>
          </div>
        )}
      </div>

      {/* HANDLED CUSTOMER CASES */}
      <div className="card border-t-4 border-green-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-green-600">
            Handled Customer Cases
          </h2>

          <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
            {customerHandled.length} Completed
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : customerHandled.length > 0 ? (
          <DataTable
            data={customerHandled}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No handled customer cases</p>
          </div>
        )}
      </div>

      {/* INVOICE DISCOUNTING */}
      <div className="card border-t-4 border-indigo-400">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-indigo-600">
            Invoice Discounting Cases
          </h2>

          <div className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
            {invoiceHandled.length} Processed
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : invoiceHandled.length > 0 ? (
          <DataTable
            data={invoiceHandled}
            columns={columns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No invoice discounting cases yet</p>
          </div>
        )}
      </div>
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
  )
}

export default ManagementDashboard