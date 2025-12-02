import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useLocation } from '../../context/LocationContext';
import axios from 'axios';
import { historyAPI } from '../../api/history';
import { 
  Wrench, 
  CheckCircle, 
  Clock, 
  MapPin,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  User,
  Eye,
  Building2,
  Calendar,
  Star,
  RefreshCw,
  Car,
  Bike,
  Truck,
  Phone
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import Map from '../../components/Map';
import LoadingSpinner from '../../components/LoadingSpinner';

const MechanicDashboard = () => {
  const { user, mechanic } = useAuth();
  const { socket, isConnected } = useSocket();
  const { currentLocation, getCurrentLocation } = useLocation();
  
  const [isAvailable, setIsAvailable] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    completedRequests: 0,
    rating: 0,
    earnings: 0,
    activeRequests: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const [walletSummary, setWalletSummary] = useState({ totalJobs: 0, earnings: 0, avgRating: 0 });

  useEffect(() => {
    loadDashboardData();
    
    // Socket.IO event listeners
    if (socket && isConnected) {
      console.log('Setting up Socket.IO event listeners for mechanic dashboard');
      
      // Listen for new request notifications (matches backend event name)
      socket.on('new_request_notification', handleNewRequest);
      
      // Listen for request status updates
      socket.on('request_status_update', handleRequestStatusUpdate);
      
      // Listen for request unavailable
      socket.on('request_unavailable', handleRequestUnavailable);
      
      // Listen for request cancelled
      socket.on('request_cancelled', handleRequestCancelled);
      
      // Listen for payment received
      socket.on('payment_received', handlePaymentReceived);
      // Availability ack feedback
      socket.on('availability_updated', (data) => {
        if (typeof data?.isAvailable === 'boolean') {
          setIsAvailable(data.isAvailable);
        }
      });
      
      // Join mechanic room for broadcasts
      socket.emit('join_mechanic_room');
      
      console.log('Socket.IO event listeners set up successfully');
      
      return () => {
        console.log('Cleaning up Socket.IO event listeners');
        socket.off('new_request_notification', handleNewRequest);
        socket.off('request_status_update', handleRequestStatusUpdate);
        socket.off('request_unavailable', handleRequestUnavailable);
        socket.off('request_cancelled', handleRequestCancelled);
        socket.off('payment_received', handlePaymentReceived);
        socket.off('availability_updated');
      };
    } else {
      console.log('Socket not connected, event listeners not set up');
    }
  }, [socket, isConnected]);

  useEffect(() => {
    if (mechanic) {
      setIsAvailable(mechanic.isAvailable);
    }
  }, [mechanic]);

  useEffect(() => {
    // Start location sharing if available and connected
    if (isAvailable && isConnected && currentLocation) {
      startLocationSharing();
    } else {
      stopLocationSharing();
    }
  }, [isAvailable, isConnected, currentLocation]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load requests and stats
      if (user?._id) {
        const token = localStorage.getItem('token');
        
        console.log('Loading mechanic dashboard data for user:', user._id);
        console.log('API URL:', `${process.env.REACT_APP_API_URL}/requests/mechanic/history`);
        
        // First, test basic backend connectivity
        try {
          console.log('Testing backend connectivity...');
          const healthCheck = await axios.get(`${process.env.REACT_APP_API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('Backend health check successful:', healthCheck.data);
        } catch (healthError) {
          console.error('Backend health check failed:', healthError);
          toast.error('Cannot connect to backend server. Please check if the server is running.');
          return;
        }
        
        try {
          const requestsResponse = await axios.get(`${process.env.REACT_APP_API_URL}/requests/mechanic/history`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 50, page: 1 }
          });
          
          console.log('Requests response:', requestsResponse.data);
          
          if (requestsResponse.data.success) {
            const requests = requestsResponse.data.data.requests;
            
            // Separate pending and active requests
            const pending = requests.filter(req => req.status === 'pending' || req.status === 'open');
            const active = requests.filter(req => 
              ['accepted', 'in_progress', 'arrived', 'working'].includes(req.status)
            );
            
            setPendingRequests(pending);
            setActiveRequests(active);
            
            // Calculate stats
            const completed = requests.filter(req => req.status === 'completed');
            const totalEarnings = completed.reduce((sum, req) => sum + (req.actualCost || 0), 0);
            
            setStats({
              totalRequests: requests.length,
              completedRequests: completed.length,
              rating: mechanic?.rating || 0,
              earnings: totalEarnings,
              activeRequests: active.length
            });

            // Load wallet summary (earnings to-date)
            try {
              const summary = await historyAPI.getMechanicSummary();
              if (summary?.success) {
                setWalletSummary(summary.data);
              }
            } catch {}
            
            console.log('Dashboard data loaded successfully:', {
              total: requests.length,
              pending: pending.length,
              active: active.length,
              completed: completed.length
            });
            
            // Clear any previous error messages
            toast.dismiss();
            
            // Show welcome message for new mechanics
            if (stats.totalRequests === 0 && mechanic?.verificationStatus === 'verified') {
              toast.success('Welcome! You are now online and ready to receive service requests.', {
                duration: 8000
              });
            }
          } else {
            console.error('API returned success: false', requestsResponse.data);
            toast.error(requestsResponse.data.message || 'Failed to load dashboard data');
          }
        } catch (apiError) {
          console.error('API request failed:', apiError);
          console.error('Error response:', apiError.response?.data);
          console.error('Error status:', apiError.response?.status);
          
          if (apiError.response?.status === 404) {
            console.log('Mechanic profile not found - this is normal for new mechanics');
            // Set empty data for new mechanics
            setPendingRequests([]);
            setActiveRequests([]);
            setStats({
              totalRequests: 0,
              completedRequests: 0,
              rating: 0,
              earnings: 0
            });
            toast.info('Welcome! Your mechanic profile is ready. You will receive requests when users need service.');
          } else if (apiError.response?.status === 500) {
            toast.error('Server error loading dashboard. Backend may need to be restarted.');
          } else {
            toast.error(apiError.response?.data?.message || 'Failed to load dashboard data');
          }
        }
      } else {
        console.error('No user ID available for loading dashboard data');
        toast.error('User information not available. Please try logging in again.');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Utility: Haversine distance (km)
  const computeDistanceKm = (from, to) => {
    if (!from || !to) return null;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const sendEtaForRequest = (request) => {
    if (!socket) return;
    const mech = currentLocation?.coordinates
      ? { lat: currentLocation.coordinates[1], lng: currentLocation.coordinates[0] }
      : null;
    const pickup = request?.pickupLocation?.coordinates
      ? { lat: request.pickupLocation.coordinates[1], lng: request.pickupLocation.coordinates[0] }
      : null;
    const distanceKm = computeDistanceKm(mech, pickup);
    if (distanceKm == null) {
      toast.error('Location not available to compute ETA');
      return;
    }
    const avgSpeedKph = 25; // conservative city speed
    const etaMinutes = Math.max(1, Math.round((distanceKm / avgSpeedKph) * 60));
    socket.emit('mechanic:eta_update', {
      requestId: request._id,
      etaMinutes,
      distanceKm,
      speedKph: avgSpeedKph
    });
    toast.success(`ETA sent: ${etaMinutes} min (${distanceKm.toFixed(1)} km)`);
  };

  const handleNewRequest = (data) => {
    console.log('🔔 NEW REQUEST NOTIFICATION RECEIVED:', data);
    
    if (data.request) {
      // Show notification
      toast.success(`New ${data.request.problemType?.replace('_', ' ')} request available!`, {
        duration: 5000,
        icon: '🔧'
      });
      
      // Add to pending requests if not already there
      setPendingRequests(prev => {
        const exists = prev.find(req => req._id === data.request._id);
        if (!exists) {
          console.log('Adding new request to pending list:', data.request._id);
          return [data.request, ...prev];
        }
        console.log('Request already exists in pending list');
        return prev;
      });
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1
      }));
      
      // Refresh dashboard data to get latest info
      setTimeout(() => {
        console.log('Refreshing dashboard data after new request');
        loadDashboardData();
      }, 1000);
    } else {
      console.error('New request notification missing request data:', data);
    }
  };

  const handleRequestStatusUpdate = (data) => {
    console.log('Request status update:', data);
    toast.info(data.message || 'Request status updated');
    
    // Update requests in state
    const updateRequestInState = (requestId, updatedRequest) => {
      setPendingRequests(prev => prev.map(req => 
        req._id === requestId ? updatedRequest : req
      ));
      setActiveRequests(prev => prev.map(req => 
        req._id === requestId ? updatedRequest : req
      ));
    };
    
    if (data.request) {
      updateRequestInState(data.request._id, data.request);
    }
    
    // Refresh dashboard data
    loadDashboardData();
  };

  const handleRequestUnavailable = (data) => {
    console.log('Request unavailable:', data);
    
    // Remove from pending requests
    setPendingRequests(prev => prev.filter(req => req._id !== data.requestId));
    toast.info('A request is no longer available');
  };

  const handleRequestCancelled = (data) => {
    setPendingRequests(prev => prev.filter(req => req._id !== data.requestId));
    setActiveRequests(prev => prev.filter(req => req._id !== data.requestId));
    toast.info('A request has been cancelled');
  };

  const handlePaymentReceived = (data) => {
    toast.success(`Payment received: ৳${data.payment.amount}`);
    // Refresh stats
    loadDashboardData();
  };

  const toggleAvailability = async () => {
    try {
      setIsTogglingAvailability(true);
      
      if (!isAvailable && !currentLocation) {
        // Get current location before going online
        await getCurrentLocation();
      }
      
      // Use existing REST endpoint
      const token = localStorage.getItem('token');
      const payload = {
        isAvailable: !isAvailable,
        ...(currentLocation?.coordinates ? {
          currentLocation: {
            type: 'Point',
            coordinates: currentLocation.coordinates,
            lastUpdated: new Date().toISOString()
          }
        } : {})
      };
      const response = await axios.put(`${process.env.REACT_APP_API_URL}/mechanics/availability`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.success) {
        setIsAvailable(response.data.data?.mechanic?.isAvailable ?? !isAvailable);
        toast.success(`You are now ${response.data.data?.mechanic?.isAvailable ? 'available' : 'offline'}`);
        // Also notify via socket (normalized event)
        socket && socket.emit('toggle_availability', { isAvailable: response.data.data?.mechanic?.isAvailable });
      } else {
        toast.error(response.data?.message || 'Failed to update availability');
      }
    } catch (error) {
      console.error('Failed to toggle availability:', error);
      toast.error('Failed to update availability');
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const startLocationSharing = () => {
    if (locationSharing) return;
    
    setLocationSharing(true);
    
    // Share location every 30 seconds
    const locationInterval = setInterval(async () => {
      if (currentLocation && isAvailable) {
        try {
          const token = localStorage.getItem('token');
          await axios.put(`${process.env.REACT_APP_API_URL}/mechanics/location`, { coordinates: currentLocation.coordinates }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          socket && socket.emit('mechanic:location_update', {
            coordinates: currentLocation.coordinates,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to update location:', error);
        }
      }
    }, 30000);

    // Store interval ID for cleanup
    window.mechanicLocationInterval = locationInterval;
  };

  const stopLocationSharing = () => {
    if (window.mechanicLocationInterval) {
      clearInterval(window.mechanicLocationInterval);
      window.mechanicLocationInterval = null;
    }
    setLocationSharing(false);
  };

  const acceptRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/requests/${requestId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Request accepted successfully!');
        
        // Move request from pending to active
        const acceptedRequest = response.data.data.request;
        setPendingRequests(prev => prev.filter(req => req._id !== requestId));
        setActiveRequests(prev => [acceptedRequest, ...prev]);
        
        // Refresh dashboard data
        loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to accept request:', error);
      const errorMessage = error.response?.data?.message || 'Failed to accept request';
      toast.error(errorMessage);
    }
  };

  const rejectRequest = async (requestId, reason = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/requests/${requestId}/reject`,
        { reason },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success('Request rejected');
        
        // Remove from pending requests
        setPendingRequests(prev => prev.filter(req => req._id !== requestId));
        
        // Refresh dashboard data
        loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to reject request:', error);
      const errorMessage = error.response?.data?.message || 'Failed to reject request';
      toast.error(errorMessage);
    }
  };

  const updateRequestStatus = async (requestId, status, location = null) => {
    try {
      const token = localStorage.getItem('token');
      const payload = { status };
      
      if (location) {
        payload.location = location;
      }

      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/requests/${requestId}/status`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        const statusMessages = {
          'in_progress': 'Status updated: On the way',
          'arrived': 'Status updated: Arrived at location',
          'working': 'Status updated: Working on vehicle',
          'completed': 'Service completed successfully!'
        };
        
        toast.success(statusMessages[status] || 'Status updated');
        
        // Update request in active requests
        const updatedRequest = response.data.data.request;
        setActiveRequests(prev => prev.map(req => 
          req._id === requestId ? updatedRequest : req
        ));
        
        // If completed, remove from active requests
        if (status === 'completed') {
          setActiveRequests(prev => prev.filter(req => req._id !== requestId));
        }
        
        // Refresh dashboard data
        loadDashboardData();
      }
    } catch (error) {
      console.error('Failed to update request status:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update status';
      toast.error(errorMessage);
    }
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

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-100',
      accepted: 'text-blue-600 bg-blue-100',
      in_progress: 'text-purple-600 bg-purple-100',
      arrived: 'text-green-600 bg-green-100',
      working: 'text-orange-600 bg-orange-100',
      completed: 'text-green-600 bg-green-100',
      cancelled: 'text-red-600 bg-red-100'
    };
    return colors[status] || colors.pending;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mechanic Dashboard</h1>
              <p className="text-gray-600">Manage your availability and service requests</p>
            </div>
            
            {/* Availability Toggle */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                  {isAvailable ? 'Available' : 'Offline'}
                </span>
                <button
                  onClick={toggleAvailability}
                  disabled={isTogglingAvailability}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isAvailable ? 'bg-primary-500' : 'bg-gray-200'
                  }`}
                >
                  {isTogglingAvailability ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isAvailable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  )}
                </button>
              </div>
              
              <div className={`flex items-center space-x-2 text-sm ${
                isConnected ? 'text-green-600' : 'text-red-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedRequests}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rating</p>
                <div className="flex items-center space-x-1">
                  <p className="text-2xl font-bold text-gray-900">{stats.rating}</p>
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                </div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeRequests}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Earnings</p>
                <p className="text-2xl font-bold text-gray-900">৳{stats.earnings}</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Wallet Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid grid-cols-1 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Wallet Summary</h3>
              <span className="text-xs text-gray-400">to-date</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-xl font-bold text-gray-900">{walletSummary.totalJobs || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Earnings</p>
                <p className="text-xl font-bold text-gray-900">৳{walletSummary.earnings || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Rating</p>
                <p className="text-xl font-bold text-gray-900">{(walletSummary.avgRating || 0).toFixed(1)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Requests */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-xl shadow-soft p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Pending Requests ({pendingRequests.length})
              </h2>
              <button
                onClick={loadDashboardData}
                className="btn btn-ghost p-2"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No pending requests</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {isAvailable ? 'Waiting for new requests...' : 'Go online to receive requests'}
                  </p>
                </div>
              ) : (
                pendingRequests.map((request) => {
                  const VehicleIcon = getVehicleIcon(request.vehicleType);
                  const capacityReached = (mechanic?.maxConcurrentJobs || 1) <= stats.activeRequests;
                  
                  return (
                    <div key={request._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <VehicleIcon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 capitalize">
                              {request.problemType?.replace('_', ' ')}
                            </h3>
                            <p className="text-sm text-gray-600">{request.description}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          request.priority === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {request.priority}
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-xs">{request.pickupLocation.address}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(request.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => acceptRequest(request._id)}
                          disabled={capacityReached}
                          className={`flex-1 btn btn-primary btn-sm ${capacityReached ? 'btn-disabled opacity-60 cursor-not-allowed' : ''}`}
                          title={capacityReached ? 'Capacity reached' : 'Accept this request'}
                        >
                          {capacityReached ? 'At Capacity' : 'Accept'}
                        </button>
                        <button
                          onClick={() => rejectRequest(request._id)}
                          className="flex-1 btn btn-outline btn-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Active Requests */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white rounded-xl shadow-soft p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Active Requests ({activeRequests.length})
              </h2>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {activeRequests.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No active requests</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Accept pending requests to start working
                  </p>
                </div>
              ) : (
                activeRequests.map((request) => {
                  const VehicleIcon = getVehicleIcon(request.vehicleType);
                  const statusColor = getStatusColor(request.status);
                  
                  return (
                    <div key={request._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <VehicleIcon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 capitalize">
                              {request.problemType?.replace('_', ' ')}
                            </h3>
                            <p className="text-sm text-gray-600">{request.userId?.name}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <div className="flex items-center space-x-1">
                          <Phone className="w-4 h-4" />
                          <a 
                            href={`tel:${request.userId?.phone}`}
                            className="text-primary-600 hover:text-primary-700"
                          >
                            {request.userId?.phone}
                          </a>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-xs">{request.pickupLocation.address}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {request.status === 'accepted' && (
                          <button
                            onClick={() => updateRequestStatus(request._id, 'in_progress')}
                            className="flex-1 btn btn-primary btn-sm"
                          >
                            Start Journey
                          </button>
                        )}
                        {request.status === 'in_progress' && (
                          <button
                            onClick={() => updateRequestStatus(request._id, 'arrived')}
                            className="flex-1 btn btn-primary btn-sm"
                          >
                            Mark Arrived
                          </button>
                        )}
                        {['accepted','in_progress'].includes(request.status) && (
                          <button
                            onClick={() => sendEtaForRequest(request)}
                            className="flex-1 btn btn-outline btn-sm"
                          >
                            Send ETA
                          </button>
                        )}
                        {request.status === 'arrived' && (
                          <button
                            onClick={() => updateRequestStatus(request._id, 'working')}
                            className="flex-1 btn btn-primary btn-sm"
                          >
                            Start Work
                          </button>
                        )}
                        {request.status === 'working' && (
                          <button
                            onClick={() => updateRequestStatus(request._id, 'completed')}
                            className="flex-1 btn btn-success btn-sm"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => window.open(`/request/${request._id}`, '_blank')}
                          className="btn btn-ghost btn-sm p-2"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Location Status */}
        {isAvailable && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-xl shadow-soft p-6 mt-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${locationSharing ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div>
                  <h3 className="font-medium text-gray-900">Location Sharing</h3>
                  <p className="text-sm text-gray-600">
                    {locationSharing 
                      ? 'Your location is being shared with customers' 
                      : 'Location sharing is disabled'
                    }
                  </p>
                </div>
              </div>
              
              {currentLocation && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Current Location</p>
                  <p className="font-medium text-gray-900">{currentLocation.address}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Garage Information */}
        {mechanic?.garage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-white rounded-xl shadow-soft p-6 mt-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                <span>Garage Information</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Garage Name</p>
                    <p className="font-medium">{mechanic.garage.name}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Garage Address</p>
                    <p className="font-medium">{mechanic.garage.address}</p>
                  </div>
                </div>
              </div>

              {mechanic.garage.location && mechanic.garage.location.coordinates && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Garage Location</p>
                  <div className="border rounded-lg overflow-hidden h-32">
                    <Map
                      center={[mechanic.garage.location.coordinates[1], mechanic.garage.location.coordinates[0]]}
                      zoom={15}
                      height="128px"
                      markers={[{
                        id: 'garage',
                        lat: mechanic.garage.location.coordinates[1],
                        lng: mechanic.garage.location.coordinates[0],
                        color: '#3B82F6',
                        size: 'medium',
                        popup: (
                          <div className="text-center">
                            <div className="flex items-center space-x-2 mb-2">
                              <Building2 className="w-4 h-4 text-blue-600" />
                              <span className="font-medium">{mechanic.garage.name}</span>
                            </div>
                            <p className="text-sm text-gray-600">{mechanic.garage.address}</p>
                          </div>
                        )
                      }]}
                      showUserLocation={false}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Coordinates: {mechanic.garage.location.coordinates[1].toFixed(6)}, {mechanic.garage.location.coordinates[0].toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MechanicDashboard;
