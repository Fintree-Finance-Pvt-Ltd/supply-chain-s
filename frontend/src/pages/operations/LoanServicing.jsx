import { useEffect, useMemo, useState } from 'react'
import { FiRefreshCw, FiSearch, FiCreditCard, FiFileText, FiDollarSign } from 'react-icons/fi'
import { toast } from 'react-toastify'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { loanServicingService } from '../../services/loanServicingService'
import { formatCurrency, formatDate } from '../../utils/format'

const tabs = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'disbursements', label: 'Disbursements' },
  { id: 'collections', label: 'Collections' },
  { id: 'lan', label: 'LAN Workbench' },
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

const LoanServicing = () => {
  const [activeTab, setActiveTab] = useState('portfolio')
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ startDate: '', endDate: '' })
  const [portfolio, setPortfolio] = useState(null)
  const [disbursements, setDisbursements] = useState(null)
  const [collections, setCollections] = useState(null)
  const [lan, setLan] = useState('')
  const [account, setAccount] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [statement, setStatement] = useState([])

  const loadReports = async () => {
    try {
      setLoading(true)
      const [portfolioRes, disbursementRes, collectionRes] = await Promise.all([
        loanServicingService.getPortfolioReport(),
        loanServicingService.getDisbursementReport(filters),
        loanServicingService.getCollectionReport(filters),
      ])
      setPortfolio(portfolioRes.data)
      setDisbursements(disbursementRes.data)
      setCollections(collectionRes.data)
    } catch (error) {
      console.error('Loan servicing report load failed:', error)
      toast.error(error.response?.data?.message || 'Failed to load loan servicing reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const loadLan = async () => {
    if (!lan.trim()) {
      toast.info('Enter a LAN')
      return
    }

    try {
      setLoading(true)
      const [accountRes, scheduleRes, statementRes] = await Promise.all([
        loanServicingService.getAccount(lan.trim()),
        loanServicingService.getSchedule(lan.trim()),
        loanServicingService.getStatement(lan.trim(), filters),
      ])
      setAccount(accountRes.data)
      setSchedule(scheduleRes.data || [])
      setStatement(statementRes.data || [])
    } catch (error) {
      console.error('Loan servicing LAN load failed:', error)
      toast.error(error.response?.data?.message || 'Failed to load LAN')
    } finally {
      setLoading(false)
    }
  }

  const portfolioRows = portfolio?.rows || []
  const disbursementRows = disbursements?.rows || []
  const collectionRows = collections?.rows || []
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

  const portfolioColumns = [
    { key: 'lan', label: 'LAN' },
    { key: 'sanctionedAmount', label: 'Sanctioned', render: (value) => formatCurrency(value) },
    { key: 'totalDisbursed', label: 'Disbursed', render: (value) => formatCurrency(value) },
    { key: 'totalOutstanding', label: 'Outstanding', render: (value) => formatCurrency(value) },
    { key: 'totalCollected', label: 'Collected', render: (value) => formatCurrency(value) },
    { key: 'dpd', label: 'DPD' },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={value} /> },
  ]

  const disbursementColumns = [
    { key: 'lan', label: 'LAN' },
    { key: 'invoiceId', label: 'Invoice ID' },
    { key: 'disbursementDate', label: 'Date', render: (value) => formatDate(value) },
    { key: 'disbursementUtr', label: 'UTR' },
    { key: 'disbursementAmount', label: 'Amount', render: (value) => formatCurrency(value) },
    { key: 'dueDate', label: 'Due Date', render: (value) => formatDate(value) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={value} /> },
  ]

  const collectionColumns = [
    { key: 'lan', label: 'LAN' },
    { key: 'repaymentDate', label: 'Date', render: (value) => formatDate(value) },
    { key: 'utr', label: 'UTR' },
    { key: 'amount', label: 'Amount', render: (value) => formatCurrency(value) },
    { key: 'allocatedAmount', label: 'Allocated', render: (value) => formatCurrency(value) },
    { key: 'unappliedAmount', label: 'Unapplied', render: (value) => formatCurrency(value) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={value} /> },
  ]

  const scheduleColumns = [
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'dueDate', label: 'Due Date', render: (value) => formatDate(value) },
    { key: 'principalDue', label: 'Principal', render: (value) => formatCurrency(value) },
    { key: 'interestDue', label: 'Interest', render: (value) => formatCurrency(value) },
    { key: 'totalDue', label: 'Total Due', render: (value) => formatCurrency(value) },
    { key: 'totalPaid', label: 'Paid', render: (value) => formatCurrency(value) },
    { key: 'outstandingAmount', label: 'Outstanding', render: (value) => formatCurrency(value) },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} label={value} /> },
  ]

  const statementColumns = [
    { key: 'valueDate', label: 'Date', render: (value) => formatDate(value) },
    { key: 'entryType', label: 'Type' },
    { key: 'debit', label: 'Debit', render: (value) => formatCurrency(value) },
    { key: 'credit', label: 'Credit', render: (value) => formatCurrency(value) },
    { key: 'runningBalance', label: 'Balance', render: (value) => formatCurrency(value) },
    { key: 'narration', label: 'Narration' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Loan Servicing</h1>
          <p className="mt-1 text-sm text-slate-500">Loan accounts, demand, collections, allocation, and servicing reports.</p>
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
            onClick={loadReports}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold ${
              activeTab === tab.id
                ? 'border-b-2 border-slate-950 text-slate-950'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {!loading && activeTab === 'portfolio' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Metric label="Accounts" value={portfolio?.accounts || 0} icon={FiCreditCard} />
            <Metric label="Sanctioned" value={formatCurrency(portfolio?.sanctionedAmount || 0)} icon={FiDollarSign} />
            <Metric label="Outstanding" value={formatCurrency(portfolio?.totalOutstanding || 0)} icon={FiFileText} />
            <Metric label="Collected" value={formatCurrency(portfolio?.totalCollected || 0)} icon={FiDollarSign} />
          </div>
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <DataTable data={portfolioRows} columns={portfolioColumns} />
          </section>
        </div>
      )}

      {!loading && activeTab === 'disbursements' && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Disbursement Report</h2>
            <p className="text-sm text-slate-500">{disbursements?.count || 0} records, {formatCurrency(disbursements?.totalAmount || 0)}</p>
          </div>
          <DataTable data={disbursementRows} columns={disbursementColumns} />
        </section>
      )}

      {!loading && activeTab === 'collections' && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Collection Report</h2>
            <p className="text-sm text-slate-500">
              {collections?.count || 0} records, {formatCurrency(collections?.totalAmount || 0)} collected
            </p>
          </div>
          <DataTable data={collectionRows} columns={collectionColumns} />
        </section>
      )}

      {!loading && activeTab === 'lan' && (
        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="text"
                value={lan}
                onChange={(event) => setLan(event.target.value)}
                placeholder="Enter LAN"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={loadLan}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                <FiSearch />
                Search
              </button>
            </div>
          </section>

          {snapshot && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Metric label="Sanctioned" value={formatCurrency(snapshot.sanctionedAmount)} icon={FiDollarSign} />
              <Metric label="Outstanding" value={formatCurrency(snapshot.totalOutstanding)} icon={FiFileText} />
              <Metric label="Overdue" value={formatCurrency(snapshot.overdueAmount)} icon={FiFileText} />
              <Metric label="DPD" value={snapshot.dpd || 0} icon={FiCreditCard} />
            </div>
          )}

          {account && (
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

          {account && (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-lg font-bold text-slate-950">Ledger Statement</h2>
              </div>
              <DataTable data={statement} columns={statementColumns} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default LoanServicing
