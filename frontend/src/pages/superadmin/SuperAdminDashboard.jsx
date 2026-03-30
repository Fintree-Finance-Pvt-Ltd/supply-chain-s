import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [rewardConfig, setRewardConfig] = useState([]);
  const [buckets, setBuckets] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/dashboard');
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await api.get('/superadmin/top-performers?limit=10');
      if (response.data.success) {
        setLeaderboard(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchRewardConfig = async () => {
    try {
      const response = await api.get('/rewards/config');
      if (response.data.success) {
        setRewardConfig(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching reward config:', error);
    }
  };

  const fetchBuckets = async () => {
    try {
      const response = await api.get('/buckets');
      if (response.data.success) {
        setBuckets(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching buckets:', error);
    }
  };


  useEffect(() => {
    if (activeTab === 'leaderboard') fetchLeaderboard();
    if (activeTab === 'rewards') fetchRewardConfig();
    if (activeTab === 'buckets') fetchBuckets();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Dashboard Overview' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'rewards', label: 'Reward Config' },
    { id: 'buckets', label: 'Task Buckets' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Super Administrator Dashboard</h1>
        <p className="text-gray-600">Global analytics and system management</p>
      </div>

      {/* Stats Cards */}
      {analytics?.overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Total Users</h3>
            <p className="text-3xl font-bold text-blue-600">{analytics.overview.totalUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Active Tasks</h3>
            <p className="text-3xl font-bold text-green-600">{analytics.overview.activeTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Completed Tasks</h3>
            <p className="text-3xl font-bold text-purple-600">{analytics.overview.completedTasks}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-gray-500 text-sm font-medium">Overdue Tasks</h3>
            <p className="text-3xl font-bold text-red-600">{analytics.overview.overdueTasks}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && analytics && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Performance Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium mb-2">Average Completion Time</h3>
                  <p className="text-2xl font-bold">
                    {analytics.overview.averageCompletionTime
                      ? `${Math.round(analytics.overview.averageCompletionTime)} minutes`
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium mb-2">Pending Tasks</h3>
                  <p className="text-2xl font-bold">{analytics.overview.pendingTasks}</p>
                </div>
              </div>

              {/* L1 vs L2 Comparison */}
              {analytics.l1L2Comparison && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">L1 vs L2 Processing Comparison</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800">L1 Processing</h4>
                      <p className="text-2xl font-bold text-blue-600">
                        {analytics.l1L2Comparison.l1Stats.avgTime
                          ? `${Math.round(analytics.l1L2Comparison.l1Stats.avgTime)} min`
                          : 'N/A'}
                      </p>
                      <p className="text-sm text-blue-600">{analytics.l1L2Comparison.l1Stats.taskCount} tasks</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-medium text-green-800">L2 Processing</h4>
                      <p className="text-2xl font-bold text-green-600">
                        {analytics.l1L2Comparison.l2Stats.avgTime
                          ? `${Math.round(analytics.l1L2Comparison.l2Stats.avgTime)} min`
                          : 'N/A'}
                      </p>
                      <p className="text-sm text-green-600">{analytics.l1L2Comparison.l2Stats.taskCount} tasks</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Top Performers Leaderboard</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Rank</th>
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-4 py-2 text-left">Tasks Completed</th>
                      <th className="px-4 py-2 text-left">Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((user, index) => (
                      <tr key={user.userId} className="border-t">
                        <td className="px-4 py-2">{index + 1}</td>
                        <td className="px-4 py-2">{user.userName}</td>
                        <td className="px-4 py-2">{user.tasksCompleted}</td>
                        <td className="px-4 py-2">
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            {user.totalPoints} pts
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rewards Config Tab */}
          {activeTab === 'rewards' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Reward Point Configuration</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {rewardConfig.map(config => (
                  <div key={config.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium capitalize">{config.category}</span>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        {config.points} pts
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {config.minMinutes}-{config.maxMinutes || '∞'} minutes
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buckets Tab */}
          {activeTab === 'buckets' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Task Bucket Distribution</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {buckets.map(bucket => (
                  <div key={bucket.id} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium">{bucket.bucketName}</h3>
                    <p className="text-sm text-gray-600">{bucket.description}</p>
                    <p className="text-sm text-gray-500 mt-2">Priority: {bucket.priority}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && analytics && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Performance Analytics</h2>
              
              {/* Fastest Closers */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">🏃 Fastest Closers</h3>
                <div className="space-y-2">
                  {analytics.fastestClosers.map(user => (
                    <div key={user.userId} className="flex justify-between items-center bg-green-50 p-3 rounded">
                      <span>{user.userName}</span>
                      <span className="text-green-600 font-medium">
                        {Math.round(user.avgCompletionTime)} min avg
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slowest Closers */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">🐢 Slowest Closers</h3>
                <div className="space-y-2">
                  {analytics.slowestClosers.map(user => (
                    <div key={user.userId} className="flex justify-between items-center bg-red-50 p-3 rounded">
                      <span>{user.userName}</span>
                      <span className="text-red-600 font-medium">
                        {Math.round(user.avgCompletionTime)} min avg
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bucket Stats */}
              <div>
                <h3 className="text-lg font-medium mb-3">📊 Bucket Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.bucketStats.map(bucket => (
                    <div key={bucket.bucketName} className="bg-gray-50 p-4 rounded">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">{bucket.bucketName}</span>
                        <span className="text-gray-600">{bucket.totalTasks} tasks</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Completed: {bucket.completedTasks}</p>
                        <p>Pending: {bucket.pendingTasks}</p>
                        <p>
                          Avg Time: {bucket.avgCompletionTime
                            ? `${Math.round(bucket.avgCompletionTime)} min`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;