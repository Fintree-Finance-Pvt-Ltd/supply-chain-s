import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { FiUsers, FiCheckCircle, FiClock, FiAlertCircle, FiTrendingUp, FiTrendingDown, FiActivity } from 'react-icons/fi';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [timeRange, setTimeRange] = useState('7'); // days
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/superadmin/dashboard`);
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Analytics</h1>
          <p className="text-gray-600">Detailed performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {['overview', 'performance', 'buckets', 'ranking'].map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 font-medium capitalize transition ${
              activeSection === section
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {section}
          </button>
        ))}
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && analytics?.overview && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Users</p>
                  <p className="text-3xl font-bold text-blue-600">{analytics.overview.totalUsers}</p>
                </div>
                <FiUsers className="text-4xl text-blue-200" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Active Tasks</p>
                  <p className="text-3xl font-bold text-green-600">{analytics.overview.activeTasks}</p>
                </div>
                <FiActivity className="text-4xl text-green-200" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Completed Tasks</p>
                  <p className="text-3xl font-bold text-purple-600">{analytics.overview.completedTasks}</p>
                </div>
                <FiCheckCircle className="text-4xl text-purple-200" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Overdue Tasks</p>
                  <p className="text-3xl font-bold text-red-600">{analytics.overview.overdueTasks}</p>
                </div>
                <FiAlertCircle className="text-4xl text-red-200" />
              </div>
            </div>
          </div>

          {/* Processing Time Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">Average Completion Time</h3>
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-600">
                  {analytics.overview.averageCompletionTime
                    ? `${Math.round(analytics.overview.averageCompletionTime)}`
                    : 'N/A'}
                </p>
                <p className="text-gray-500">minutes</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">Pending Tasks</h3>
              <div className="text-center">
                <p className="text-4xl font-bold text-orange-500">{analytics.overview.pendingTasks}</p>
                <p className="text-gray-500">tasks in queue</p>
              </div>
            </div>
          </div>

          {/* L1 vs L2 Comparison */}
          {analytics.l1L2Comparison && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold mb-4">L1 vs L2 Processing Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-700 mb-2">L1 Processing</h4>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-blue-600">
                      {analytics.l1L2Comparison.l1Stats.avgTime
                        ? `${Math.round(analytics.l1L2Comparison.l1Stats.avgTime)} min`
                        : 'N/A'}
                    </p>
                    <p className="text-sm text-blue-600">
                      {analytics.l1L2Comparison.l1Stats.taskCount} tasks processed
                    </p>
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-700 mb-2">L2 Processing</h4>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-green-600">
                      {analytics.l1L2Comparison.l2Stats.avgTime
                        ? `${Math.round(analytics.l1L2Comparison.l2Stats.avgTime)} min`
                        : 'N/A'}
                    </p>
                    <p className="text-sm text-green-600">
                      {analytics.l1L2Comparison.l2Stats.taskCount} tasks processed
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance Section */}
      {activeSection === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fastest Closers */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiTrendingUp className="text-green-600" />
              <h3 className="text-lg font-semibold">Fastest Task Closers</h3>
            </div>
            <div className="space-y-3">
              {analytics?.fastestClosers?.length > 0 ? (
                analytics.fastestClosers.map((user, index) => (
                  <div key={user.userId} className="flex justify-between items-center bg-green-50 p-3 rounded">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      <span className="font-medium">{user.userName}</span>
                    </div>
                    <span className="text-green-600 font-semibold">
                      {Math.round(user.avgCompletionTime)} min
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
          </div>

          {/* Slowest Closers */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiTrendingDown className="text-red-600" />
              <h3 className="text-lg font-semibold">Slowest Task Closers</h3>
            </div>
            <div className="space-y-3">
              {analytics?.slowestClosers?.length > 0 ? (
                analytics.slowestClosers.map((user, index) => (
                  <div key={user.userId} className="flex justify-between items-center bg-red-50 p-3 rounded">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      <span className="font-medium">{user.userName}</span>
                    </div>
                    <span className="text-red-600 font-semibold">
                      {Math.round(user.avgCompletionTime)} min
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiCheckCircle className="text-blue-600" />
              <h3 className="text-lg font-semibold">Top Performers (Points)</h3>
            </div>
            <div className="space-y-3">
              {analytics?.topPerformers?.length > 0 ? (
                analytics.topPerformers.map((user, index) => (
                  <div key={user.userId} className="flex justify-between items-center bg-blue-50 p-3 rounded">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      <span className="font-medium">{user.userName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-600 font-semibold">{user.totalPoints}</span>
                      <span className="text-gray-500 text-sm ml-1">pts</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
          </div>

          {/* Lowest Performers */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FiAlertCircle className="text-orange-600" />
              <h3 className="text-lg font-semibold">Lowest Performers</h3>
            </div>
            <div className="space-y-3">
              {analytics?.lowestPerformers?.length > 0 ? (
                analytics.lowestPerformers.map((user, index) => (
                  <div key={user.userId} className="flex justify-between items-center bg-orange-50 p-3 rounded">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      <span className="font-medium">{user.userName}</span>
                    </div>
                    <span className="text-orange-600 font-semibold">{user.totalPoints} pts</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Buckets Section */}
      {activeSection === 'buckets' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Task Bucket Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics?.bucketStats?.length > 0 ? (
              analytics.bucketStats.map((bucket) => (
                <div key={bucket.bucketName} className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-3">{bucket.bucketName}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Tasks</span>
                      <span className="font-medium">{bucket.totalTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Completed</span>
                      <span className="font-medium text-green-600">{bucket.completedTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pending</span>
                      <span className="font-medium text-orange-600">{bucket.pendingTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Time</span>
                      <span className="font-medium">
                        {bucket.avgCompletionTime ? `${Math.round(bucket.avgCompletionTime)} min` : 'N/A'}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${bucket.totalTasks > 0 ? (bucket.completedTasks / bucket.totalTasks) * 100 : 0}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {bucket.totalTasks > 0
                          ? `${Math.round((bucket.completedTasks / bucket.totalTasks) * 100)}% completed`
                          : 'No tasks'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8 col-span-full">No bucket data available</p>
            )}
          </div>
        </div>
      )}

      {/* Ranking Section */}
      {activeSection === 'ranking' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">Productivity Ranking</h3>
          <div className="space-y-3">
            {analytics?.productivityRanking?.length > 0 ? (
              analytics.productivityRanking.map((user, index) => (
                <div
                  key={user.userId}
                  className={`flex justify-between items-center p-4 rounded ${
                    index === 0
                      ? 'bg-yellow-50 border border-yellow-200'
                      : index === 1
                      ? 'bg-gray-50 border border-gray-200'
                      : index === 2
                      ? 'bg-orange-50 border border-orange-200'
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0
                          ? 'bg-yellow-500'
                          : index === 1
                          ? 'bg-gray-400'
                          : index === 2
                          ? 'bg-orange-500'
                          : 'bg-gray-300'
                      }`}
                    >
                      {user.rank}
                    </span>
                    <span className="font-medium text-lg">{user.userName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-blue-600">{user.tasksCompleted}</span>
                    <span className="text-gray-500 ml-2">tasks</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No ranking data available</p>
            )}
          </div>
        </div>
      )}

      {/* No Data State */}
      {!analytics && (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
          <FiActivity className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Analytics Data Available</h3>
          <p className="text-gray-500 mb-4">
            Start processing tasks to see analytics and performance metrics.
          </p>
          <button
            onClick={fetchAnalytics}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Refresh Data
          </button>
        </div>
      )}
    </div>
  );
};

export default Analytics;
