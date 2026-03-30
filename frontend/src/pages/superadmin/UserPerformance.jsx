 import { useState, useEffect } from 'react';
import { performanceService } from '../../services/performanceService';
import { ROLES, ROLE_LABELS } from '../../constants/roles';
import { FaFolder, FaList } from 'react-icons/fa';

// Material Icons from react-icons
import {
  MdPeople,
  MdCheckCircle,
  MdStar,
  MdTimer,
  MdFilterList,
  MdVisibility,
  MdClose,
  MdWarning,
  MdTrendingUp,
  MdInsights,
  MdAssignment,
} from 'react-icons/md';

// Stage options
const STAGE_OPTIONS = [
  { value: '', label: 'All Stages' },
  { value: 'credit_l1', label: 'Credit L1' },
  { value: 'credit_l2', label: 'Credit L2' },
  { value: 'ps_l1', label: 'PS L1' },
  { value: 'ps_l2', label: 'PS L2' },
  { value: 'rm', label: 'RM' },
];

// Role badge colors
const getRoleBadgeColor = (role) => {
  const colors = {
    credit_team_l1: 'bg-blue-100 text-blue-800',
    credit_team_l2: 'bg-indigo-100 text-indigo-800',
    operations_team_l1: 'bg-green-100 text-green-800',
    operations_team_l2: 'bg-teal-100 text-teal-800',
    operations_head: 'bg-purple-100 text-purple-800',
    relationship_manager: 'bg-orange-100 text-orange-800',
    admin: 'bg-red-100 text-red-800',
    superadmin: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
};

// Performance score color
const getScoreColor = (score) => {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50';
  if (score >= 40) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
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

const UserPerformance = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [userList, setUserList] = useState([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  
  // Cases state
  const [cases, setCases] = useState([]);
  const [casesTotal, setCasesTotal] = useState(0);
  const [casesLoading, setCasesLoading] = useState(false);
  const [activeView, setActiveView] = useState('performance'); // 'performance' or 'cases'

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    stage: '',
    userId: '',
    limit: 20,
    offset: 0,
    sortBy: 'efficiencyScore',
    sortOrder: 'DESC',
  });

  // Cases Filters
  const [caseFilters, setCaseFilters] = useState({
    status: '',
    stage: '',
    userId: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0,
  });

  // Load initial data
  useEffect(() => {
    loadSummary();
    loadUsers();
    loadUserList();
  }, []);

  // Load user list when filters change
  useEffect(() => {
    loadUserList();
  }, [filters]);

  // Load cases when view changes to cases or filters change
  useEffect(() => {
    if (activeView === 'cases') {
      loadCases();
    }
  }, [activeView, caseFilters]);

  const loadSummary = async () => {
    try {
      const data = await performanceService.getSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await performanceService.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadUserList = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        stage: filters.stage || undefined,
        userId: filters.userId || undefined,
        limit: filters.limit,
        offset: filters.offset,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      };
      const data = await performanceService.getUserList(params);
      setUserList(data.data);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load user list:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCases = async () => {
    setCasesLoading(true);
    try {
      const params = {
        status: caseFilters.status || undefined,
        stage: caseFilters.stage || undefined,
        userId: caseFilters.userId ? parseInt(caseFilters.userId) : undefined,
        startDate: caseFilters.startDate || undefined,
        endDate: caseFilters.endDate || undefined,
        limit: caseFilters.limit,
        offset: caseFilters.offset,
      };
      const data = await performanceService.getAllCases(params);
      setCases(data.cases);
      setCasesTotal(data.total);
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setCasesLoading(false);
    }
  };

  const loadUserDetail = async (userId) => {
    setDetailLoading(true);
    setSelectedUser(userId);
    try {
      const params = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        stage: filters.stage || undefined,
      };
      const data = await performanceService.getUserDetail(userId, params);
      setUserDetail(data);
      setShowDetail(true);
    } catch (error) {
      console.error('Failed to load user detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      stage: '',
      userId: '',
      limit: 20,
      offset: 0,
      sortBy: 'efficiencyScore',
      sortOrder: 'DESC',
    });
  };

  const handleCaseFilterChange = (key, value) => {
    setCaseFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const clearCaseFilters = () => {
    setCaseFilters({
      status: '',
      stage: '',
      userId: '',
      startDate: '',
      endDate: '',
      limit: 50,
      offset: 0,
    });
  };

  // Status options for cases
  const STATUS_OPTIONS = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Performance</h1>
            <p className="text-gray-600 mt-1">Track and analyze user performance metrics across all stages</p>
          </div>
          {/* View Toggle Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('performance')}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'performance'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MdTrendingUp className="mr-2" />
              Performance
            </button>

          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {activeView === 'performance' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Users Tracked</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary?.totalUsersTracked || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <MdPeople className="text-2xl text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completed Cases</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary?.totalCompletedCases || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <MdCheckCircle className="text-2xl text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rewards Distributed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary?.totalRewardsDistributed || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <MdStar className="text-2xl text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Completion Time</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatTime(summary?.avgCompletionTime)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <MdTimer className="text-2xl text-purple-600" />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Filters Section */}
      {activeView === 'performance' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MdFilterList className="text-gray-600 text-xl" />
          <h3 className="font-medium text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
          
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Performance Table */}
      {activeView === 'performance' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Performance Overview</h3>
          <p className="text-sm text-gray-500 mt-1">{total} users found</p>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-2 text-gray-600">Loading performance data...</p>
          </div>
        ) : userList.length === 0 ? (
          <div className="p-8 text-center">
            <MdWarning className="text-4xl text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No performance data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Credit L1</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Credit L2</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PS L1</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PS L2</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">RM</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rewards</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {userList.map((user) => {
                  // Get stage-specific counts from stagePerformance if available
                  const stageStats = {};
                  if (user.stagePerformance) {
                    user.stagePerformance.forEach(stage => {
                      stageStats[stage.stage] = stage.completedCases;
                    });
                  }
                  
                  return (
                    <tr key={user.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{user.userName}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.primaryRole)}`}>
                          {ROLE_LABELS[user.primaryRole] || user.primaryRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900">{stageStats['credit_l1'] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900">{stageStats['credit_l2'] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900">{stageStats['ps_l1'] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900">{stageStats['ps_l2'] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900">{stageStats['rm'] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium text-green-600">{user.completedCases}</span>
                        <span className="text-gray-400 text-sm"> / {user.totalCases}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium text-yellow-600">{user.totalRewards}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {formatTime(user.avgCompletionTime)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium ${getScoreColor(user.efficiencyScore)}`}>
                          {user.efficiencyScore?.toFixed(1) || '0.0'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => loadUserDetail(user.userId)}
                          className="inline-flex items-center px-3 py-1.5 text-sm text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <MdVisibility className="mr-1 text-lg" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {activeView === 'performance' && total > filters.limit && (
          <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filters.offset + 1} to {Math.min(filters.offset + filters.limit, total)} of {total} results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleFilterChange('offset', Math.max(0, filters.offset - filters.limit))}
                disabled={filters.offset === 0}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handleFilterChange('offset', filters.offset + filters.limit)}
                disabled={filters.offset + filters.limit >= total}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}


      {/* User Detail Drawer */}
      {showDetail && (
        <UserDetailDrawer
          user={userDetail}
          loading={detailLoading}
          onClose={() => {
            setShowDetail(false);
            setSelectedUser(null);
          }}
          formatTime={formatTime}
          getRoleBadgeColor={getRoleBadgeColor}
          getScoreColor={getScoreColor}
        />
      )}
    </div>
  );
};

// User Detail Drawer Component
const UserDetailDrawer = ({ user, loading, onClose, formatTime, getRoleBadgeColor, getScoreColor }) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user.userName}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <MdClose className="text-2xl" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Overall Performance Score */}
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary-700">Overall Performance Score</p>
                  <p className="text-4xl font-bold text-primary-900 mt-1">
                    {user.efficiencyScore?.toFixed(1) || '0.0'}
                  </p>
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getScoreColor(user.efficiencyScore)}`}>
                  {user.efficiencyScore >= 80 ? (
                    <MdStar className="text-3xl text-yellow-500" />
                  ) : user.efficiencyScore >= 60 ? (
                    <MdTrendingUp className="text-3xl text-green-500" />
                  ) : (
                    <MdWarning className="text-3xl text-red-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Total Cases</p>
                <p className="text-2xl font-bold text-gray-900">{user.totalCases}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-green-600">{user.completedCases}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{user.pendingCases}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Total Rewards</p>
                <p className="text-2xl font-bold text-yellow-600">{user.totalRewards}</p>
              </div>
            </div>

            {/* Time Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Average Completion Time</p>
                <p className="text-xl font-bold text-gray-900">{formatTime(user.avgCompletionTime)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Time Spent</p>
                <p className="text-xl font-bold text-gray-900">{formatTime(user.totalCompletionTime)}</p>
              </div>
            </div>

            {/* Role */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Roles</h3>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role, idx) => (
                  <span key={idx} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(role)}`}>
                    {ROLE_LABELS[role] || role}
                  </span>
                ))}
              </div>
            </div>

            {/* Stage-wise Performance */}
            {user.stagePerformance && user.stagePerformance.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Stage-wise Performance</h3>
                <div className="space-y-3">
                  {user.stagePerformance.map((stage, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{stage.stageLabel}</span>
                        <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(stage.completedCases > 0 ? (stage.avgCompletionTime ? (120 - stage.avgCompletionTime) / 120 * 100 : 50) : 0)}`}>
                          {stage.completedCases} cases
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Assigned</p>
                          <p className="font-medium">{stage.totalAssigned}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Completed</p>
                          <p className="font-medium text-green-600">{stage.completedCases}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Pending</p>
                          <p className="font-medium text-yellow-600">{stage.pendingCases}</p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Avg Time</p>
                          <p className="font-medium">{formatTime(stage.avgCompletionTime)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Rewards</p>
                          <p className="font-medium text-yellow-600">{stage.rewardsEarned}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Completed Cases */}
            {user.recentCases && user.recentCases.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Recent Completed Cases</h3>
                <div className="space-y-2">
                  {user.recentCases.map((task, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{task.taskId}</p>
                        <p className="text-xs text-gray-500">{task.taskType} • {task.bucket || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{formatTime(task.completionTimeMinutes)}</p>
                        <p className="text-xs text-yellow-600">+{task.rewardsEarned} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPerformance;