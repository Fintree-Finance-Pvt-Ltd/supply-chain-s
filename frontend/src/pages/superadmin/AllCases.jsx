import { useState, useEffect } from 'react';
import { performanceService } from '../../services/performanceService';
import { CASE_STATUS, CASE_STATUS_LABELS } from '../../constants/caseStatus';
import {
  MdFilterList,
  MdWarning,
  MdChevronLeft,
  MdChevronRight,
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

const formatLabel = (value) => {
  if (!value) return 'N/A';
  return CASE_STATUS_LABELS[value] || value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const AllCases = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [users, setUsers] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    stage: '',
    userId: '',
    startDate: '',
    endDate: '',
    limit: 10,
    page: 1,
  });

  // Load initial data
  useEffect(() => {
    loadUsers();
    loadCases();
  }, []);

  // Load cases when filters change
  useEffect(() => {
    loadCases();
  }, [filters]);

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
        status: filters.status || undefined,
        stage: filters.stage || undefined,
        userId: filters.userId ? parseInt(filters.userId) : undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        limit: filters.limit,
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      stage: '',
      userId: '',
      startDate: '',
      endDate: '',
      limit: 10,
      page: 1,
    });
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Cases</h1>
        <p className="text-gray-600 mt-1">Track and view all cases across all users</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MdFilterList className="text-gray-600 text-xl" />
          <h3 className="font-medium text-gray-900">Filter Cases</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
            <select
              value={filters.stage}
              onChange={(e) => handleFilterChange('stage', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              {STAGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">All Cases</h3>
            <p className="text-sm text-gray-500 mt-1">{total} cases found</p>
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
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Case ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cases.map((c) => (
                  <tr key={`${c.taskType || 'case'}-${c.id}-${c.taskId}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{c.taskId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{c.companyName || 'N/A'}</span>
                    </td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination with React Icons */}
        {totalPages > 1 && (
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
    </div>
  );
};

export default AllCases;
