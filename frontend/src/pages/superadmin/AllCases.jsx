import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { performanceService } from '../../services/performanceService';
import { CASE_STATUS, CASE_STATUS_LABELS } from '../../constants/caseStatus';
import {
  MdFilterList,
  MdWarning,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
} from 'react-icons/md';

// Stage options
const STAGE_OPTIONS = [
  { value: '', label: 'All Stages' },
  { value: 'credit_l1', label: 'Credit L1' },
  { value: 'credit_l2', label: 'Credit L2' },
  { value: 'ps_l1', label: 'PS L1' },
  { value: 'ps_l2', label: 'PS L2' },
  { value: 'ready_for_ops', label: 'Ready for Ops' },
  { value: 'ops_l1', label: 'Operations L1' },
  { value: 'ops_l2', label: 'Operations L2' },
  { value: 'ops_head', label: 'Operations Head' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'rm', label: 'RM' },
];

// Status options
const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: CASE_STATUS.DRAFT, label: CASE_STATUS_LABELS[CASE_STATUS.DRAFT] },
  { value: CASE_STATUS.SUBMITTED, label: CASE_STATUS_LABELS[CASE_STATUS.SUBMITTED] },
  { value: CASE_STATUS.CREDIT_L1_APPROVED, label: CASE_STATUS_LABELS[CASE_STATUS.CREDIT_L1_APPROVED] },
  { value: CASE_STATUS.CREDIT_L2_APPROVED, label: CASE_STATUS_LABELS[CASE_STATUS.CREDIT_L2_APPROVED] },
  { value: CASE_STATUS.CEO_APPROVED, label: CASE_STATUS_LABELS[CASE_STATUS.CEO_APPROVED] },
  { value: CASE_STATUS.MD_PENDING_TERMS, label: CASE_STATUS_LABELS[CASE_STATUS.MD_PENDING_TERMS] },
  { value: CASE_STATUS.MD_TERMS_SUBMITTED, label: CASE_STATUS_LABELS[CASE_STATUS.MD_TERMS_SUBMITTED] },
  { value: CASE_STATUS.MD_APPROVED, label: CASE_STATUS_LABELS[CASE_STATUS.MD_APPROVED] },
  { value: CASE_STATUS.OPS_L1_REVIEW, label: CASE_STATUS_LABELS[CASE_STATUS.OPS_L1_REVIEW] },
  { value: CASE_STATUS.OPS_L1_APPROVED, label: CASE_STATUS_LABELS[CASE_STATUS.OPS_L1_APPROVED] },
  { value: CASE_STATUS.OPS_HEAD_APPROVED, label: CASE_STATUS_LABELS[CASE_STATUS.OPS_HEAD_APPROVED] },
  { value: CASE_STATUS.COMPLETED, label: CASE_STATUS_LABELS[CASE_STATUS.COMPLETED] },
  { value: CASE_STATUS.DISBURSED, label: CASE_STATUS_LABELS[CASE_STATUS.DISBURSED] },
  { value: CASE_STATUS.REJECTED, label: CASE_STATUS_LABELS[CASE_STATUS.REJECTED] },
  { value: CASE_STATUS.RETURNED_TO_RM, label: CASE_STATUS_LABELS[CASE_STATUS.RETURNED_TO_RM] },
];

const DEFAULT_FILTERS = {
  companyName: '',
  caseType: '',
  status: '',
  stage: '',
  userId: '',
  rmId: '',
  startDate: '',
  endDate: '',
  showSanctions: false,
  sortBy: 'newest',
  sortOrder: 'DESC',
  viewAll: false,
  limit: 10,
  page: 1,
};

const STAGE_LABELS = Object.fromEntries(STAGE_OPTIONS.map((option) => [option.value, option.label]));

const STATUS_BADGE_CLASSES = {
  [CASE_STATUS.DRAFT]: 'bg-gray-100 text-gray-800',
  [CASE_STATUS.SUBMITTED]: 'bg-blue-100 text-blue-800',
  [CASE_STATUS.CREDIT_L1_APPROVED]: 'bg-indigo-100 text-indigo-800',
  [CASE_STATUS.CREDIT_L2_APPROVED]: 'bg-indigo-100 text-indigo-800',
  [CASE_STATUS.CEO_APPROVED]: 'bg-purple-100 text-purple-800',
  [CASE_STATUS.MD_PENDING_TERMS]: 'bg-orange-100 text-orange-800',
  [CASE_STATUS.MD_TERMS_SUBMITTED]: 'bg-blue-100 text-blue-800',
  [CASE_STATUS.MD_APPROVED]: 'bg-green-100 text-green-800',
  [CASE_STATUS.OPS_L1_REVIEW]: 'bg-orange-100 text-orange-800',
  [CASE_STATUS.OPS_L1_APPROVED]: 'bg-teal-100 text-teal-800',
  [CASE_STATUS.OPS_L2_VERIFIED]: 'bg-teal-100 text-teal-800',
  [CASE_STATUS.OPS_HEAD_APPROVED]: 'bg-teal-100 text-teal-800',
  [CASE_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [CASE_STATUS.DISBURSED]: 'bg-purple-100 text-purple-800',
  [CASE_STATUS.REJECTED]: 'bg-red-100 text-red-800',
  [CASE_STATUS.RETURNED_TO_RM]: 'bg-orange-100 text-orange-800',
};

// Format time in minutes to readable format
const formatTime = (minutes) => {
  if (!minutes) return '-';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

const toNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    notation: toNumber(value) >= 10000000 ? 'compact' : 'standard',
  }).format(toNumber(value));

const formatPartnerNames = (partnerNames) => {
  if (Array.isArray(partnerNames) && partnerNames.length > 0) {
    return partnerNames.join(', ');
  }

  if (typeof partnerNames === 'string' && partnerNames.trim()) {
    return partnerNames;
  }

  return 'No partner linked';
};

const formatLabel = (value) => {
  if (!value) return 'N/A';
  return CASE_STATUS_LABELS[value] || value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getCaseCustomerId = (caseItem) => {
  if (caseItem.customerId) return caseItem.customerId;

  const taskId = String(caseItem.taskId || '');
  return /^\d+$/.test(taskId) ? Number(taskId) : null;
};

const AllCases = () => {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [users, setUsers] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [companySuggestionsLoading, setCompanySuggestionsLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);

  // Filters
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // Load initial data
  useEffect(() => {
    loadUsers();
  }, []);

  // Load cases when filters change
  useEffect(() => {
    loadCases();
  }, [filters]);

  useEffect(() => {
    if (!showFilterModal) return undefined;

    const search = draftFilters.companyName.trim();
    if (!search) {
      setCompanySuggestions([]);
      setCompanySuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCompanySuggestionsLoading(true);
      try {
        const suggestions = await performanceService.getCompanySuggestions({
          companyName: search,
          limit: 8,
        });

        if (!cancelled) {
          setCompanySuggestions(suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load company suggestions:', error);
          setCompanySuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setCompanySuggestionsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draftFilters.companyName, showFilterModal]);

  const loadUsers = async () => {
    try {
      const data = await performanceService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const params = {
        companyName: filters.companyName?.trim() || undefined,
        caseType: filters.caseType || undefined,
        status: filters.status || undefined,
        stage: filters.stage || undefined,
        userId: filters.userId ? parseInt(filters.userId) : undefined,
        rmId: filters.rmId ? parseInt(filters.rmId) : undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        includeSanctions: filters.showSanctions ? true : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortBy === 'alphabetical' || filters.sortBy === 'oldest' ? 'ASC' : filters.sortOrder,
        viewAll: filters.viewAll || undefined,
        limit: filters.viewAll ? 'all' : filters.limit,
        page: filters.page,
      };
      const data = await performanceService.getAllCases(params);
      setCases(data.cases);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const openFilterModal = () => {
    setDraftFilters(filters);
    setShowFilterModal(true);
  };

  const handleDraftFilterChange = (key, value) => {
    setDraftFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1,
      ...(key === 'viewAll' && value ? { limit: 'all' } : {}),
      ...(key === 'viewAll' && !value ? { limit: 10 } : {}),
    }));
  };

  const applyFilters = () => {
    setFilters({ ...draftFilters, page: 1 });
    setShowFilterModal(false);
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setShowFilterModal(false);
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleOpenCase = (caseItem) => {
    const customerId = getCaseCustomerId(caseItem);
    if (!customerId) return;

    navigate(`/credit/case/${customerId}?readOnly=true&from=superadmin`);
  };

  const handleCompanySuggestionSelect = (suggestion) => {
    handleDraftFilterChange('companyName', suggestion.companyName);
    setCompanySuggestions([]);
  };

  const activeFilterCount = [
    filters.companyName,
    filters.caseType,
    filters.status,
    filters.stage,
    filters.userId,
    filters.rmId,
    filters.startDate,
    filters.endDate,
    filters.showSanctions ? 'showSanctions' : '',
    filters.sortBy !== DEFAULT_FILTERS.sortBy ? filters.sortBy : '',
    filters.viewAll ? 'viewAll' : '',
  ].filter(Boolean).length;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Cases</h1>
          <p className="text-gray-600 mt-1">Track and view all cases across all users</p>
        </div>
        <button
          type="button"
          onClick={openFilterModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <MdFilterList className="text-xl" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">All Cases</h3>
            <p className="text-sm text-gray-500 mt-1">
              {total} cases found{filters.viewAll ? ' - viewing all' : ''}
            </p>
          </div>
          {/* Status Summary */}
          <div className="flex gap-3 text-sm">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
              Draft: {cases.filter(c => c.status === CASE_STATUS.DRAFT).length}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Active: {cases.filter(c => ![CASE_STATUS.DRAFT, CASE_STATUS.COMPLETED, CASE_STATUS.DISBURSED, CASE_STATUS.REJECTED].includes(c.status)).length}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Completed: {cases.filter(c => [CASE_STATUS.COMPLETED, CASE_STATUS.DISBURSED].includes(c.status)).length}
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              Rejected: {cases.filter(c => c.status === CASE_STATUS.REJECTED).length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading cases...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center">
            <MdWarning className="text-4xl text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No cases found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${filters.showSanctions ? 'min-w-[1400px]' : 'min-w-[1180px]'}`}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Case ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Case Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RM</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aadhaar</th>
                  {filters.showSanctions && (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sanctions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated Limit</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lifecycle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cases.map((c) => {
                  const canOpenCase = Boolean(getCaseCustomerId(c));

                  return (
                  <tr
                    key={`${c.taskType || 'case'}-${c.id}-${c.taskId}`}
                    onClick={() => canOpenCase && handleOpenCase(c)}
                    className={`${canOpenCase ? 'cursor-pointer' : ''} hover:bg-gray-50`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenCase(c);
                        }}
                        disabled={!canOpenCase}
                        className="font-medium text-blue-700 hover:text-blue-900 hover:underline disabled:cursor-not-allowed disabled:text-gray-500 disabled:no-underline"
                      >
                        {c.taskId}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{c.companyName || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        String(c.caseType || '').toUpperCase() === 'STERLION'
                          ? 'bg-violet-100 text-violet-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.caseType || 'FINTREE'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{c.rmName || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{c.rmId ? `RM ID: ${c.rmId}` : ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.applicantAadhaar || 'N/A'}
                    </td>
                    {filters.showSanctions && (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold ${
                              toNumber(c.sanctionCount) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {toNumber(c.sanctionCount)}
                            </span>
                            <div className="min-w-0">
                              <p className="max-w-[180px] truncate text-sm font-medium text-gray-900">
                                {formatPartnerNames(c.partnerNames)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {toNumber(c.sanctionCount) > 0 ? 'Loan accounts allocated' : 'No sanctions created'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(c.sanctionedAmount)}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(c.disbursedAmount)} disbursed</p>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        c.bucket === 'credit_l1' ? 'bg-blue-100 text-blue-800' :
                        c.bucket === 'credit_l2' ? 'bg-indigo-100 text-indigo-800' :
                        c.bucket === 'ps_l1' ? 'bg-green-100 text-green-800' :
                        c.bucket === 'ps_l2' ? 'bg-teal-100 text-teal-800' :
                        c.bucket === 'ready_for_ops' ? 'bg-amber-100 text-amber-800' :
                        c.bucket === 'ops_l1' ? 'bg-orange-100 text-orange-800' :
                        c.bucket === 'ops_l2' ? 'bg-cyan-100 text-cyan-800' :
                        c.bucket === 'ops_head' ? 'bg-purple-100 text-purple-800' :
                        c.bucket === 'completed' ? 'bg-green-100 text-green-800' :
                        c.bucket === 'rejected' ? 'bg-red-100 text-red-800' :
                        c.bucket === 'rm' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {STAGE_LABELS[c.bucket] || formatLabel(c.bucket)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASSES[c.status] || 'bg-gray-100 text-gray-800'}`}>
                        {formatLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        c.lifecycleStatus === 'archived'
                          ? 'bg-gray-200 text-gray-800'
                          : c.lifecycleStatus === 'on_hold'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {formatLabel(c.lifecycleStatus || 'active')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{c.assignedToName || c.userName || 'Unassigned'}</p>
                        <p className="text-sm text-gray-500">{c.assignedToEmail || c.userEmail || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formatTime(c.totalCompletionTimeMinutes || c.roleStageTime)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination with React Icons */}
        {!filters.viewAll && totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Page {filters.page} of {totalPages} ({total} cases)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, filters.page - 1))}
                disabled={filters.page === 1}
                className="p-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdChevronLeft className="text-xl" />
              </button>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, filters.page + 1))}
                disabled={filters.page === totalPages}
                className="p-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdChevronRight className="text-xl" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between  px-5 py-4">
              <div className="flex items-center gap-2">
                <MdFilterList className="text-xl text-gray-600" />
                <h3 className="font-semibold text-gray-900">Filter Cases</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close filters"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={draftFilters.companyName}
                    onChange={(e) => handleDraftFilterChange('companyName', e.target.value)}
                    placeholder="Search company name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                  {draftFilters.companyName.trim() && (
                    <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                      {companySuggestionsLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                      ) : companySuggestions.length > 0 ? (
                        companySuggestions.map((suggestion) => (
                          <button
                            key={suggestion.customerId}
                            type="button"
                            onClick={() => handleCompanySuggestionSelect(suggestion)}
                            className="block w-full px-3 py-2 text-left hover:bg-blue-50"
                          >
                            <span className="block text-sm font-medium text-gray-900">
                              {suggestion.companyName}
                            </span>
                            <span className="block text-xs text-gray-500">
                              {suggestion.customerCode || `Customer #${suggestion.customerId}`}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">No matching companies</div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
                  <select
                    value={draftFilters.caseType}
                    onChange={(e) => handleDraftFilterChange('caseType', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Case Types</option>
                    <option value="FINTREE">Fintree</option>
                    <option value="STERLION">Sterlion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={draftFilters.status}
                    onChange={(e) => handleDraftFilterChange('status', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    value={draftFilters.stage}
                    onChange={(e) => handleDraftFilterChange('stage', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    {STAGE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned User</label>
                  <select
                    value={draftFilters.userId}
                    onChange={(e) => handleDraftFilterChange('userId', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Users</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RM ID</label>
                  <select
                    value={draftFilters.rmId}
                    onChange={(e) => handleDraftFilterChange('rmId', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All RMs</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name} ({user.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort</label>
                  <select
                    value={draftFilters.sortBy}
                    onChange={(e) => handleDraftFilterChange('sortBy', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="newest">Newest to Oldest</option>
                    <option value="oldest">Oldest to Newest</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rows Per Page</label>
                  <select
                    value={draftFilters.viewAll ? 'all' : draftFilters.limit}
                    onChange={(e) => {
                      if (e.target.value === 'all') {
                        handleDraftFilterChange('viewAll', true)
                      } else {
                        setDraftFilters(prev => ({
                          ...prev,
                          viewAll: false,
                          limit: parseInt(e.target.value),
                          page: 1,
                        }))
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    {[10, 25, 50, 100].map((limit) => (
                      <option key={limit} value={limit}>{limit} rows</option>
                    ))}
                    <option value="all">View all cases</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={draftFilters.startDate}
                    onChange={(e) => handleDraftFilterChange('startDate', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={draftFilters.endDate}
                    onChange={(e) => handleDraftFilterChange('endDate', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg">
                <input
                  type="checkbox"
                  checked={draftFilters.showSanctions}
                  onChange={(e) => handleDraftFilterChange('showSanctions', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Show sanctions</span>
                  <span className="mt-1 block text-sm text-gray-500">
                    Adds customer-wise sanction count, partner names, allocated limit, and disbursed amount.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllCases;
