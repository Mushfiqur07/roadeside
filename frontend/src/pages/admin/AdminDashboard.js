import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users, 
  Settings, 
  BarChart3, 
  Shield, 
  TrendingUp,
  Banknote,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  BadgeCheck,
  Ban,
  Check,
  X,
  Filter,
  Percent
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import LoadingSpinner from '../../components/LoadingSpinner';
import AdminMechanicManagement from './AdminMechanicManagement';
import AdminAnalytics from './AdminAnalytics';
import toast from 'react-hot-toast';
// Use shared API client so REACT_APP_API_URL is respected
import api from '../../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const adminAPI = {
  async getDashboardStats() {
    const { data } = await api.get('/admin/dashboard');
    if (!data.success) throw new Error(data.message || 'Failed to get dashboard');
    const { overview } = data.data;
    return {
      success: true,
      data: {
        totalUsers: overview.totalUsers,
        totalMechanics: overview.totalMechanics,
        pendingMechanics: overview.pendingMechanics || 0,
        verifiedMechanics: overview.verifiedMechanics || 0,
        totalRequests: overview.totalRequests,
        activeRequests: overview.activeRequests,
        completedRequests: overview.completedRequests,
        totalRevenue: overview.totalRevenue || 0,
        averageRating: Math.round((overview.averageRating || 0) * 10) / 10,
        responseTime: overview.avgResponseTime || 0
      }
    };
  },
  async getActivity() {
    const { data } = await api.get('/admin/activity');
    if (!data.success) throw new Error(data.message || 'Failed to get activity');
    return data.data;
  },
  async getUsers(page = 1, limit = 10, filters = {}) {
    const { role, isActive, search } = filters;
    const params = { page, limit, role, isActive, search };
    const { data } = await api.get('/admin/users', { params });
    if (!data.success) throw new Error(data.message || 'Failed to get users');
    return {
      success: true,
      data: {
        users: data.data.users,
        totalPages: data.data.pagination.pages,
        currentPage: data.data.pagination.current
      }
    };
  },
  async updateUserStatus(userId, isActive) {
    const { data } = await api.put(`/admin/users/${userId}/status`, { isActive });
    if (!data.success) throw new Error(data.message || 'Failed to update user');
    return data.data.user;
  },
  async deleteUser(userId) {
    const { data } = await api.delete(`/admin/users/${userId}`);
    if (!data.success) throw new Error(data.message || 'Failed to delete user');
    return data.data.user;
  },
  async getMechanics(page = 1, limit = 10, filters = {}) {
    const params = { page, limit, ...filters };
    const { data } = await api.get('/admin/mechanics', { params });
    if (!data.success) throw new Error(data.message || 'Failed to get mechanics');
    return {
      success: true,
      data: {
        mechanics: data.data.mechanics,
        totalPages: data.data.pagination.pages,
        currentPage: data.data.pagination.current
      }
    };
  },
  async setMechanicVerification(mechanicId, verificationStatus, notes) {
    const { data } = await api.put(`/admin/mechanics/${mechanicId}/verification`, { verificationStatus, notes });
    if (!data.success) throw new Error(data.message || 'Failed to update verification');
    return data.data.mechanic;
  },
  async getRequests(page = 1, limit = 10, filters = {}) {
    const params = { page, limit, ...filters };
    const { data } = await api.get('/admin/requests', { params });
    if (!data.success) throw new Error(data.message || 'Failed to get requests');
    return {
      success: true,
      data: {
        requests: data.data.requests,
        totalPages: data.data.pagination.pages,
        currentPage: data.data.pagination.current
      }
    };
  },
  async updateRequestStatus(requestId, status) {
    const { data } = await api.put(`/admin/requests/${requestId}/status`, { status });
    if (!data.success) throw new Error(data.message || 'Failed to update request');
    return data.data.request;
  },
  async getAnalytics(period = '30d') {
    const { data } = await api.get('/admin/analytics', { params: { period } });
    if (!data.success) throw new Error(data.message || 'Failed to get analytics');
    return data.data;
  },
  async listPromotions() {
    const { data } = await api.get('/admin/promotions');
    if (!data.success) throw new Error(data.message || 'Failed to get promotions');
    return data.data.promotions;
  },
  async createPromotion(payload) {
    const { data } = await api.post('/admin/promotions', payload);
    if (!data.success) throw new Error(data.message || 'Failed to create promotion');
    return data.data.promotion;
  },
  async updatePromotion(id, payload) {
    const { data } = await api.put(`/admin/promotions/${id}`, payload);
    if (!data.success) throw new Error(data.message || 'Failed to update promotion');
    return data.data.promotion;
  },
  async deletePromotion(id) {
    const { data } = await api.delete(`/admin/promotions/${id}`);
    if (!data.success) throw new Error(data.message || 'Failed to delete promotion');
    return true;
  }
};

// Lightweight animated counter without extra deps
const CountUp = ({ value, prefix = '', suffix = '', duration = 0.8 }) => {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, latest => Math.round(latest));
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(motionValue, Number(value || 0), { duration, ease: 'easeOut' });
    const unsub = rounded.on('change', v => setDisplay(v));
    return () => { controls.stop(); unsub(); };
  }, [value]);
  return <span>{prefix}{display}{suffix}</span>;
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Set active tab based on current route
    const path = location.pathname.split('/').pop();
    setActiveTab(path === 'admin' ? 'dashboard' : path);
  }, [location]);

  useEffect(() => {
    // Admin guard
    if (!user) return;
    if (user.role !== 'admin') {
      toast.error('Unauthorized');
      navigate('/');
      return;
    }
    loadDashboardStats();
    loadActivity();
  }, [user]);

  const loadDashboardStats = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getDashboardStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActivity = async () => {
    try {
      const items = await adminAPI.getActivity();
      setActivity(items);
    } catch (error) {
      console.error('Failed to load activity:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/admin/${tab}`);
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'mechanics', label: 'Mechanics', icon: Settings },
    { id: 'requests', label: 'Requests', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'promotions', label: 'Promotions', icon: Percent },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading admin dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, mechanics, and monitor platform performance</p>
        </motion.div>

        {/* Layout with Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className={`lg:col-span-3 transition-all duration-300 ${sidebarCollapsed ? 'lg:max-w-[80px]' : ''}`}>
            <div className="bg-white rounded-xl shadow-soft p-2 sticky top-4">
              <div className="flex items-center justify-between px-2 py-2 mb-1">
                <span className={`text-sm font-semibold text-gray-700 transition-opacity ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>Menu</span>
                <button
                  aria-label="Toggle sidebar"
                  onClick={() => setSidebarCollapsed(v => !v)}
                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                  title={sidebarCollapsed ? 'Expand' : 'Collapse'}
                >
                  {sidebarCollapsed ? '›' : '‹'}
                </button>
              </div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium mb-1 transition-colors ${
                      isActive ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      <motion.span className="w-4 h-4" whileHover={{ scale: 1.15 }}>
                        <Icon className="w-4 h-4" />
                      </motion.span>
                      {!sidebarCollapsed && <span>{tab.label}</span>}
                    </span>
                    {isActive && !sidebarCollapsed && <span className="w-2 h-2 bg-white rounded-full" />}
                  </motion.button>
                );
              })}
            </div>
          </aside>
          <main className="lg:col-span-9">
            <Routes>
              <Route path="/" element={<DashboardOverview stats={stats} activity={activity} />} />
              <Route path="/dashboard" element={<DashboardOverview stats={stats} activity={activity} />} />
              <Route path="/users" element={<UsersManagement />} />
              <Route path="/mechanics" element={<AdminMechanicManagement />} />
              <Route path="/requests" element={<RequestsManagement />} />
              <Route path="/analytics" element={<AdminAnalytics />} />
              <Route path="/promotions" element={<PromotionsManagement />} />
              <Route path="/settings" element={<AdminSettings />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

// Dashboard Overview Component
const DashboardOverview = ({ stats, activity = [] }) => {
  if (!stats) return <LoadingSpinner size="lg" />;

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      change: '+12%'
    },
    {
      title: 'Total Mechanics',
      value: stats.totalMechanics,
      icon: Settings,
      color: 'bg-green-100 text-green-600',
      change: '+8%'
    },
    {
      title: 'Pending Mechanics',
      value: stats.pendingMechanics || 0,
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-600',
      change: '—'
    },
    {
      title: 'Verified Mechanics',
      value: stats.verifiedMechanics || 0,
      icon: BadgeCheck,
      color: 'bg-emerald-100 text-emerald-600',
      change: '—'
    },
    {
      title: 'Active Requests',
      value: stats.activeRequests,
      icon: Clock,
      color: 'bg-yellow-100 text-yellow-600',
      change: '-5%'
    },
    {
      title: 'Total Revenue',
      value: `BDT ${(stats.totalRevenue || 0).toLocaleString()}`,
      icon: Banknote,
      color: 'bg-primary-100 text-primary-600',
      change: '+15%'
    },
    {
      title: 'Completed Requests',
      value: stats.completedRequests,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
      change: '+18%'
    },
    {
      title: 'Average Rating',
      value: stats.averageRating,
      icon: Star,
      color: 'bg-yellow-100 text-yellow-600',
      change: '+0.2'
    },
    {
      title: 'Response Time',
      value: `${stats.responseTime} min`,
      icon: Clock,
      color: 'bg-purple-100 text-purple-600',
      change: '-2 min'
    },
    {
      title: 'Total Requests',
      value: stats.totalRequests,
      icon: BarChart3,
      color: 'bg-indigo-100 text-indigo-600',
      change: '+22%'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div 
              key={stat.title} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${stat.color} shadow-sm`}>
                  <Icon className="w-7 h-7" />
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  stat.change.startsWith('+') 
                    ? 'text-green-700 bg-green-100' 
                    : stat.change.startsWith('-')
                    ? 'text-red-700 bg-red-100'
                    : 'text-gray-700 bg-gray-100'
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-2">{stat.title}</h3>
              <p className="text-3xl font-bold text-gray-900">
                {typeof stat.value === 'number' ? (
                  <CountUp value={stat.value} />
                ) : (
                  stat.value
                )}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            Recent Activity
          </h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-md">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
        <div className="space-y-4">
          {activity.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h4>
              <p className="text-gray-600">Activity will appear here as users and mechanics interact with the platform</p>
            </div>
          ) : (
            activity.map((item, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200"
              >
                <div className="flex-shrink-0">
                  <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {item.type === 'user_registered' && `New user ${item.user} registered`}
                    {item.type === 'mechanic_updated' && `Mechanic ${item.user} updated their profile`}
                    {item.type === 'request_completed' && `${item.user} completed a service request`}
                    {item.type === 'request_cancelled' && `${item.user} cancelled a service request`}
                    {item.type === 'mechanic_verified' && `Mechanic ${item.user} was verified`}
                    {item.type === 'mechanic_rejected' && `Mechanic ${item.user} was rejected`}
                    {item.type === 'payment_received' && `Payment of BDT ${item.amount} received`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    item.type.includes('completed') || item.type.includes('verified') || item.type.includes('payment')
                      ? 'bg-green-100 text-green-700'
                      : item.type.includes('cancelled') || item.type.includes('rejected')
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.type.split('_')[0]}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Users Management Component
const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadUsers();
  }, [currentPage, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getUsers(currentPage, 10, {
        role: roleFilter || undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'active',
        search: searchTerm || undefined
      });
      if (response.success) {
        setUsers(response.data.users);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-white rounded-xl shadow-soft p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Users Management</h2>
        <button
          onClick={loadUsers}
          className="btn btn-outline flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="input w-full pl-10"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input">
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="mechanic">Mechanic</option>
            <option value="admin">Admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="mt-3">
          <button onClick={() => { setCurrentPage(1); loadUsers(); }} className="btn btn-outline flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Requests</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Joined</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium text-sm">
                        {user.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="text-sm text-gray-900">{user.phone}</p>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-gray-900">{user.totalRequests}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <button className="btn btn-ghost btn-sm p-1" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="btn btn-ghost btn-sm p-1" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    {user.isActive ? (
                      <button
                        className="btn btn-ghost btn-sm p-1 text-yellow-600"
                        title="Deactivate"
                        onClick={async () => {
                          try {
                            await adminAPI.updateUserStatus(user._id, false);
                            toast.success('User deactivated');
                            loadUsers();
                          } catch (e) { toast.error('Failed'); }
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm p-1 text-green-600"
                        title="Activate"
                        onClick={async () => {
                          try {
                            await adminAPI.updateUserStatus(user._id, true);
                            toast.success('User activated');
                            loadUsers();
                          } catch (e) { toast.error('Failed'); }
                        }}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm p-1 text-red-600"
                      title="Delete"
                      onClick={async () => {
                        if (!window.confirm('Deactivate this user?')) return;
                        try {
                          await adminAPI.deleteUser(user._id);
                          toast.success('User deleted');
                          loadUsers();
                        } catch (e) { toast.error('Failed'); }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-6">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="btn btn-outline btn-sm disabled:opacity-50"
          >
            Previous
          </button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="btn btn-outline btn-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </motion.div>
  );
};

// Mechanics Management Component
const MechanicsManagement = () => {
  const [mechanics, setMechanics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [vehicleType, setVehicleType] = useState('');

  useEffect(() => {
    loadMechanics();
  }, [currentPage, verificationStatus, vehicleType]);

  const loadMechanics = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getMechanics(currentPage, 10, {
        verificationStatus: verificationStatus || undefined,
        vehicleType: vehicleType || undefined,
        search: searchTerm || undefined
      });
      if (response.success) {
        setMechanics(response.data.mechanics);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load mechanics:', error);
      toast.error('Failed to load mechanics');
    } finally {
      setIsLoading(false);
    }
  };

  const changeVerification = async (id, status) => {
    try {
      await adminAPI.setMechanicVerification(id, status);
      toast.success(`Mechanic ${status}`);
      loadMechanics();
    } catch (e) { toast.error('Failed'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-white rounded-xl shadow-soft p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Mechanics Management</h2>
        <button onClick={loadMechanics} className="btn btn-outline flex items-center space-x-2">
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search mechanics..."
            className="input w-full pl-10"
          />
        </div>
        <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)} className="input">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="input">
          <option value="">All Vehicle Types</option>
          <option value="bike">Bike</option>
          <option value="car">Car</option>
          <option value="truck">Truck</option>
          <option value="bus">Bus</option>
          <option value="cng">CNG</option>
          <option value="rickshaw">Rickshaw</option>
        </select>
      </div>

      {/* Mechanics List */}
      <div className="space-y-3">
        {mechanics.map((mech) => (
          <div key={mech._id} className="p-4 rounded-xl border border-gray-200 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-600 font-semibold text-sm">{mech.userId?.name?.[0] || 'M'}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{mech.userId?.name}</p>
                  <p className="text-sm text-gray-600">{mech.userId?.email} · {mech.userId?.phone}</p>
                  <p className="text-xs text-gray-500">Vehicle: {mech.vehicleTypes?.join(', ')} · Skills: {mech.skills?.join(', ')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  mech.verificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                  mech.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>
                  {mech.verificationStatus.charAt(0).toUpperCase() + mech.verificationStatus.slice(1)}
                </span>
                {mech.verificationStatus !== 'verified' && (
                  <button
                    className="btn btn-ghost btn-sm p-1 text-emerald-600"
                    title="Approve"
                    onClick={() => changeVerification(mech._id, 'verified')}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {mech.verificationStatus !== 'rejected' && (
                  <button
                    className="btn btn-ghost btn-sm p-1 text-red-600"
                    title="Reject"
                    onClick={() => changeVerification(mech._id, 'rejected')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Garage and details */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
              <div>
                <p className="font-medium">Garage</p>
                <p>{mech.garage?.name}</p>
                <p className="text-gray-500">{mech.garage?.address}</p>
              </div>
              <div>
                <p className="font-medium">Experience</p>
                <p>{mech.experience} years</p>
              </div>
              <div>
                <p className="font-medium">Stats</p>
                <p>Rating {mech.rating} ({mech.totalRatings}) · Jobs {mech.completedJobs}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-6">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="btn btn-outline btn-sm disabled:opacity-50">Previous</button>
          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === currentPage ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{page}</button>
            ))}
          </div>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="btn btn-outline btn-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </motion.div>
  );
};

// Requests Management Component
const RequestsManagement = () => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [priority, setPriority] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, [currentPage, status, vehicleType, priority, startDate, endDate]);

  const load = async () => {
    try {
      setIsLoading(true);
      const response = await adminAPI.getRequests(currentPage, 10, {
        status: status || undefined,
        vehicleType: vehicleType || undefined,
        priority: priority || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      if (response.success) {
        setRequests(response.data.requests);
        setTotalPages(response.data.totalPages);
      }
    } catch (e) { console.error(e); toast.error('Failed to load requests'); }
    finally { setIsLoading(false); }
  };

  const setStatusAction = async (id, newStatus) => {
    try {
      await adminAPI.updateRequestStatus(id, newStatus);
      toast.success(`Request ${newStatus}`);
      load();
    } catch (e) { toast.error('Failed to update'); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white rounded-xl shadow-soft p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Requests Management</h2>
        <button onClick={load} className="btn btn-outline flex items-center space-x-2"><RefreshCw className="w-4 h-4" /><span>Refresh</span></button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
          <option value="">All Status</option>
          {['pending','accepted','in_progress','arrived','working','completed','cancelled','rejected','failed'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="input">
          <option value="">All Vehicle Types</option>
          {['bike','car','truck','bus','cng','rickshaw'].map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
          <option value="">All Priority</option>
          {['low','medium','high','emergency'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" className="input" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
        <input type="date" className="input" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900">Created</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Mechanic</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Vehicle</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Problem</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Priority</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r)=> (
              <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-600">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{r.userId?.name}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{r.mechanicId?.userId?.name || '-'}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{r.vehicleType}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{r.problemType}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{r.status.replace('_',' ')}</span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-900">{r.priority}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <button className="btn btn-ghost btn-sm p-1" title="View Details" onClick={() => setSelected(r)}>
                      <Eye className="w-4 h-4" />
                    </button>
                    {r.status !== 'completed' && (
                      <button className="btn btn-ghost btn-sm p-1 text-emerald-600" title="Mark Completed" onClick={() => setStatusAction(r._id, 'completed')}><Check className="w-4 h-4" /></button>
                    )}
                    {r.status !== 'cancelled' && (
                      <button className="btn btn-ghost btn-sm p-1 text-red-600" title="Cancel" onClick={() => setStatusAction(r._id, 'cancelled')}><X className="w-4 h-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-6">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="btn btn-outline btn-sm disabled:opacity-50">Previous</button>
          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === currentPage ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{page}</button>
            ))}
          </div>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="btn btn-outline btn-sm disabled:opacity-50">Next</button>
        </div>
      )}

      {/* Details Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Request Details</h3>
              <button className="btn btn-ghost p-1" onClick={() => setSelected(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">User</p>
                <p className="font-medium text-gray-900">{selected.userId?.name} ({selected.userId?.phone})</p>
              </div>
              <div>
                <p className="text-gray-500">Mechanic</p>
                <p className="font-medium text-gray-900">{selected.mechanicId?.userId?.name || '-'} </p>
              </div>
              <div>
                <p className="text-gray-500">Vehicle</p>
                <p className="font-medium text-gray-900">{selected.vehicleType}</p>
              </div>
              <div>
                <p className="text-gray-500">Problem</p>
                <p className="font-medium text-gray-900">{selected.problemType}</p>
              </div>
              <div>
                <p className="text-gray-500">Priority</p>
                <p className="font-medium text-gray-900">{selected.priority}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <p className="font-medium text-gray-900">{selected.status.replace('_',' ')}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-500">Description</p>
                <p className="font-medium text-gray-900">{selected.description}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-500">Location</p>
                <p className="font-medium text-gray-900">{selected.pickupLocation?.address}</p>
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Requested At</p>
                  <p className="font-medium text-gray-900">{selected.timeline?.requestedAt && new Date(selected.timeline.requestedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Completed At</p>
                  <p className="font-medium text-gray-900">{selected.timeline?.completedAt ? new Date(selected.timeline.completedAt).toLocaleString() : '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};


export default AdminDashboard;
// Admin Settings Component
const PromotionsManagement = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  // Helper function to get current datetime in local format
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [form, setForm] = useState({ 
    name: '', 
    code: '', 
    type: 'percent', 
    value: 10, 
    startsAt: getCurrentDateTimeLocal(), 
    endsAt: getCurrentDateTimeLocal(), 
    description: '' 
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  // Helper function to format date for datetime-local input
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
  };

  const load = async () => {
    try {
      setLoading(true);
      const items = await adminAPI.listPromotions();
      setPromotions(items);
    } catch (e) { toast.error('Failed to load promotions'); }
    finally { setLoading(false); }
  };

  const create = async () => {
    try {
      setSaving(true);
      
      // Debug: Log form data
      console.log('🔍 Form data before validation:', form);
      
      // Validate required fields
      if (!form.name.trim()) {
        toast.error('Promotion name is required');
        return;
      }
      if (!form.code.trim()) {
        toast.error('Promotion code is required');
        return;
      }
      // Validate dates
      if (!form.startsAt || form.startsAt.trim() === '') {
        toast.error('Start date is required');
        return;
      }
      if (!form.endsAt || form.endsAt.trim() === '') {
        toast.error('End date is required');
        return;
      }
      
      // Parse dates - handle both datetime-local format and regular date strings
      let startDate, endDate;
      
      try {
        // For datetime-local inputs, the value is in format: YYYY-MM-DDTHH:MM
        startDate = new Date(form.startsAt);
        endDate = new Date(form.endsAt);
        
        // Additional validation for datetime-local format
        if (form.startsAt.includes('T') && form.startsAt.length < 16) {
          toast.error('Please select both date and time for start date');
          return;
        }
        if (form.endsAt.includes('T') && form.endsAt.length < 16) {
          toast.error('Please select both date and time for end date');
          return;
        }
      } catch (error) {
        toast.error('Invalid date format');
        return;
      }
      
      if (isNaN(startDate.getTime())) {
        toast.error('Invalid start date format');
        return;
      }
      if (isNaN(endDate.getTime())) {
        toast.error('Invalid end date format');
        return;
      }
      if (startDate >= endDate) {
        toast.error('End date must be after start date');
        return;
      }
      
      // Check if start date is in the past
      if (startDate < new Date()) {
        toast.error('Start date cannot be in the past');
        return;
      }
      if (form.value <= 0) {
        toast.error('Value must be greater than 0');
        return;
      }
      
      const payload = { 
        ...form, 
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        startsAt: startDate, 
        endsAt: endDate 
      };
      
      console.log('🔍 Promotion payload:', payload);
      
      await adminAPI.createPromotion(payload);
      toast.success('Promotion created successfully');
      setForm({ 
        name: '', 
        code: '', 
        type: 'percent', 
        value: 10, 
        startsAt: getCurrentDateTimeLocal(), 
        endsAt: getCurrentDateTimeLocal(), 
        description: '' 
      });
      load();
    } catch (e) { 
      console.error('Promotion creation error:', e);
      toast.error(e.message || 'Failed to create promotion');
    }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this promotion?')) return;
    try { await adminAPI.deletePromotion(id); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
              <Percent className="w-6 h-6 text-white" />
            </div>
            Promotions Management
          </h2>
          <p className="text-gray-600 mt-1">Create and manage promotional campaigns</p>
        </div>
        <button 
          onClick={load} 
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-all duration-200 hover:shadow-md"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Create Form */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 mb-8 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          Create New Promotion
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Promotion Name *</label>
            <input 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              placeholder="Enter promotion name" 
              value={form.name} 
              onChange={(e)=>setForm({ ...form, name: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Promotion Code *</label>
            <input 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              placeholder="e.g., SAVE20" 
              value={form.code} 
              onChange={(e)=>setForm({ ...form, code: e.target.value.toUpperCase() })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Type *</label>
            <select 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              value={form.type} 
              onChange={(e)=>setForm({ ...form, type: e.target.value })}
            >
              <option value="percent">Percentage Discount</option>
              <option value="flat">Fixed Amount</option>
              <option value="boost_supply">Boost Supply</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Value *</label>
            <input 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              type="number" 
              placeholder="Enter value" 
              value={form.value} 
              onChange={(e)=>setForm({ ...form, value: Number(e.target.value) })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Start Date *</label>
            <input 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              type="datetime-local" 
              value={form.startsAt} 
              onChange={(e)=>setForm({ ...form, startsAt: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">End Date *</label>
            <input 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              type="datetime-local" 
              value={form.endsAt} 
              onChange={(e)=>setForm({ ...form, endsAt: e.target.value })} 
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea 
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none" 
            rows="3"
            placeholder="Enter promotion description (optional)" 
            value={form.description} 
            onChange={(e)=>setForm({ ...form, description: e.target.value })} 
          />
        </div>
        <div className="mt-6">
          <button 
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={create} 
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Promotion
              </>
            )}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          Active Promotions ({promotions.length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <Percent className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No promotions yet</h4>
            <p className="text-gray-600">Create your first promotion to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {promotions.map((p) => {
              const isActive = new Date() >= new Date(p.startsAt) && new Date() <= new Date(p.endsAt);
              const isExpired = new Date() > new Date(p.endsAt);
              const isUpcoming = new Date() < new Date(p.startsAt);
              
              return (
                <div key={p._id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">{p.name}</h4>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                          {p.code}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          isActive ? 'bg-green-100 text-green-700' :
                          isExpired ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {isActive ? 'Active' : isExpired ? 'Expired' : 'Upcoming'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-6 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Percent className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Discount</p>
                            <p className="font-semibold text-gray-900">
                              {p.type === 'percent' ? `${p.value}% off` : 
                               p.type === 'flat' ? `৳${p.value} off` : 
                               'Boost supply'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Duration</p>
                            <p className="font-semibold text-gray-900">
                              {new Date(p.startsAt).toLocaleDateString()} - {new Date(p.endsAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {p.description && (
                        <p className="text-sm text-gray-600 mb-3">{p.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>ID: {p._id.slice(-8)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${p.name}"?`)) {
                            remove(p._id);
                          }
                        }}
                        title="Delete promotion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
const AdminSettings = () => {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [reason, setReason] = useState('Scheduled maintenance');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/admin/settings');
      if (res.data?.success) setSettings(res.data.data);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/settings', settings);
      toast.success('Settings saved');
    } catch (e) { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const startMaintenance = async () => {
    setConfirming(true);
    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Trigger maintenance
          api.post('/admin/maintenance/start', { reason })
            .then(() => { toast.success('Maintenance enabled'); load(); })
            .catch(() => toast.error('Failed to enable maintenance'))
            .finally(() => setConfirming(false));
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopMaintenance = async () => {
    try {
      await api.post('/admin/maintenance/stop');
      toast.success('Maintenance disabled');
      load();
    } catch (e) { toast.error('Failed to disable maintenance'); }
  };

  if (!settings) return <LoadingSpinner size="lg" text="Loading settings..." />;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          System Settings
        </h2>
        <p className="text-gray-600 mt-1">Configure platform settings and maintenance controls</p>
      </div>

      <div className="space-y-8">
        {/* General Settings */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            General Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Platform Name</label>
              <input 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
                value={settings.platformName || ''} 
                onChange={(e)=>setSettings({ ...settings, platformName: e.target.value })} 
                placeholder="Enter platform name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Commission Rate (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="100"
                  className="w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
                  value={((settings.commissionRate ?? 0)*100).toFixed(1)} 
                  onChange={(e)=>setSettings({ ...settings, commissionRate: Number(e.target.value)/100 })} 
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">SLA Target (minutes)</label>
              <input 
                type="number" 
                min="1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
                value={settings.slaMinutes || 0} 
                onChange={(e)=>setSettings({ ...settings, slaMinutes: Number(e.target.value) })} 
                placeholder="Enter SLA target in minutes"
              />
            </div>
            <div className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-gray-200">
              <input 
                id="verificationRequired" 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                checked={!!settings.verificationRequired} 
                onChange={(e)=>setSettings({ ...settings, verificationRequired: e.target.checked })} 
              />
              <label htmlFor="verificationRequired" className="text-sm font-medium text-gray-700">
                Require verification for mechanics
              </label>
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Maintenance Mode
            </h3>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${
              settings.maintenanceMode 
                ? 'bg-red-100 text-red-700' 
                : 'bg-green-100 text-green-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                settings.maintenanceMode ? 'bg-red-500' : 'bg-green-500'
              }`}></div>
              {settings.maintenanceMode ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          {settings.maintenanceMode ? (
            <div className="bg-white rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Service is currently in maintenance</p>
                  <p className="text-sm text-gray-600">Only administrators have access to the platform</p>
                </div>
                <button 
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all duration-200 hover:shadow-md"
                  onClick={stopMaintenance}
                >
                  Disable Maintenance
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maintenance Reason (optional)</label>
                  <input 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200" 
                    value={reason} 
                    onChange={(e)=>setReason(e.target.value)} 
                    placeholder="Enter reason for maintenance"
                  />
                </div>
                <button 
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 hover:shadow-md"
                  onClick={startMaintenance}
                >
                  Enable Maintenance Mode
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <button 
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {/* Confirmation dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirming(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Enable Maintenance Mode?</h3>
            <p className="text-sm text-gray-600 mb-4">All regular users and mechanics will be blocked. Admins retain full access. Activation in <span className="font-semibold text-red-600">{countdown}s</span>.</p>
            <div className="flex items-center justify-end space-x-3">
              <button className="btn btn-outline" onClick={()=>setConfirming(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>setCountdown(1)}>Activate Now</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
