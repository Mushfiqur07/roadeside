import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requestsAPI } from '../../api/requests';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Wrench, 
  CheckCircle, 
  Clock, 
  User,
  List,
  Settings
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../../components/LoadingSpinner';

const SimpleMechanicDashboard = () => {
  const { getUserName } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRequests: 0,
    completedRequests: 0,
    activeRequests: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setIsLoading(true);
      
      // Load mechanic request statistics
      const response = await requestsAPI.getMechanicStats();
      console.log('Mechanic stats response:', response);
      
      if (response.success) {
        setStats({
          totalRequests: response.data.totalRequests || 0,
          completedRequests: response.data.completedRequests || 0,
          activeRequests: response.data.activeRequests || 0
        });
        console.log('Stats loaded successfully:', response.data);
      } else {
        console.log('No stats available - this is normal for new mechanics');
        // Keep default stats for new mechanics
        setStats({
          totalRequests: 0,
          completedRequests: 0,
          activeRequests: 0
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      
      // Don't show error toast for new mechanics - just use default stats
      if (error.response?.status === 404 || error.message?.includes('profile not found')) {
        console.log('Mechanic profile not found - using default stats for new mechanic');
      } else if (error.response?.status === 403) {
        toast.error('Authentication failed. Please try logging in again.');
        navigate('/login');
      } else {
        toast.error('Failed to load dashboard statistics');
      }
      
      // Always set default stats on error
      setStats({
        totalRequests: 0,
        completedRequests: 0,
        activeRequests: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {getUserName()}!
              </h1>
              <p className="text-gray-600 mt-1">Mechanic Dashboard</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">{getUserName()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Chat UI removed from default dashboard per state-based visibility */}
        {/* 3 Required Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Requests Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-xl p-6 shadow-sm border"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Requests</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalRequests}</p>
                <p className="text-sm text-gray-500 mt-1">All time requests</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3">
                <Wrench className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </motion.div>

          {/* Completed Requests Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Requests</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.completedRequests}</p>
                <p className="text-sm text-gray-500 mt-1">Successfully completed</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </motion.div>

          {/* Active Requests Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-sm border"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Requests</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeRequests}</p>
                <p className="text-sm text-gray-500 mt-1">Currently in progress</p>
              </div>
              <div className="bg-orange-100 rounded-lg p-3">
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            onClick={() => navigate('/mechanic/requests')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-6 text-left transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Manage Requests</h3>
                <p className="text-blue-100">Accept, reject and track service requests</p>
              </div>
              <List className="w-8 h-8 text-blue-200" />
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            onClick={() => navigate('/mechanic/profile')}
            className="bg-gray-600 hover:bg-gray-700 text-white rounded-xl p-6 text-left transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Profile Settings</h3>
                <p className="text-gray-100">Update your profile and availability</p>
              </div>
              <Settings className="w-8 h-8 text-gray-200" />
            </div>
          </motion.button>
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 bg-white rounded-xl shadow-sm border"
        >
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-medium">
                      {stats.totalRequests > 0 
                        ? Math.round((stats.completedRequests / stats.totalRequests) * 100)
                        : 0
                      }%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Active Jobs</span>
                    <span className="font-medium">{stats.activeRequests}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Account Status</span>
                    <span className="font-medium text-green-600">Active</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Availability</span>
                    <span className="font-medium text-blue-600">Available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SimpleMechanicDashboard;
