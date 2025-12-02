import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useSocket } from '../context/SocketContext';
import { mechanicsAPI } from '../api/mechanics';
import { requestsAPI } from '../api/requests';
import { 
  MapPin, 
  Search, 
  Filter, 
  Star, 
  Phone, 
  Navigation,
  Car,
  Bike,
  Truck,
  Wrench,
  Clock,
  AlertCircle,
  CheckCircle,
  X,
  DollarSign,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import { MechanicFinderMap } from '../components/Map';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MechanicFinder = () => {
  const { user } = useAuth();
  const { currentLocation, getCurrentLocation, hasLocation, calculateDistance } = useLocation();
  const { broadcastNewRequest } = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [mechanics, setMechanics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [filters, setFilters] = useState({
    vehicleType: '',
    maxDistance: 10,
    minRating: 0,
    isAvailable: true
  });
  const [requestForm, setRequestForm] = useState({
    vehicleType: '',
    problemType: '',
    description: '',
    priority: searchParams.get('emergency') === 'true' ? 'emergency' : 'medium',
    isEmergency: searchParams.get('emergency') === 'true'
  });

  const vehicleTypes = [
    { value: 'bike', label: 'Bike/Motorcycle', icon: Bike },
    { value: 'car', label: 'Car', icon: Car },
    { value: 'truck', label: 'Truck', icon: Truck },
    { value: 'bus', label: 'Bus', icon: Car },
    { value: 'cng', label: 'CNG', icon: Car },
    { value: 'rickshaw', label: 'Rickshaw', icon: Bike }
  ];

  const problemTypes = [
    { value: 'engine_problem', label: 'Engine Problem' },
    { value: 'tire_puncture', label: 'Tire Puncture' },
    { value: 'battery_dead', label: 'Battery Dead' },
    { value: 'fuel_empty', label: 'Fuel Empty' },
    { value: 'locked_out', label: 'Locked Out' },
    { value: 'accident', label: 'Accident' },
    { value: 'brake_problem', label: 'Brake Problem' },
    { value: 'electrical_issue', label: 'Electrical Issue' },
    { value: 'ac_problem', label: 'AC Problem' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    loadMechanics();
  }, [currentLocation, filters]);

  useEffect(() => {
    if (!hasLocation()) {
      getCurrentLocation();
    }
  }, []);

  const loadMechanics = async () => {
    if (!hasLocation()) return;

    try {
      setIsLoading(true);
      const [longitude, latitude] = currentLocation;
      
      const response = await mechanicsAPI.getNearbyMechanics(
        longitude,
        latitude,
        filters.vehicleType || null,
        filters.maxDistance * 1000 // Convert km to meters
      );

      if (response.success) {
        let filteredMechanics = response.data.mechanics;

        // Apply additional filters
        if (filters.minRating > 0) {
          filteredMechanics = filteredMechanics.filter(m => m.rating >= filters.minRating);
        }

        if (filters.isAvailable) {
          filteredMechanics = filteredMechanics.filter(m => m.isAvailable);
        }

        setMechanics(filteredMechanics);
      }
    } catch (error) {
      console.error('Failed to load mechanics:', error);
      toast.error('Failed to load mechanics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!hasLocation()) {
      toast.error('Location is required to create a request');
      return;
    }

    if (!requestForm.vehicleType || !requestForm.problemType || !requestForm.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsCreatingRequest(true);

      const requestData = {
        vehicleType: requestForm.vehicleType,
        problemType: requestForm.problemType,
        description: requestForm.description,
        priority: requestForm.priority,
        isEmergency: requestForm.isEmergency,
        pickupLocation: {
          type: 'Point',
          coordinates: currentLocation,
          address: 'Current Location' // You could get actual address here
        }
      };

      const response = await requestsAPI.createRequest(requestData);

      if (response.success) {
        const request = response.data.request;
        
        // Broadcast to nearby mechanics
        broadcastNewRequest(request._id);
        
        toast.success('Request created successfully!');
        navigate(`/request/${request._id}`);
      }
    } catch (error) {
      console.error('Failed to create request:', error);
      toast.error('Failed to create request');
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const handleRequestSpecificMechanic = async (mechanic) => {
    setSelectedMechanic(mechanic);
    setShowRequestForm(true);
  };

  const getVehicleIcon = (vehicleType) => {
    const vehicle = vehicleTypes.find(v => v.value === vehicleType);
    return vehicle ? vehicle.icon : Car;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'text-green-600 bg-green-100',
      medium: 'text-yellow-600 bg-yellow-100',
      high: 'text-orange-600 bg-orange-100',
      emergency: 'text-red-600 bg-red-100'
    };
    return colors[priority] || colors.medium;
  };

  if (!hasLocation()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Location Required</h2>
          <p className="text-gray-600 mb-6">We need your location to find nearby mechanics</p>
          <button
            onClick={getCurrentLocation}
            className="btn btn-primary"
          >
            Enable Location
          </button>
        </div>
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
              Find Mechanics Near You
            </h1>
            <p className="text-gray-600">
              {mechanics.length} mechanics found within {filters.maxDistance}km
            </p>
          </motion.div>
        </div>

        {/* Quick Request Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-white rounded-xl shadow-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Need Help Right Now?
                </h3>
                <p className="text-gray-600">
                  Create a request and nearby mechanics will be notified
                </p>
              </div>
              <button
                onClick={() => setShowRequestForm(true)}
                className={`btn ${requestForm.isEmergency ? 'bg-red-500 hover:bg-red-600 text-white' : 'btn-primary'} flex items-center space-x-2`}
              >
                {requestForm.isEmergency ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <Wrench className="w-5 h-5" />
                )}
                <span>{requestForm.isEmergency ? 'Emergency Request' : 'Create Request'}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl shadow-soft p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Type
              </label>
              <select
                value={filters.vehicleType}
                onChange={(e) => setFilters({...filters, vehicleType: e.target.value})}
                className="select w-full"
              >
                <option value="">All Types</option>
                {vehicleTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Distance (km)
              </label>
              <select
                value={filters.maxDistance}
                onChange={(e) => setFilters({...filters, maxDistance: parseInt(e.target.value)})}
                className="select w-full"
              >
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
                <option value={50}>50 km</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Rating
              </label>
              <select
                value={filters.minRating}
                onChange={(e) => setFilters({...filters, minRating: parseFloat(e.target.value)})}
                className="select w-full"
              >
                <option value={0}>Any Rating</option>
                <option value={3}>3+ Stars</option>
                <option value={4}>4+ Stars</option>
                <option value={4.5}>4.5+ Stars</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Availability
              </label>
              <select
                value={filters.isAvailable}
                onChange={(e) => setFilters({...filters, isAvailable: e.target.value === 'true'})}
                className="select w-full"
              >
                <option value={true}>Available Only</option>
                <option value={false}>All Mechanics</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Map Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white rounded-xl shadow-soft p-6 mb-8"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Nearby Mechanics</h2>
          <MechanicFinderMap
            mechanics={mechanics}
            onMechanicSelect={handleRequestSpecificMechanic}
            userLocation={currentLocation}
            radiusKm={filters.maxDistance}
          />
        </motion.div>

        {/* Mechanics List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Finding mechanics..." />
          </div>
        ) : mechanics.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {mechanics.map((mechanic, index) => (
              <motion.div
                key={mechanic._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                className="bg-white rounded-xl shadow-soft p-6 hover:shadow-medium transition-shadow"
              >
                {/* Mechanic Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">
                        {mechanic.userId?.name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {mechanic.userId?.name}
                      </h3>
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-600">
                          {mechanic.rating} ({mechanic.totalRatings} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    mechanic.isAvailable 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {mechanic.isAvailable ? 'Available' : 'Busy'}
                  </div>
                </div>

                {/* Distance & Experience */}
                <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Navigation className="w-4 h-4" />
                    <span>{mechanic.distance}km away</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{mechanic.experience} years exp</span>
                  </div>
                </div>

                {/* Vehicle Types */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Services:</p>
                  <div className="flex flex-wrap gap-2">
                    {mechanic.vehicleTypes.slice(0, 4).map((type) => {
                      const Icon = getVehicleIcon(type);
                      return (
                        <div
                          key={type}
                          className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded text-xs"
                        >
                          <Icon className="w-3 h-3" />
                          <span className="capitalize">{type}</span>
                        </div>
                      );
                    })}
                    {mechanic.vehicleTypes.length > 4 && (
                      <div className="bg-gray-100 px-2 py-1 rounded text-xs">
                        +{mechanic.vehicleTypes.length - 4} more
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Range */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Price: ৳{mechanic.priceRange.min} - ৳{mechanic.priceRange.max}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleRequestSpecificMechanic(mechanic)}
                    disabled={!mechanic.isAvailable}
                    className={`flex-1 btn ${
                      mechanic.isAvailable 
                        ? 'btn-primary' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    } text-sm`}
                  >
                    Request Service
                  </button>
                  <a
                    href={`tel:${mechanic.userId?.phone}`}
                    className="btn btn-outline text-sm flex items-center justify-center"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-12">
            <Wrench className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Mechanics Found</h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your filters or expanding the search radius
            </p>
            <button
              onClick={() => setFilters({...filters, maxDistance: 50, minRating: 0})}
              className="btn btn-primary"
            >
              Expand Search
            </button>
          </div>
        )}

        {/* Request Form Modal */}
        {showRequestForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedMechanic ? `Request from ${selectedMechanic.userId?.name}` : 'Create Service Request'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowRequestForm(false);
                      setSelectedMechanic(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Vehicle Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Type *
                    </label>
                    <select
                      value={requestForm.vehicleType}
                      onChange={(e) => setRequestForm({...requestForm, vehicleType: e.target.value})}
                      className="select w-full"
                      required
                    >
                      <option value="">Select vehicle type</option>
                      {vehicleTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
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
                      className="select w-full"
                      required
                    >
                      <option value="">Select problem type</option>
                      {problemTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
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
                      className="textarea w-full"
                      rows={3}
                      placeholder="Describe your problem in detail..."
                      required
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={requestForm.priority}
                      onChange={(e) => setRequestForm({
                        ...requestForm, 
                        priority: e.target.value,
                        isEmergency: e.target.value === 'emergency'
                      })}
                      className="select w-full"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>

                  {/* Emergency Notice */}
                  {requestForm.isEmergency && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-sm text-red-700">
                          Emergency requests will be prioritized and sent to all nearby mechanics
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowRequestForm(false);
                      setSelectedMechanic(null);
                    }}
                    className="flex-1 btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateRequest}
                    disabled={isCreatingRequest}
                    className={`flex-1 btn ${
                      requestForm.isEmergency 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'btn-primary'
                    } flex items-center justify-center space-x-2`}
                  >
                    {isCreatingRequest ? (
                      <LoadingSpinner size="sm" color="white" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Create Request</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MechanicFinder;
