import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { requestsAPI } from '../api/requests';
import { RequestTrackingMap } from '../components/Map';
import { useLocation } from '../context/LocationContext';
import { 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle, 
  User, 
  Car,
  Navigation,
  Star,
  AlertCircle,
  DollarSign,
  Bike,
  Truck,
  ArrowLeft,
  CreditCard,
  MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentModal from '../components/PaymentModal';
import ChatWindow from '../components/ChatWindow';
import { getChatByRequest, createOrGetChatByRequest } from '../api/chat';
import toast from 'react-hot-toast';

// Icons are now handled by the RequestTrackingMap component

const RequestTracking = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { joinRequestRoom, on, off, isConnected, emit } = useSocket();
  const { currentLocation, getCurrentLocation } = useLocation();
  const navigate = useNavigate();
  
  const [request, setRequest] = useState(null);
  const [mechanicLocation, setMechanicLocation] = useState(null);
  const [etaInfo, setEtaInfo] = useState({ etaMinutes: null, distanceKm: null });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  // Payment UI state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [openRequestChat, setOpenRequestChat] = useState({ chatId: null });

  // Create stable reference for loadRequest to avoid useEffect dependency issues
  const loadRequestRef = useRef();

  // Define loadRequest first to avoid circular dependency
  const loadRequest = useCallback(async (isRetry = false) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      
      if (isRetry) {
        setRetryCount(prev => prev + 1);
      }
      
      const response = await requestsAPI.getRequestById(id);
      
      if (response.success) {
        const req = response.data.request;
        setRequest(req);
        setRetryCount(0); // Reset retry count on success
        
        // Seed initial mechanic location from request.mechanicId if available
        if (req.mechanicId) {
          const coords = (req.mechanicId.currentLocation && req.mechanicId.currentLocation.coordinates) ||
                         (req.mechanicId.garage && req.mechanicId.garage.location && req.mechanicId.garage.location.coordinates);
          if (coords && coords.length >= 2 && !(coords[0] === 0 && coords[1] === 0)) {
            setMechanicLocation({ lat: coords[1], lng: coords[0], coordinates: coords, timestamp: Date.now() });
          }
        }
        
        // If request is completed and no rating given, show rating modal
        if (req.status === 'completed' && 
            !req.rating?.userRating) {
          setShowRatingModal(true);
        }
      }
    } catch (error) {
      console.error('[RequestTracking] Failed to load request:', {
        id,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      setLoadError(error);
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        toast.error('Request not found');
        setTimeout(() => navigate('/dashboard'), 2000);
      } else if (error.response?.status === 401) {
        toast.error('Please login to view this request');
        setTimeout(() => navigate('/login'), 2000);
      } else if (error.code === 'ECONNABORTED') {
        // Don't show toast for timeout as it's handled by the API layer
        console.log('Request timeout - handled by retry logic');
      } else {
        // Only show error toast if not retrying
        if (!isRetry) {
          toast.error('Failed to load request details. Please check your connection.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  // Store loadRequest in ref for stable reference
  loadRequestRef.current = loadRequest;

  const handleLocationUpdate = useCallback((data) => {
    if (data.requestId === id) {
      const coords = data.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        setMechanicLocation({
          lat: coords[1],
          lng: coords[0],
          coordinates: coords,
          timestamp: data.timestamp || Date.now()
        });
      }
    }
  }, [id]);

  // Normalized location update handler
  const handleLocationUpdateNormalized = useCallback((data) => {
    if (data.requestId === id && data.location && typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
      setMechanicLocation({
        lat: data.location.lat,
        lng: data.location.lng,
        coordinates: [data.location.lng, data.location.lat],
        timestamp: data.timestamp || Date.now()
      });
    }
  }, [id]);

  const handleLocationStop = useCallback((data) => {
    if (data.requestId === id) {
      setMechanicLocation(null);
    }
  }, [id]);

  const handleEtaUpdate = useCallback((data) => {
    if (data.requestId === id) {
      setEtaInfo({
        etaMinutes: typeof data.etaMinutes === 'number' ? data.etaMinutes : null,
        distanceKm: typeof data.distanceKm === 'number' ? data.distanceKm : null
      });
    }
  }, [id]);

  const handleStatusUpdate = useCallback((data) => {
    if (data.requestId === id) {
      setRequest(prev => prev ? { ...prev, status: data.status } : null);
    }
  }, [id]);

  const handleRequestAccepted = useCallback((data) => {
    if (data.requestId === id) {
      loadRequestRef.current?.(); // Reload to get mechanic details
    }
  }, [id]);

  const handleMechanicArrived = useCallback((data) => {
    if (data.requestId === id) {
      setRequest(prev => prev ? { ...prev, status: 'arrived' } : null);
    }
  }, [id]);

  const handleServiceCompleted = useCallback((data) => {
    if (data.requestId === id) {
      setRequest(prev => prev ? { ...prev, status: 'completed' } : null);
      setShowRatingModal(true);
    }
  }, [id]);

  // Payment socket events
  const handlePaymentProcessing = useCallback((data) => {
    if (data.requestId === id) {
      setRequest(prev => prev ? { ...prev, paymentStatus: 'payment_processing' } : prev);
    }
  }, [id]);
  const handlePaymentCompleted = useCallback((data) => {
    if (data.requestId === id) {
      setRequest(prev => prev ? { ...prev, paymentStatus: 'payment_completed' } : prev);
      setShowPaymentModal(false);
      toast.success('Payment completed!');
    }
  }, [id]);
  const handlePaymentFailed = useCallback((data) => {
    if (data.requestId === id) {
      setRequest(prev => prev ? { ...prev, paymentStatus: 'payment_failed' } : prev);
      toast.error('Payment failed');
    }
  }, [id]);

  // Initial load effect - separate to avoid dependency issues
  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  // Socket room joining effect (separate from event listeners to avoid infinite loops)
  useEffect(() => {
    // Join the request room for real-time updates once socket is connected
    if (id && isConnected) {
      joinRequestRoom(id);
    }
  }, [id, isConnected]); // Removed joinRequestRoom from dependencies to prevent infinite loop

  // Location effect
  useEffect(() => {
    // Get user's current location for tracking
    if (!currentLocation) {
      getCurrentLocation();
    }
  }, [currentLocation, getCurrentLocation]);

  // Socket event listeners effect
  useEffect(() => {
    if (!isConnected) return;

    // Listen for real-time updates
    const unsubscribeLocationUpdate = on('mechanic_location_update', handleLocationUpdate);
    const unsubscribeLocationUpdateNorm = on('mechanic:location_update', handleLocationUpdateNormalized);
    const unsubscribeLocationStopNorm = on('mechanic:location_stop', handleLocationStop);
    const unsubscribeLocationStopLegacy = on('mechanicLocationStop', handleLocationStop);
    const unsubscribeStatusUpdate = on('request_status_changed', handleStatusUpdate);
    const unsubscribeAccepted = on('request_accepted', handleRequestAccepted);
    const unsubscribeArrived = on('mechanic_arrived', handleMechanicArrived);
    const unsubscribeCompleted = on('service_completed', handleServiceCompleted);
    const unsubscribeEta = on('request:eta_update', handleEtaUpdate);
    const unsubPayProc = on('request:payment_processing', handlePaymentProcessing);
    const unsubPayDone = on('request:payment_completed', handlePaymentCompleted);
    const unsubPayFail = on('request:payment_failed', handlePaymentFailed);

    return () => {
      unsubscribeLocationUpdate();
      unsubscribeStatusUpdate();
      unsubscribeAccepted();
      unsubscribeArrived();
      unsubscribeCompleted();
      unsubPayProc();
      unsubPayDone();
      unsubPayFail();
      unsubscribeEta();
      unsubscribeLocationUpdateNorm();
      unsubscribeLocationStopNorm();
      unsubscribeLocationStopLegacy();
    };
  }, [isConnected, on, handleLocationUpdate, handleLocationUpdateNormalized, handleLocationStop, handleEtaUpdate, handleStatusUpdate, handleRequestAccepted, handleMechanicArrived, handleServiceCompleted, handlePaymentProcessing, handlePaymentCompleted, handlePaymentFailed]);

  // loadRequest function moved above

  // Event handler functions moved above useEffect

  const handleRateService = async () => {
    try {
      await requestsAPI.rateRequest(id, rating, comment);
      toast.success('Rating submitted successfully!');
      setShowRatingModal(false);
      loadRequestRef.current?.();
    } catch (error) {
      console.error('Failed to submit rating:', error);
      toast.error('Failed to submit rating');
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      pending: {
        color: 'text-yellow-600 bg-yellow-100',
        icon: Clock,
        message: 'Looking for available mechanics...',
        description: 'Your request has been created and is being sent to nearby mechanics.'
      },
      accepted: {
        color: 'text-blue-600 bg-blue-100',
        icon: CheckCircle,
        message: 'Mechanic is on the way!',
        description: 'A mechanic has accepted your request and is heading to your location.'
      },
      in_progress: {
        color: 'text-purple-600 bg-purple-100',
        icon: Navigation,
        message: 'Mechanic is traveling to you',
        description: 'The mechanic is currently on their way to your location.'
      },
      arrived: {
        color: 'text-green-600 bg-green-100',
        icon: MapPin,
        message: 'Mechanic has arrived!',
        description: 'The mechanic is now at your location and ready to help.'
      },
      working: {
        color: 'text-orange-600 bg-orange-100',
        icon: AlertCircle,
        message: 'Service in progress',
        description: 'The mechanic is currently working on your vehicle.'
      },
      completed: {
        color: 'text-green-600 bg-green-100',
        icon: CheckCircle,
        message: 'Service completed!',
        description: 'The service has been completed successfully.'
      },
      cancelled: {
        color: 'text-red-600 bg-red-100',
        icon: AlertCircle,
        message: 'Request cancelled',
        description: 'This request has been cancelled.'
      },
      rejected: {
        color: 'text-red-600 bg-red-100',
        icon: AlertCircle,
        message: 'Request rejected',
        description: 'The request was rejected. Looking for other mechanics...'
      }
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading request details..." />
      </div>
    );
  }

  if (!request && !isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {loadError ? 'Failed to Load Request' : 'Request Not Found'}
          </h2>
          <p className="text-gray-600 mb-6">
            {loadError 
              ? 'There was an issue loading the request details. Please check your connection and try again.'
              : 'The request you\'re looking for doesn\'t exist or you don\'t have access to it.'
            }
          </p>
          
          {loadError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {loadError.code === 'ECONNABORTED' 
                  ? 'Request timed out. Please check your internet connection.'
                  : loadError.message || 'Network error occurred'
                }
              </p>
              {retryCount > 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Retry attempts: {retryCount}
                </p>
              )}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {loadError && (
              <button
                onClick={() => loadRequestRef.current?.(true)}
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Retrying...' : 'Retry'}
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-outline"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(request.status);
  const StatusIcon = statusInfo.icon;
  const VehicleIcon = getVehicleIcon(request.vehicleType);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center space-x-4 mb-4"
          >
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-ghost p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Request Tracking</h1>
              <p className="text-gray-600">Request ID: {request._id.slice(-8)}</p>
            </div>
          </motion.div>

          {/* Cancel Request Button - only show for pending/accepted requests (not when mechanic started journey) */}
          {['pending', 'accepted'].includes(request.status) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="bg-white rounded-xl shadow-soft p-6 mt-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Need to Cancel?</h3>
                  <p className="text-sm text-gray-600">You can cancel this request if needed</p>
                </div>
                <button
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to cancel this request?')) {
                      try {
                        await requestsAPI.cancelRequest(id, 'Cancelled by user');
                        toast.success('Request cancelled successfully');
                        loadRequestRef.current?.();
                      } catch (error) {
                        toast.error('Failed to cancel request');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Cancel Request
                </button>
              </div>
            </motion.div>
          )}

          {/* Journey Started Notice - when mechanic has started journey */}
          {['on_way', 'in_progress'].includes(request.status) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="bg-orange-50 border border-orange-200 rounded-xl shadow-soft p-6 mt-4"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Navigation className="w-8 h-8 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-900">Journey in Progress</h3>
                  <p className="text-sm text-orange-700">
                    {request.status === 'on_way' 
                      ? "Your mechanic is on the way. Cancellation is no longer available as the service has begun."
                      : "Your mechanic is working on your vehicle. Please contact them directly for any concerns."
                    }
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {request.status === 'completed' && request.paymentStatus !== 'payment_completed' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-xl shadow-soft p-6 mt-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Complete Payment</h3>
                  <p className="text-sm text-gray-600">Service completed successfully</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Service Total</span>
                  <span className="font-semibold text-gray-900">—</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Payment Status</span>
                  <span className="font-medium text-orange-600 capitalize">
                    {((request.paymentStatus && request.paymentStatus !== 'none') ? request.paymentStatus : 'payment_pending').replace('payment_','')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative group bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-3 overflow-hidden"
                  onClick={() => setShowPaymentModal(true)}
                >
                  {/* Animated background effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -top-1 -left-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-pulse"></div>
                  
                  {/* Button content */}
                  <div className="relative flex items-center space-x-3">
                    <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-semibold">Pay Now</span>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                  
                  {/* price badge removed per requirements */}
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white rounded-xl shadow-soft p-6 mb-8"
        >
          <div className="flex items-center space-x-4 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusInfo.color}`}>
              <StatusIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{statusInfo.message}</h2>
              <p className="text-gray-600">{statusInfo.description}</p>
              {(etaInfo.etaMinutes !== null || etaInfo.distanceKm !== null) && (
                <p className="text-sm text-gray-500 mt-1">
                  {etaInfo.distanceKm !== null && <span>{etaInfo.distanceKm} km away</span>}
                  {etaInfo.distanceKm !== null && etaInfo.etaMinutes !== null && <span> · </span>}
                  {etaInfo.etaMinutes !== null && <span>ETA {etaInfo.etaMinutes} min</span>}
                </p>
              )}
            </div>
          </div>

          {/* Timeline with Payment step */}
          <div className="flex items-center space-x-4 mt-6">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span>Requested</span>
                <span>Accepted</span>
                <span>Arrived</span>
                <span>Completed</span>
                <span>Payment</span>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-between">
                  {['pending', 'accepted', 'arrived', 'completed', 'payment'].map((status, index) => {
                    const stepStatuses = ['pending','accepted','in_progress','arrived','working','completed'];
                    const paymentDone = request.paymentStatus === 'payment_completed';
                    const isActive = status === 'payment' ? paymentDone : stepStatuses.indexOf(request.status) >= index;
                    const isCurrent = (
                      (index === 0 && request.status === 'pending') ||
                      (index === 1 && ['accepted', 'in_progress'].includes(request.status)) ||
                      (index === 2 && ['arrived', 'working'].includes(request.status)) ||
                      (index === 3 && request.status === 'completed' && !paymentDone) ||
                      (index === 4 && paymentDone)
                    );
                    
                    return (
                      <div
                        key={status}
                        className={`w-4 h-4 rounded-full border-2 ${
                          isActive 
                            ? isCurrent 
                              ? 'bg-primary-500 border-primary-500' 
                              : 'bg-green-500 border-green-500'
                            : 'bg-white border-gray-300'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Request Details */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-xl shadow-soft p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Details</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <VehicleIcon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Vehicle Type</p>
                  <p className="font-medium capitalize">{request.vehicleType}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Problem</p>
                  <p className="font-medium capitalize">{typeof request.problemType === 'string' ? request.problemType.replace('_', ' ') : request.problemType}</p>
                  <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">{request.pickupLocation.address}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Requested At</p>
                  <p className="font-medium">
                    {new Date(request.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {request.priority === 'emergency' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Emergency Request</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Mechanic Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white rounded-xl shadow-soft p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {request.mechanicId ? 'Assigned Mechanic' : 'Waiting for Mechanic'}
            </h3>

            {request.mechanicId ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">
                      {request.mechanicId.userId?.name?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {request.mechanicId.userId?.name}
                    </p>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">
                        {request.mechanicId.rating} ({request.mechanicId.totalRatings} reviews)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <a
                      href={`tel:${request.mechanicId.userId?.phone}`}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      {request.mechanicId.userId?.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Experience</p>
                    <p className="font-medium">{request.mechanicId.experience} years</p>
                  </div>
                </div>

                {request.estimatedCost > 0 && (
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Estimated Cost</p>
                      <p className="font-medium">৳{request.estimatedCost}</p>
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 mt-4">
                  <a
                    href={`tel:${request.mechanicId.userId?.phone}`}
                    className="flex-1 btn btn-primary flex items-center justify-center space-x-2"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Call Mechanic</span>
                  </a>
                  {(request.status === 'accepted' || request.status === 'in_progress' || request.status === 'arrived') && (
                    <button
                      onClick={async () => {
                        try {
                          const chat = await getChatByRequest(id).catch(async () => await createOrGetChatByRequest(id));
                          setOpenRequestChat({ chatId: chat._id });
                        } catch {}
                      }}
                      className="group relative bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
                      title="Open Chat"
                    >
                      <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      
                      {/* Professional pulse animation */}
                      <div className="absolute inset-0 bg-blue-400 rounded-full opacity-75 animate-ping"></div>
                      
                      {/* Subtle glow effect */}
                      <div className="absolute inset-0 bg-blue-400 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Looking for available mechanics...</p>
                <p className="text-sm text-gray-400 mt-2">
                  You'll be notified when a mechanic accepts your request
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Map */}
        {request.pickupLocation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-xl shadow-soft p-6 mt-8"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Real-time Location Tracking
            </h3>
            <div className="h-80 rounded-lg overflow-hidden">
              <RequestTrackingMap
                request={request}
                mechanicLocation={mechanicLocation}
                userLocation={currentLocation ? {
                  coordinates: currentLocation,
                  timestamp: Date.now()
                } : null}
                showUserCurrentLocation={true} // User sees their current location
              />
            </div>
            
            {/* Location info */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Pickup Location</span>
              </div>
              {currentLocation && (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Your Current Location</span>
                </div>
              )}
              {mechanicLocation && (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span>Mechanic Location</span>
                </div>
              )}
              {mechanicLocation && request.pickupLocation && (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-0.5 bg-blue-400"></div>
                  <span>Route to Pickup</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          amount={request.actualCost || request.estimatedCost || 0}
          requestId={id}
          minAmount={request.estimatedCostRange?.min || 0}
          maxAmount={request.estimatedCostRange?.max || 0}
          onPaymentSuccess={(paymentData) => {
            // Update request status
            setRequest(prev => prev ? { ...prev, paymentStatus: 'payment_completed' } : prev);
            
            // Emit socket event for real-time updates
            emit('payment:demo_complete', { 
              requestId: id, 
              method: paymentData.method, 
              transactionRef: paymentData.transactionId,
              amount: paymentData.amount
            });
            
            // Show success message
            toast.success('Payment completed successfully!');
          }}
          onPaymentError={(error) => {
            toast.error('Payment failed. Please try again.');
            setRequest(prev => prev ? { ...prev, paymentStatus: 'payment_failed' } : prev);
          }}
        />

        {/* Rating Modal */}
        {showRatingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Rate Your Service
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">How was your experience?</p>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`w-8 h-8 ${
                            star <= rating ? 'text-yellow-400' : 'text-gray-300'
                          } hover:text-yellow-400 transition-colors`}
                        >
                          <Star className="w-full h-full fill-current" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">
                      Comment (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="textarea w-full"
                      rows={3}
                      placeholder="Share your experience..."
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowRatingModal(false)}
                    className="flex-1 btn btn-outline"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleRateService}
                    className="flex-1 btn btn-primary"
                  >
                    Submit Rating
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {openRequestChat.chatId && (
        <div className="fixed bottom-4 right-4 z-50 w-[90vw] md:w-[420px] h-[60vh] md:h-96">
          <ChatWindow chatId={openRequestChat.chatId} onClose={() => setOpenRequestChat({ chatId: null })} />
        </div>
      )}
    </div>
  );
};

export default RequestTracking;
// Floating chat window container
// Render after main content
// Note: This is appended within the same component's return above in similar pages,
// but here we mount it at page root for consistency
