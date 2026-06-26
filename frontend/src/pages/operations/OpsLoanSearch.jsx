import { useMemo, useState } from 'react'
import { FiCreditCard, FiDollarSign, FiDownload, FiFileText, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { toast } from 'react-toastify'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { loanServicingService } from '../../services/loanServicingService'
import { formatCurrency, formatDate } from '../../utils/format'

const scfReportExports = [
  { id: 'fifteenDay', label: '15D Report', fileName: 'SCF_15D_Report.xlsx' },
  { id: 'asOfNow', label: 'As of Now', fileName: 'SCF_As_of_Now_Format.xlsx' },
  { id: 'collections', label: 'Collection Format', fileName: 'SCF_Collection_Format.xlsx' },
  { id: 'soa', label: 'SOA', fileName: 'SCF_SOA.xlsx' },
]

const Metric = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <Icon className="h-5 w-5 text-slate-500" />
    </div>
    <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
  </div>
)

const getReportFileName = (headers, fallbackName) => {
  const disposition = headers?.['content-disposition'] || headers?.['Content-Disposition'] || ''
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
  if (match?.[1]) {
    return decodeURIComponent(match[1])
  }
  return fallbackName
}

const OpsLoanSearch = () => {
  const [filters, setFilters] = useState({ startDate: '', endDate: '' })
  const [lan, setLan] = useState('')
  const [account, setAccount] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [statement, setStatement] = useState([])
  const [loading, setLoading] = useState(false)
  const [downloadingReport, setDownloadingReport] = useState(null)

  const snapshot = account?.snapshot

  const demandTotals = useMemo(() => {
    return schedule.reduce(
      (totals, row) => ({
        due: totals.due + Number(row.totalDue || 0),
        paid: totals.paid + Number(row.totalPaid || 0),
        outstanding: totals.outstanding + Number(row.outstandingAmount || 0),
      }),
      { due: 0, paid: 0, outstanding: 0 },
    )
  }, [schedule])

  const loadLan = async () => {
    const cleanLan = lan.trim().toUpperCase()
    if (!cleanLan) {
      toast.info('Enter a LAN')
      return
    }

    try {
      setLoading(true)
      const [accountRes, scheduleRes, statementRes] = await Promise.all([
        loanServicingService.getAccount(cleanLan),
        loanServicingService.getSchedule(cleanLan),
        loanServicingService.getStatement(cleanLan, filters),
      ])
      setLan(cleanLan)
      setAccount(accountRes.data)
      setSchedule(scheduleRes.data || [])
      setStatement(statementRes.data || [])
    } catch (error) {
      console.error('Loan detail search failed:', error)
      toast.error(error.response?.data?.message || 'Failed to load loan details')
    } finally {
      setLoading(false)
    }
  }

  const downloadScfReport = async (report) => {
    const cleanLan = lan.trim().toUpperCase()
    if (!cleanLan) {
      toast.info('Enter a LAN')
      return
    }

    try {
      setDownloadingReport(report.id)
      const response = await loanServicingService.downloadScfReport(report.id, { ...filters, lan: cleanLan })
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getReportFileName(response.headers, `${cleanLan}_${report.fileName}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${report.label} generated`)
    } catch (error) {
      console.error('SCF report download failed:', error)
      toast.error(error.response?.data?.message || 'Failed to generate SCF report')
    } finally {
      setDownloadingReport(null)
    }
  }

  const scheduleColumns = [
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'dueDate', label: 'Due Date', render: (value) => formatDate(value) },
    { key: 'principalDue', label: 'Principal', render: (value) => formatCurrency(value) },
    { key: 'interestDue', label: 'Interest', render: (value) => formatCurrency(value) },
    { key: 'penalDue', label: 'Penal', render: (value) => formatCurrency(value) },
    { key: 'totalDue', label: 'Total Due', render: (value) => formatCurrency(value) },
    { key: 'totalPaid', label: 'Paid', render: (value) => formatCurrency(value) },
    { key: 'outstandingAmount', label: 'Outstanding', render: (value) => formatCurrency(value) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={value} /> },
  ]

  const statementColumns = [
    { key: 'lan', label: 'LAN' },
    { key: 'product', label: 'Product' },
    { key: 'invoiceId', label: 'Invoice ID' },
    { key: 'transactionDate', label: 'Transaction Date', render: (value) => formatDate(value) },
    { key: 'remarks', label: 'Remarks' },
    { key: 'debit', label: 'Debit', render: (value) => formatCurrency(value) },
    { key: 'credit', label: 'Credit', render: (value) => formatCurrency(value) },
    { key: 'closingBalance', label: 'Closing Balance', render: (value) => formatCurrency(value) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Customer Loan Search</h1>
          <p className="mt-1 text-sm text-slate-500">Search any customer LAN, view loan details, and generate SCF reports.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">From</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">To</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={loadLan}
            disabled={loading || !lan.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
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
              if (event.key === 'Enter') loadLan()
            }}
            placeholder="Enter LAN to search customer loan details"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
              <FiDownload className={downloadingReport === report.id ? 'animate-pulse' : ''} />
              {report.label}
            </button>
          ))}
        </div>
      </section>

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {!loading && snapshot && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric label="Sanctioned" value={formatCurrency(snapshot.sanctionedAmount)} icon={FiDollarSign} />
          <Metric label="Outstanding" value={formatCurrency(snapshot.totalOutstanding)} icon={FiFileText} />
          <Metric label="Overdue" value={formatCurrency(snapshot.overdueAmount)} icon={FiFileText} />
          <Metric label="DPD" value={snapshot.dpd || 0} icon={FiCreditCard} />
        </div>
      )}

      {!loading && account && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Demand Schedule</h2>
            <p className="text-sm text-slate-500">
              Due {formatCurrency(demandTotals.due)}, paid {formatCurrency(demandTotals.paid)}, outstanding {formatCurrency(demandTotals.outstanding)}
            </p>
          </div>
          <DataTable data={schedule} columns={scheduleColumns} />
        </section>
      )}

      {!loading && account && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Ledger Statement</h2>
          </div>
          <DataTable data={statement} columns={statementColumns} />
        </section>
      )}
    </div>
  )
}

export default OpsLoanSearch
