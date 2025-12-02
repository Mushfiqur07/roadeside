import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Wrench, 
  History, 
  MapPin,
  User as UserIcon,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Car,
  Truck,
  Bike
} from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

const UserDashboard = () => {
  const { user, getUserName } = useAuth();
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentActivity();
  }, [user]);

  const loadRecentActivity = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/requests/user/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 5, page: 1 }
        }
      );
      
      if (response.data.success) {
        setRecentActivity(response.data.data.requests);
      }
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  const getVehicleIcon = (vehicleType) => {
    switch (vehicleType) {
      case 'car':
        return <Car className="w-4 h-4" />;
      case 'truck':
        return <Truck className="w-4 h-4" />;
      case 'bike':
        return <Bike className="w-4 h-4" />;
      default:
        return <Car className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

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
              <p className="text-gray-600 mt-1">Ready to help you on the road</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-primary-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">{getUserName()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Find Mechanic Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link
              to="/find-mechanics"
              className="block bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-lg p-3">
                  <Wrench className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Find Mechanic</h3>
                  <p className="text-blue-100 mt-1">Browse nearby services</p>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Request History Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Link
              to="/user/requests"
              className="block bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl p-6 text-white hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-lg p-3">
                  <History className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Request History</h3>
                  <p className="text-gray-100 mt-1">View past services</p>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Welcome Message for Users */}
        <div className="mt-8">
          <div className="bg-white rounded-xl p-8 shadow-sm border text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Need Roadside Assistance?</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Find qualified mechanics near you for quick and reliable roadside assistance. 
              From tire changes to engine repairs, we've got you covered.
            </p>
            <Link
              to="/find-mechanics"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              <Wrench className="w-5 h-5 mr-2" />
              Find Nearby Mechanics
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8 bg-white rounded-xl shadow-sm border"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <Link
                to="/user/requests"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </Link>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity</p>
                <p className="text-sm text-gray-400 mt-1">Your service requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity._id}
                    className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="flex-shrink-0">
                      {getStatusIcon(activity.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="flex items-center space-x-1 text-gray-600">
                          {getVehicleIcon(activity.vehicleType)}
                          <span className="text-sm capitalize">{activity.vehicleType}</span>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {activity.problemType?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(activity.createdAt)}
                        {activity.actualCost && (
                          <span className="ml-2">• ৳{activity.actualCost}</span>
                        )}
                      </p>
                    </div>
                    {activity.mechanicId && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-500">Mechanic</p>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.mechanicId.userId?.name || 'Unknown'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UserDashboard;
