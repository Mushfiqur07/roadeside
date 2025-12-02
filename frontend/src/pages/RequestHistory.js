import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestsAPI } from '../api/requests';
import { 
  Clock, 
  MapPin, 
  Star, 
  Eye, 
  Filter,
  Calendar,
  Search,
  ChevronDown,
  Car,
  Bike,
  Truck,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const RequestHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const statusOptions = [
    { value: 'all', label: 'All Requests' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'arrived', label: 'Arrived' },
    { value: 'working', label: 'Working' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'rejected', label: 'Rejected' }
  ];

  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const response = await requestsAPI.getUserHistory(currentPage, 10);
      
      if (response.success) {
        const items = (response.data.requests || []);
        setRequests(items);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load request history:', error);
      toast.error('Failed to load request history');
    } finally {
      setIsLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = [...requests];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.problemType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.pickupLocation.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.mechanicId?.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const requestDate = new Date();

      filtered = filtered.filter(request => {
        const createdAt = new Date(request.createdAt);
        
        switch (dateFilter) {
          case 'today':
            return createdAt.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return createdAt >= weekAgo;
          case 'month':
            return createdAt.getMonth() === now.getMonth() && 
                   createdAt.getFullYear() === now.getFullYear();
          case 'year':
            return createdAt.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    }

    setFilteredRequests(filtered);
  };

  // Effects should come after the functions they reference to avoid TDZ issues
  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(() => {
    filterRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, searchTerm, statusFilter, dateFilter]);

  const getStatusInfo = (status) => {
    const statusMap = {
      pending: { color: 'text-yellow-600 bg-yellow-100', icon: Clock, label: 'Pending' },
      accepted: { color: 'text-blue-600 bg-blue-100', icon: CheckCircle, label: 'Accepted' },
      in_progress: { color: 'text-purple-600 bg-purple-100', icon: RefreshCw, label: 'In Progress' },
      arrived: { color: 'text-green-600 bg-green-100', icon: MapPin, label: 'Arrived' },
      working: { color: 'text-orange-600 bg-orange-100', icon: RefreshCw, label: 'Working' },
      completed: { color: 'text-green-600 bg-green-100', icon: CheckCircle, label: 'Completed' },
      cancelled: { color: 'text-red-600 bg-red-100', icon: XCircle, label: 'Cancelled' },
      rejected: { color: 'text-red-600 bg-red-100', icon: XCircle, label: 'Rejected' }
    };
    return statusMap[status] || statusMap.pending;
  };

  const getVehicleIcon = (vehicleType) => {
    const icons = {
      car: Car,
      bike: Bike,
      truck: Truck,
      bus: Car,
      cng: Car,
      rickshaw: Bike
    };
    return icons[vehicleType] || Car;
  };

  const handleViewRequest = (requestId) => {
    navigate(`/request/${requestId}`);
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    loadRequests();
  };

  if (isLoading && requests.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading request history..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Request History</h1>
              <p className="text-gray-600">View and manage your past service requests</p>
            </div>
            <button
              onClick={handleRefresh}
              className="btn btn-outline flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white rounded-xl shadow-soft p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search requests..."
                className="input w-full pl-10"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-outline flex items-center space-x-2"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 pt-4 border-t border-gray-200"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="select w-full"
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Range
                    </label>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="select w-full"
                    >
                      {dateOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Results Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6"
        >
          <p className="text-gray-600">
            Showing {filteredRequests.length} of {requests.length} requests
          </p>
        </motion.div>

        {/* Request List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-xl shadow-soft p-12 text-center"
            >
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Requests Found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'You haven\'t made any service requests yet'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && dateFilter === 'all' && (
                <button
                  onClick={() => navigate('/mechanics')}
                  className="btn btn-primary"
                >
                  Find Mechanics
                </button>
              )}
            </motion.div>
          ) : (
            filteredRequests.map((request, index) => {
              const statusInfo = getStatusInfo(request.status);
              const StatusIcon = statusInfo.icon;
              const VehicleIcon = getVehicleIcon(request.vehicleType);

              return (
                <motion.div
                  key={request._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 * index }}
                  className="bg-white rounded-xl shadow-soft p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <VehicleIcon className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 capitalize">
                              {typeof request.problemType === 'string' ? request.problemType.replace('_', ' ') : request.problemType}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              <span>{statusInfo.label}</span>
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{request.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-4 h-4" />
                              <span className="truncate max-w-xs">
                                {request.pickupLocation.address}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mechanic Info */}
                      {request.mechanicId && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-600 font-medium text-sm">
                                {request.mechanicId.userId?.name?.charAt(0)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {request.mechanicId.userId?.name}
                              </p>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                <span>{request.mechanicId.rating}</span>
                                <span>•</span>
                                <span>{request.mechanicId.experience} years exp.</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rating */}
                      {request.status === 'completed' && request.rating?.userRating && (
                        <div className="bg-green-50 rounded-lg p-4 mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm font-medium text-green-700">Your Rating:</span>
                            <div className="flex items-center space-x-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= request.rating.userRating
                                      ? 'text-yellow-400 fill-current'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {request.rating.userComment && (
                            <p className="text-sm text-gray-600">"{request.rating.userComment}"</p>
                          )}
                        </div>
                      )}

                      
                    </div>

                    {/* Actions */}
                    <div className="ml-4">
                      <button
                        onClick={() => handleViewRequest(request._id)}
                        className="btn btn-outline btn-sm flex items-center space-x-2"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center justify-center space-x-2 mt-8"
          >
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
          </motion.div>
        )}

        {/* Loading Overlay */}
        {isLoading && requests.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6">
              <LoadingSpinner size="md" text="Loading..." />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestHistory;
