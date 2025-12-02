import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  DollarSign, 
  Wrench, 
  Car, 
  User, 
  ArrowLeft,
  MessageCircle,
  CheckCircle,
  XCircle,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { requestsAPI } from '../api/requests';
import { createOrGetChatByRequest } from '../api/chat';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import ChatWindow from '../components/ChatWindow';
import toast from 'react-hot-toast';

const MechanicProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation, hasLocation, getCurrentLocation } = useLocation();
  const [mechanic, setMechanic] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  
  // Request service modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isRequestingService, setIsRequestingService] = useState(false);
  const [requestForm, setRequestForm] = useState({
    vehicleType: '',
    problemType: '',
    description: '',
    priority: 'medium',
    isEmergency: false
  });
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatId, setChatId] = useState(null);

  useEffect(() => {
    if (id) {
      loadMechanicProfile();
      loadReviews();
    }
  }, [id]);

  const loadMechanicProfile = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get(`/mechanics/${id}/profile`);

      if (data?.success) {
        setMechanic(data.data.mechanic);
      } else {
        toast.error(data?.message || 'Failed to load mechanic profile');
        navigate('/find-mechanics');
      }
    } catch (error) {
      console.error('Error loading mechanic profile:', error);
      toast.error('Failed to load mechanic profile');
      navigate('/find-mechanics');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      setIsLoadingReviews(true);
      const { data } = await api.get(`/mechanics/${id}/reviews`);
      if (data?.success) {
        setReviews(data?.data?.reviews || []);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const getSkillLabel = (skill) => {
    const skillLabels = {
      'engine_repair': 'Engine Repair',
      'tire_change': 'Tire Change',
      'battery_jump': 'Battery Jump',
      'fuel_delivery': 'Fuel Delivery',
      'lockout_service': 'Lockout Service',
      'towing': 'Towing',
      'brake_repair': 'Brake Repair',
      'electrical_repair': 'Electrical Repair',
      'ac_repair': 'AC Repair',
      'general_maintenance': 'General Maintenance'
    };
    return skillLabels[skill] || skill;
  };

  const getVehicleTypeLabel = (type) => {
    const typeLabels = {
      'bike': 'Bike/Motorcycle',
      'car': 'Car',
      'truck': 'Truck',
      'bus': 'Bus'
    };
    return typeLabels[type] || type;
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const vehicleTypes = [
    { value: 'bike', label: 'Bike/Motorcycle' },
    { value: 'car', label: 'Car' },
    { value: 'truck', label: 'Truck' },
    { value: 'bus', label: 'Bus' },
    { value: 'cng', label: 'CNG' },
    { value: 'rickshaw', label: 'Rickshaw' }
  ];

  const problemTypes = [
    { value: 'engine_repair', label: 'Engine Repair' },
    { value: 'tire_change', label: 'Tire Change' },
    { value: 'battery_jump', label: 'Battery Jump' },
    { value: 'electrical_repair', label: 'Electrical Repair' },
    { value: 'brake_repair', label: 'Brake Repair' },
    { value: 'oil_change', label: 'Oil Change' },
    { value: 'fuel_delivery', label: 'Fuel Delivery' },
    { value: 'lockout_service', label: 'Lockout Service' },
    { value: 'towing', label: 'Towing' },
    { value: 'general_repair', label: 'General Repair' },
    { value: 'emergency_service', label: 'Emergency Service' },
    { value: 'other', label: 'Other' }
  ];

  const handleRequestService = async () => {
    if (!user) {
      toast.error('Please login to request service');
      return;
    }

    if (!hasLocation()) {
      toast.error('Location access is required. Please enable location.');
      await getCurrentLocation();
      return;
    }

    if (!requestForm.vehicleType || !requestForm.problemType || !requestForm.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsRequestingService(true);

      const requestData = {
        mechanicId: id,
        vehicleType: requestForm.vehicleType,
        problemType: requestForm.problemType,
        description: requestForm.description,
        priority: requestForm.priority,
        isEmergency: requestForm.isEmergency,
        pickupLocation: {
          type: 'Point',
          coordinates: currentLocation,
          address: 'Current Location'
        }
      };

      const response = await requestsAPI.createRequest(requestData);
      
      if (response.success) {
        toast.success(`Service request sent to ${mechanic.userId?.name || 'mechanic'}!`);
        setShowRequestModal(false);
        
        // Navigate to request tracking
        setTimeout(() => {
          navigate(`/request/${response.data.request._id}`);
        }, 1000);
      } else {
        toast.error(response.message || 'Failed to send request');
      }
    } catch (error) {
      console.error('Request service error:', error);
      toast.error(error.response?.data?.message || 'Failed to send service request');
    } finally {
      setIsRequestingService(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user) {
      toast.error('Please login to send messages');
      return;
    }

    try {
      // For now, we'll create a general chat without a specific request
      // In a real app, you might want to create a request first or have a general messaging system
      toast.info('Creating chat...');
      
      // Create a temporary request for chat purposes or implement direct messaging
      const tempRequestData = {
        mechanicId: id,
        vehicleType: 'car', // default
        problemType: 'general_repair',
        description: 'General inquiry',
        priority: 'low',
        pickupLocation: {
          type: 'Point',
          coordinates: currentLocation || [90.4125, 23.8103], // Dhaka default
          address: 'Current Location'
        }
      };

      const response = await requestsAPI.createRequest(tempRequestData);
      
      if (response.success) {
        const chat = await createOrGetChatByRequest(response.data.request._id);
        setChatId(chat._id);
        setShowChat(true);
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to start chat');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!mechanic) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Mechanic Not Found</h2>
          <p className="text-gray-600 mb-4">The mechanic you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/find-mechanics')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Find Other Mechanics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Mechanic Profile</h1>
            <div></div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg overflow-hidden"
        >
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
            <div className="flex items-center space-x-6">
              <div className="relative">
                {mechanic.userId?.profileImage ? (
                  <img
                    src={mechanic.userId.profileImage}
                    alt={mechanic.userId.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white bg-opacity-20 flex items-center justify-center border-4 border-white">
                    <User className="w-12 h-12 text-white" />
                  </div>
                )}
                {mechanic.isAvailable && (
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white">{mechanic.userId?.name}</h1>
                <p className="text-blue-100 text-lg">Professional Mechanic</p>
                
                <div className="flex items-center mt-3 space-x-6">
                  <div className="flex items-center">
                    <div className="flex items-center">
                      {renderStars(Math.floor(mechanic.rating))}
                    </div>
                    <span className="text-white ml-2 font-semibold">
                      {mechanic.rating?.toFixed(1)} ({mechanic.totalRatings} reviews)
                    </span>
                  </div>
                  
                  <div className="flex items-center text-blue-100">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span>{mechanic.completedJobs} jobs completed</span>
                  </div>
                  
                  <div className="flex items-center text-blue-100">
                    <Clock className="w-5 h-5 mr-2" />
                    <span>{mechanic.experience} years experience</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                {/* Skills */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <Wrench className="w-5 h-5 mr-2" />
                    Skills & Services
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {mechanic.skills?.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        {getSkillLabel(skill)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Vehicle Types */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <Car className="w-5 h-5 mr-2" />
                    Vehicle Types
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {mechanic.vehicleTypes?.map((type, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                      >
                        {getVehicleTypeLabel(type)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Garage Information */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Garage Information
                  </h2>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900">{mechanic.garage?.name}</h3>
                    <p className="text-gray-600 mt-1">{mechanic.garage?.address}</p>
                  </div>
                </div>

                {/* Reviews */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <Star className="w-5 h-5 mr-2" />
                    Reviews ({reviews.length})
                  </h2>
                  
                  {isLoadingReviews ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : reviews.length > 0 ? (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <div key={review.id} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="flex items-center">
                                {renderStars(Math.round(review.rating || 0))}
                              </div>
                              <span className="ml-2 font-semibold text-gray-900">
                                {review.user?.name || 'User'}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">{new Date(review.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-gray-700 mb-2">{review.comment || ''}</p>
                          <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {review.requestType}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p>No reviews yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 text-gray-500 mr-3" />
                      <span className="text-gray-700">{mechanic.userId?.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-500 mr-3" />
                      <span className="text-gray-700">{mechanic.userId?.email}</span>
                    </div>
                  </div>
                </div>

                {/* Service Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Service Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Service Radius</span>
                      <span className="font-semibold">{mechanic.serviceRadius} km</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Price Range</span>
                      <span className="font-semibold">
                        ৳{mechanic.priceRange?.min} - ৳{mechanic.priceRange?.max}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Working Hours</span>
                      <span className="font-semibold">
                        {mechanic.workingHours?.start} - {mechanic.workingHours?.end}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Availability Status */}
                <div className={`rounded-lg p-4 ${mechanic.isAvailable ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center">
                    {mechanic.isAvailable ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 mr-2" />
                    )}
                    <span className={`font-semibold ${mechanic.isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                      {mechanic.isAvailable ? 'Available Now' : 'Currently Unavailable'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => setShowRequestModal(true)}
                    disabled={!mechanic.isAvailable}
                    className={`w-full py-3 px-4 rounded-lg transition-colors flex items-center justify-center ${
                      mechanic.isAvailable 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Wrench className="w-5 h-5 mr-2" />
                    Request Service
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Request Service Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Request Service</h2>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                <div className="space-y-4">
                  {/* Vehicle Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Type *
                    </label>
                    <select
                      value={requestForm.vehicleType}
                      onChange={(e) => setRequestForm({...requestForm, vehicleType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select vehicle type</option>
                      {vehicleTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Problem Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Problem Type *
                    </label>
                    <select
                      value={requestForm.problemType}
                      onChange={(e) => setRequestForm({...requestForm, problemType: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select problem type</option>
                      {problemTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={requestForm.description}
                      onChange={(e) => setRequestForm({...requestForm, description: e.target.value})}
                      placeholder="Describe the problem in detail..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={requestForm.priority}
                      onChange={(e) => setRequestForm({...requestForm, priority: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>

                  {/* Emergency Checkbox */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="emergency"
                      checked={requestForm.isEmergency}
                      onChange={(e) => setRequestForm({...requestForm, isEmergency: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="emergency" className="ml-2 block text-sm text-gray-900">
                      This is an emergency
                    </label>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestService}
                    disabled={isRequestingService}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isRequestingService ? (
                      <LoadingSpinner size="sm" color="white" />
                    ) : (
                      'Send Request'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      {showChat && chatId && (
        <div className="fixed bottom-4 right-4 z-50 w-[90vw] md:w-[420px] h-[60vh] md:h-96">
          <ChatWindow 
            chatId={chatId} 
            onClose={() => {
              setShowChat(false);
              setChatId(null);
            }} 
          />
        </div>
      )}
    </div>
  );
};

export default MechanicProfileView;

