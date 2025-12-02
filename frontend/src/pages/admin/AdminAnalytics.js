import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Star, 
  Users, 
  BarChart3,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  Car,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import api from '../../api'; // Shared API client (uses REACT_APP_API_URL base)
import { exportToPDF, exportToExcel } from '../../utils/exportUtils';

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    requests: null,
    revenue: null,
    performance: null
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    period: 'month',
    startDate: '',
    endDate: '',
    vehicleType: '',
    problemType: '',
    mechanicId: ''
  });
  
  const [mechanics, setMechanics] = useState([]);

  // Color schemes for charts
  const colors = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    indigo: '#6366f1',
    teal: '#14b8a6'
  };

  const chartColors = [
    colors.primary,
    colors.success,
    colors.warning,
    colors.danger,
    colors.purple,
    colors.pink,
    colors.indigo,
    colors.teal
  ];

  useEffect(() => {
    loadMechanics();
    loadAnalyticsData();
  }, [filters]);

  const loadMechanics = async () => {
    try {
      const response = await api.get('/admin/mechanics', {
        params: { limit: 100, verificationStatus: 'verified' }
      });
      if (response.data.success) {
        setMechanics(response.data.data.mechanics);
      }
    } catch (error) {
      console.error('Failed to load mechanics:', error);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      const params = {
        period: filters.period,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.vehicleType && { vehicleType: filters.vehicleType }),
        ...(filters.problemType && { problemType: filters.problemType }),
        ...(filters.mechanicId && { mechanicId: filters.mechanicId })
      };

      const [requestsRes, revenueRes, performanceRes] = await Promise.all([
        api.get('/admin/analytics/requests', { params }),
        api.get('/admin/analytics/revenue', { params }),
        api.get('/admin/analytics/performance', { params })
      ]);

      setData({
        requests: requestsRes.data.success ? requestsRes.data.data : null,
        revenue: revenueRes.data.success ? revenueRes.data.data : null,
        performance: performanceRes.data.success ? performanceRes.data.data : null
      });

    } catch (error) {
      console.error('Failed to load analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExportToPDF = async () => {
    try {
      await exportToPDF(data, filters.period, filters);
      toast.success('PDF report exported successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF report');
    }
  };

  const handleExportToExcel = () => {
    try {
      exportToExcel(data, filters.period, filters);
      toast.success('Excel report exported successfully');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export Excel report');
    }
  };

  if (loading && !data.requests) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    );
  }

  const overviewCards = [
    {
      title: 'Requests Growth',
      value: data.requests?.overview?.requestsGrowth || 0,
      suffix: '%',
      icon: TrendingUp,
      color: data.requests?.overview?.requestsGrowth >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: data.requests?.overview?.requestsGrowth >= 0 ? 'bg-green-100' : 'bg-red-100',
      trend: data.requests?.overview?.requestsGrowth >= 0 ? 'up' : 'down'
    },
    {
      title: 'Revenue Growth',
      value: data.revenue?.overview?.revenueGrowth || 0,
      suffix: '%',
      icon: DollarSign,
      color: data.revenue?.overview?.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: data.revenue?.overview?.revenueGrowth >= 0 ? 'bg-green-100' : 'bg-red-100',
      trend: data.revenue?.overview?.revenueGrowth >= 0 ? 'up' : 'down'
    },
    {
      title: 'Avg Response Time',
      value: data.performance?.overview?.avgResponseTime || 0,
      suffix: ' min',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      trend: 'neutral'
    },
    {
      title: 'Avg Rating',
      value: data.performance?.overview?.avgRating || 0,
      suffix: '/5',
      icon: Star,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      trend: 'neutral'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            Advanced Analytics
          </h2>
          <p className="text-gray-600 mt-1">Deep insights into platform performance and trends</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadAnalyticsData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 transition-all duration-200 hover:shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-200 transition-all duration-200 hover:shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Date Range</label>
            <select
              value={filters.period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.period === 'custom' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Vehicle Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Vehicle Type</label>
            <select
              value={filters.vehicleType}
              onChange={(e) => handleFilterChange('vehicleType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Vehicles</option>
              <option value="bike">Bike</option>
              <option value="car">Car</option>
              <option value="truck">Truck</option>
              <option value="bus">Bus</option>
              <option value="cng">CNG</option>
              <option value="rickshaw">Rickshaw</option>
            </select>
          </div>

          {/* Problem Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Problem Type</label>
            <select
              value={filters.problemType}
              onChange={(e) => handleFilterChange('problemType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Problems</option>
              <option value="flat_tire">Flat Tire</option>
              <option value="battery_issue">Battery Issue</option>
              <option value="engine_trouble">Engine Trouble</option>
              <option value="brake_problem">Brake Problem</option>
              <option value="electrical_issue">Electrical Issue</option>
              <option value="fuel_problem">Fuel Problem</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Mechanic */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Mechanic</label>
            <select
              value={filters.mechanicId}
              onChange={(e) => handleFilterChange('mechanicId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Mechanics</option>
              {mechanics.map(mechanic => (
                <option key={mechanic._id} value={mechanic._id}>
                  {mechanic.userId?.name || 'Unknown Mechanic'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {overviewCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.bgColor}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div className="flex items-center gap-1">
                  {card.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {card.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                  {card.trend === 'neutral' && <div className="w-4 h-4 rounded-full bg-gray-300" />}
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">{card.title}</h3>
              <p className={`text-3xl font-bold ${card.color}`}>
                {card.value}{card.suffix}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Requests Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Daily Requests Trend
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.requests?.dailyRequests || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="_id.date" 
                  stroke="#666"
                  fontSize={12}
                />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke={colors.primary} 
                  strokeWidth={3}
                  name="Total Requests"
                  dot={{ fill: colors.primary, strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke={colors.success} 
                  strokeWidth={3}
                  name="Completed"
                  dot={{ fill: colors.success, strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="cancelled" 
                  stroke={colors.danger} 
                  strokeWidth={3}
                  name="Cancelled"
                  dot={{ fill: colors.danger, strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Daily Revenue Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Daily Revenue
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenue?.dailyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="_id.date" 
                  stroke="#666"
                  fontSize={12}
                />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  formatter={(value) => [`BDT ${value.toLocaleString()}`, 'Revenue']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="revenue" 
                  fill={colors.success}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Vehicle Type Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Car className="w-5 h-5 text-purple-600" />
            Vehicle Type Distribution
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.requests?.vehicleTypeDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ _id, count, percent }) => `${_id} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {(data.requests?.vehicleTypeDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [
                    value, 
                    props.payload._id
                  ]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Problem Type Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Problem Type Analysis
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.requests?.problemTypeDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="_id" 
                  stroke="#666"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill={colors.warning}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Top Mechanics Horizontal Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="bg-white rounded-xl shadow-lg border border-gray-100 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Top Performing Mechanics
        </h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data.performance?.topMechanics || []} 
              layout="horizontal"
              margin={{ left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#666" fontSize={12} />
              <YAxis 
                type="category" 
                dataKey="user.name" 
                stroke="#666" 
                fontSize={12}
                width={90}
              />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'completedJobs') return [value, 'Completed Jobs'];
                  if (name === 'avgRating') return [value?.toFixed(1), 'Avg Rating'];
                  return [value, name];
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar 
                dataKey="completedJobs" 
                fill={colors.indigo}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminAnalytics;
