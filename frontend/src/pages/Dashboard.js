import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
import RatingModal from '../components/RatingModal';
import PaymentModal from '../components/PaymentModal';
import { 
  MapPin, 
  Wrench, 
  Clock, 
  Plus,
  History,
  AlertCircle,
  CheckCircle,
  Car,
  Bike,
  Truck,
  Phone,
  Navigation,
  Star,
  CreditCard,
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { promotionsAPI, subscriptionAPI } from '../api/index';

const Dashboard = () => {
  const { user } = useAuth();
  const { currentLocation, getCurrentLocation, hasLocation } = useLocation();
  const { isConnected, on, off } = useSocket();
  const navigate = useNavigate();
  
  const [recentRequests, setRecentRequests] = useState([]);
  const [nearbyMechanics, setNearbyMechanics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRequests: 0,
    completedRequests: 0,
    activeRequests: 0
  });
  const [promotions, setPromotions] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Modal states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    loadDashboardData();
    
    // Listen for service completion events
    const unsubscribeServiceCompleted = on('service_completed', handleServiceCompleted);
    const unsubscribePaymentCompleted = on('payment_completed', handlePaymentCompleted);
    const unsubscribeRequestStatusChanged = on('request_status_changed', handleRequestStatusChanged);

    return () => {
      unsubscribeServiceCompleted();
      unsubscribePaymentCompleted();
      unsubscribeRequestStatusChanged();
    };
  }, [user, currentLocation]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Get current location if not available
      if (!hasLocation()) {
        await getCurrentLocation();
      }

      // Load recent requests
      if (user?._id) {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/requests/user/history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: { limit: 5, page: 1 }
          }
        );
        
        if (response.data.success) {
          setRecentRequests(response.data.data.requests);
          
          // Calculate stats
          const total = response.data.data.pagination.totalRequests;
          const completed = response.data.data.requests.filter(r => r.status === 'completed').length;
          const active = response.data.data.requests.filter(r => 
            ['pending', 'accepted', 'in_progress', 'arrived', 'working'].includes(r.status)
          ).length;
          
          setStats({
            totalRequests: total,
            completedRequests: completed,
            activeRequests: active
          });
        }
      }

      // Load nearby mechanics if location is available
      if (currentLocation) {
        const [longitude, latitude] = currentLocation.coordinates;
        const token = localStorage.getItem('token');
        const mechanicsResponse = await axios.get(
          `${process.env.REACT_APP_API_URL}/mechanics/nearby`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { 
              longitude, 
              latitude, 
              maxDistance: 5000 // 5km radius
            }
          }
        );
        
        if (mechanicsResponse.data.success) {
          setNearbyMechanics(mechanicsResponse.data.data.mechanics.slice(0, 6));
        }
      }

      // Load promotions and subscription
      try {
        const promosRes = await promotionsAPI.listActive();
        if (promosRes?.success) setPromotions(promosRes.data.promotions || []);
      } catch {}
      try {
        const subRes = await subscriptionAPI.get();
        if (subRes?.success) setSubscription(subRes.data.subscription || null);
      } catch {}
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setIsSubscribing(true);
      const res = await subscriptionAPI.create({ planId: 'basic', planName: 'Basic Membership', price: 299, period: 'monthly' });
      if (res?.success) {
        setSubscription(res.data.subscription);
        toast.success('Membership activated');
      }
    } catch (e) {
      toast.error('Failed to subscribe');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const res = await subscriptionAPI.cancel();
      if (res?.success) {
        setSubscription(res.data.subscription);
        toast.success('Membership cancelled');
      }
    } catch (e) {
      toast.error('Failed to cancel');
    }
  };

  const handleServiceCompleted = (data) => {
    // Show rating prompt for completed service
    const completedRequest = recentRequests.find(req => req._id === data.requestId);
    if (completedRequest && data.showRatingPrompt) {
      setSelectedRequest(completedRequest);
      setShowRatingModal(true);
    }
    
    // Refresh dashboard data
    loadDashboardData();
  };

  const handlePaymentCompleted = (data) => {
    toast.success('Payment completed successfully!');
    loadDashboardData();
  };

  const handleRequestStatusChanged = (data) => {
    // Update request status in real-time
    setRecentRequests(prev => 
      prev.map(req => 
        req._id === data.requestId 
          ? { ...req, status: data.status }
          : req
      )
    );
  };

  const handleRateService = (request) => {
    setSelectedRequest(request);
    setShowRatingModal(true);
  };

  const handlePayForService = (request) => {
    setSelectedRequest(request);
    setShowPaymentModal(true);
  };

  const handleRatingSubmitted = (updatedRequest) => {
    // Update the request in the list
    setRecentRequests(prev => 
      prev.map(req => 
        req._id === updatedRequest._id ? updatedRequest : req
      )
    );
    toast.success('Thank you for your feedback!');
  };

  const handlePaymentCompleted = (payment) => {
    // Update the request payment status
    setRecentRequests(prev => 
      prev.map(req => 
        req._id === payment.requestId 
          ? { ...req, paymentStatus: 'paid', actualCost: payment.paymentDetails.totalAmount }
          : req
      )
    );
  };

  const downloadInvoice = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      
      // First get payment details
      const paymentsResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/payments/user/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 }
        }
      );

      if (paymentsResponse.data.success) {
        const payment = paymentsResponse.data.data.payments.find(p => p.requestId._id === requestId);
        
        if (payment) {
          // Generate and download invoice
          const invoiceResponse = await axios.post(
            `${process.env.REACT_APP_API_URL}/payments/${payment._id}/generate-invoice`,
            {},
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          if (invoiceResponse.data.success) {
            const invoiceUrl = `${process.env.REACT_APP_API_URL.replace('/api', '')}${invoiceResponse.data.data.invoiceUrl}`;
            window.open(invoiceUrl, '_blank');
            toast.success('Invoice downloaded successfully!');
          }
        } else {
          toast.error('No payment found for this request');
        }
      }
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-100',
      accepted: 'text-blue-600 bg-blue-100',
      in_progress: 'text-purple-600 bg-purple-100',
      arrived: 'text-green-600 bg-green-100',
      working: 'text-orange-600 bg-orange-100',
      completed: 'text-green-600 bg-green-100',
      cancelled: 'text-red-600 bg-red-100',
      rejected: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
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
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-gray-600">
              {hasLocation() ? 'Ready to help you on the road' : 'Enable location to get started'}
            </p>
          </motion.div>

          {/* Connection Status */}
          <div className="mt-4 flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            {!hasLocation() && (
              <button
                onClick={getCurrentLocation}
                className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm hover:bg-yellow-200 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>Enable Location</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <button
            onClick={() => navigate('/find-mechanics?emergency=true')}
            className="bg-red-500 hover:bg-red-600 text-white p-6 rounded-xl shadow-soft transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-lg font-semibold mb-1">Emergency Help</h3>
                <p className="text-red-100 text-sm">Get immediate assistance</p>
              </div>
              <AlertCircle className="w-8 h-8" />
            </div>
          </button>

          <Link
            to="/find-mechanics"
            className="bg-primary-500 hover:bg-primary-600 text-white p-6 rounded-xl shadow-soft transition-colors block"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-lg font-semibold mb-1">Find Mechanics</h3>
                <p className="text-primary-100 text-sm">Browse nearby services</p>
              </div>
              <Wrench className="w-8 h-8" />
            </div>
          </Link>

          <Link
            to="/history"
            className="bg-gray-600 hover:bg-gray-700 text-white p-6 rounded-xl shadow-soft transition-colors block"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-lg font-semibold mb-1">Request History</h3>
                <p className="text-gray-100 text-sm">View past services</p>
              </div>
              <History className="w-8 h-8" />
            </div>
          </Link>
        </motion.div>

        {/* Membership & Promotions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-white p-6 rounded-xl shadow-soft md:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Membership</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                {subscription?.status === 'active' ? 'Active' : 'None'}
              </span>
            </div>
            {subscription?.status === 'active' ? (
              <div>
                <p className="text-sm text-gray-600">Plan: {subscription.planName} · ৳{subscription.price}/{subscription.period}</p>
                <p className="text-xs text-gray-500 mt-1">Valid until {subscription.endsAt && new Date(subscription.endsAt).toLocaleDateString()}</p>
                <button className="btn btn-outline btn-sm mt-3" onClick={handleCancelSubscription}>Cancel</button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Get priority response and discounts</p>
                <button className="btn btn-primary btn-sm mt-3" onClick={handleSubscribe} disabled={isSubscribing}>{isSubscribing ? 'Activating...' : 'Activate Membership'}</button>
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl shadow-soft md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Active Promotions</h3>
              <span className="text-xs text-gray-500">{promotions.length} available</span>
            </div>
            {promotions.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {promotions.map((p) => (
                  <div key={p._id} className="p-4 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900">{p.name} <span className="text-xs text-gray-500">({p.code})</span></p>
                    <p className="text-sm text-gray-600">{p.type === 'percent' ? `${p.value}% off` : p.type === 'flat' ? `৳${p.value} off` : 'Supply boost'}</p>
                    <p className="text-xs text-gray-500 mt-1">Ends {new Date(p.endsAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No promotions at the moment</p>
            )}
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        >
          <div className="bg-white p-6 rounded-xl shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedRequests}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Requests</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeRequests}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Requests */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white rounded-xl shadow-soft p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Recent Requests</h2>
              <Link
                to="/history"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View All
              </Link>
            </div>

            {recentRequests.length > 0 ? (
              <div className="space-y-4">
                {recentRequests.map((request) => {
                  const VehicleIcon = getVehicleIcon(request.vehicleType);
                  const statusColor = getStatusColor(request.status);
                  const isCompleted = request.status === 'completed';
                  const isPaid = request.paymentStatus === 'paid';
                  const hasRating = request.rating?.userRating > 0;

                  return (
                    <div
                      key={request._id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <VehicleIcon className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 capitalize">
                            {request.problemType?.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                          {request.mechanicId && (
                            <p className="text-sm text-gray-500">
                              Mechanic: {request.mechanicId.userId?.name}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {/* Status Badge */}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {request.status.replace('_', ' ')}
                        </span>

                        {/* Action Buttons for Completed Requests */}
                        {isCompleted && (
                          <div className="flex items-center space-x-2">
                            {/* Rating Button */}
                            {!hasRating ? (
                              <button
                                onClick={() => handleRateService(request)}
                                className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-200 transition-colors"
                              >
                                <Star className="w-3 h-3" />
                                <span>Rate</span>
                              </button>
                            ) : (
                              <div className="flex items-center space-x-1 text-yellow-600">
                                <Star className="w-3 h-3 fill-current" />
                                <span className="text-xs">{request.rating.userRating}</span>
                              </div>
                            )}

                            {/* Payment Button */}
                            {!isPaid ? (
                              <button
                                onClick={() => handlePayForService(request)}
                                className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>Pay</span>
                              </button>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-green-600 font-medium">Paid</span>
                                <button
                                  onClick={() => downloadInvoice(request._id)}
                                  className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Invoice</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* View Details Button */}
                        <Link
                          to={`/request/${request._id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recent requests</p>
                <p className="text-sm text-gray-400 mt-1">Your service history will appear here</p>
              </div>
            )}
          </motion.div>

          {/* Nearby Mechanics */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-xl shadow-soft p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nearby Mechanics</h2>
              <Link
                to="/find-mechanics"
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                View All
              </Link>
            </div>

            {nearbyMechanics.length > 0 ? (
              <div className="space-y-4">
                {nearbyMechanics.map((mechanic) => (
                  <div
                    key={mechanic._id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-medium text-sm">
                          {mechanic.userId?.name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {mechanic.userId?.name}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span>{mechanic.rating}</span>
                          <span>•</span>
                          <span>{mechanic.distance}km away</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          mechanic.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <span className="text-xs text-gray-500">
                          {mechanic.isAvailable ? 'Available' : 'Busy'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 mt-1">
                        {mechanic.vehicleTypes.slice(0, 3).map((type) => {
                          const Icon = getVehicleIcon(type);
                          return (
                            <Icon key={type} className="w-3 h-3 text-gray-400" />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                {hasLocation() ? (
                  <>
                    <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No mechanics nearby</p>
                    <p className="text-sm text-gray-400 mt-1">Try expanding your search radius</p>
                  </>
                ) : (
                  <>
                    <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Enable location to see nearby mechanics</p>
                    <button
                      onClick={getCurrentLocation}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium mt-2"
                    >
                      Enable Location
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Emergency Contact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Emergency Hotline</h3>
              <p className="text-red-100 text-sm">Available 24/7 for urgent assistance</p>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="tel:16263"
                className="flex items-center space-x-2 bg-white text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>16263</span>
              </a>
            </div>
          </div>
        </motion.div>

        {/* Rating Modal */}
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onRatingSubmitted={handleRatingSubmitted}
        />

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedRequest(null);
          }}
          request={selectedRequest}
          onPaymentCompleted={handlePaymentCompleted}
        />
      </div>
    </div>
  );
};

export default Dashboard;
