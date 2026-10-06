import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value) || 0)

/**
 * Footer for server-paginated tables. `pagination` is the `{ page, limit, total, totalPages }`
 * object returned by the API.
 */
const TablePagination = ({ pagination, pageSizes = [10, 25, 50], onPageChange, onPageSizeChange, disabled = false }) => {
  const page = pagination?.page || 1
  const limit = pagination?.limit || pageSizes[0]
  const total = pagination?.total || 0
  const totalPages = Math.max(1, pagination?.totalPages || 1)
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <>
            <span>Rows</span>
            <select
              value={limit}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              disabled={disabled}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </>
        )}
        <span className="text-slate-400">
          {formatNumber(start)}–{formatNumber(end)} of {formatNumber(total)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <FiChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-3 tabular-nums">
          Page {formatNumber(page)} of {formatNumber(totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <FiChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default TablePagination
