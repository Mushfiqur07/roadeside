import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useSocket } from '../context/SocketContext';
import { mechanicsAPI } from '../api/mechanics';
import { requestsAPI } from '../api/requests';
import { 
  MapPin, 
  Search, 
  Star, 
  Phone, 
  Navigation,
  Car,
  Bike,
  Truck,
  Wrench,
  DollarSign,
  User,
  CheckCircle,
  AlertCircle,
  Settings,
  Zap,
  Fuel,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { MechanicFinderMap } from '../components/Map';

const FindMechanics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentLocation, getCurrentLocation } = useLocation();
  const { isConnected, on, off, emit } = useSocket();
  
  const [mechanics, setMechanics] = useState([]);
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingService, setIsRequestingService] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10); // km
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [selectedServiceKeys, setSelectedServiceKeys] = useState([]);
  
  const [activeRequestId, setActiveRequestId] = useState(null);

  const vehicleTypes = [
    { value: 'car', label: 'Car', icon: Car },
    { value: 'bike', label: 'Bike/Motorcycle', icon: Bike },
    { value: 'truck', label: 'Truck', icon: Truck },
    { value: 'bus', label: 'Bus', icon: Car },
    { value: 'cng', label: 'CNG', icon: Car },
    { value: 'rickshaw', label: 'Rickshaw', icon: Bike }
  ];

  const serviceTypes = [
    { value: 'engine_repair', label: 'Engine Repair', icon: Wrench, description: 'Fix engine problems and diagnostics' },
    { value: 'tire_change', label: 'Tire Change', icon: Settings, description: 'Flat tire replacement and repair' },
    { value: 'battery_jump', label: 'Battery Jump', icon: Zap, description: 'Jump start dead battery' },
    { value: 'fuel_delivery', label: 'Fuel Delivery', icon: Fuel, description: 'Emergency fuel delivery service' },
    { value: 'lockout_service', label: 'Lockout Service', icon: Key, description: 'Unlock your vehicle' },
    { value: 'towing', label: 'Towing Service', icon: Truck, description: 'Vehicle towing and recovery' },
    { value: 'brake_repair', label: 'Brake Repair', icon: AlertCircle, description: 'Brake system repair and maintenance' },
    { value: 'electrical_repair', label: 'Electrical Repair', icon: Zap, description: 'Electrical system diagnostics and repair' }
  ];

  // Helper to get per-service price range for a mechanic. Falls back to mechanic.priceRange
  const getServicePriceRange = (mechanic, serviceKey) => {
    if (!mechanic) return { min: 0, max: 0 };
    const defaultMin = mechanic.priceRange?.min ?? 0;
    const defaultMax = mechanic.priceRange?.max ?? 0;
    const map = mechanic.servicePrices || {};
    // Map can be a plain object or a Map serialized by Mongo; support both
    const override = map[serviceKey] || map.get?.(serviceKey);
    const min = typeof override?.min === 'number' ? override.min : defaultMin;
    const max = typeof override?.max === 'number' ? override.max : defaultMax;
    return { min, max };
  };

  useEffect(() => {
    // Get current location
    if (!currentLocation) {
      try {
        getCurrentLocation();
      } catch (e) {}
    }
    
    // Socket listeners for real-time updates (with null checks)
    let unsubscribeMechanicLocation = null;
    let unsubscribeMechanicAvailability = null;
    let unsubscribeRequestStatus = null;
    
    if (on && typeof on === 'function') {
      unsubscribeMechanicLocation = on('mechanic_location_update', handleMechanicLocationUpdate);
      unsubscribeMechanicAvailability = on('mechanic_availability_changed', handleMechanicAvailabilityChange);
      unsubscribeRequestStatus = on('request_status_changed', (payload) => {
        console.log('request_status_changed', payload);
        if (payload.requestId === activeRequestId && payload.status === 'accepted') {
          toast.success('Mechanic accepted your request');
          // Keep existing polyline; nothing else needed here yet
        }
      });
    }
    
    return () => {
      // Cleanup socket listeners
      if (unsubscribeMechanicLocation && typeof unsubscribeMechanicLocation === 'function') {
        unsubscribeMechanicLocation();
      }
      if (unsubscribeMechanicAvailability && typeof unsubscribeMechanicAvailability === 'function') {
        unsubscribeMechanicAvailability();
      }
      if (unsubscribeRequestStatus && typeof unsubscribeRequestStatus === 'function') {
        unsubscribeRequestStatus();
      }
      
    };
  }, [on]);


  const loadNearbyMechanics = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!currentLocation || currentLocation[0] === 0 || currentLocation[1] === 0) {
        toast.error('Location not detected. Please allow location access.');
        setIsLoading(false);
        return;
      }
      const longitude = currentLocation[0];
      const latitude = currentLocation[1];
      console.log('[Geo] User coordinates used for nearby search:', { lat: latitude, lng: longitude });
      const maxDistance = Math.max(searchRadius * 1000, 20000); // cap default to 20km+ slider
      const vehicleType = vehicleTypeFilter === 'all' ? null : vehicleTypeFilter;

      console.log('Loading mechanics with params:', { longitude, latitude, vehicleType, maxDistance });
      // To visualize all nearby verified mechanics on the map (both available and busy), set includeUnavailable=true
      const response = await mechanicsAPI.getNearbyMechanics(longitude, latitude, vehicleType, maxDistance, true);
      
      if (response.success) {
        try {
          (response.data.mechanics || []).forEach(m => {
            const coords = (m.garage && m.garage.location && m.garage.location.coordinates) || (m.currentLocation && m.currentLocation.coordinates);
            if (coords && coords.length >= 2) {
              console.log('[DB] Mechanic coordinates:', { id: m._id, lat: coords[1], lng: coords[0] });
            }
          });
        } catch (e) {}
        setMechanics(response.data.mechanics || []);
      } else {
        toast.error('Failed to load nearby mechanics');
      }
    } catch (error) {
      console.error('Load mechanics error:', error);
      toast.error('Failed to load nearby mechanics');
    } finally {
      setIsLoading(false);
    }
  }, [currentLocation, searchRadius, vehicleTypeFilter, serviceTypeFilter]);

  useEffect(() => {
    if (currentLocation) {
      loadNearbyMechanics();
    }
  }, [currentLocation, searchRadius, vehicleTypeFilter, serviceTypeFilter, loadNearbyMechanics]);

  // Set up global selectMechanic function for map popup buttons
  useEffect(() => {
    window.selectMechanic = (mechanicId) => {
      const mechanic = mechanics.find(m => m._id === mechanicId);
      if (mechanic) {
        setSelectedMechanic(mechanic);
        // Scroll to mechanic details or show modal
        const mechanicElement = document.getElementById(`mechanic-${mechanicId}`);
        if (mechanicElement) {
          mechanicElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    return () => {
      delete window.selectMechanic;
    };
  }, [mechanics]);



  const handleMechanicLocationUpdate = (data) => {
    // Update mechanic location in real-time
    setMechanics(prev => prev.map(mechanic => 
      mechanic._id === data.mechanicId 
        ? { ...mechanic, location: { coordinates: data.location } }
        : mechanic
    ));
  };

  const handleMechanicAvailabilityChange = (data) => {
    // Update mechanic availability
    setMechanics(prev => prev.map(mechanic => 
      mechanic._id === data.mechanicId 
        ? { ...mechanic, isAvailable: data.isAvailable }
        : mechanic
    ));
  };

  const handleRequestService = async (mechanic) => {
    if (!user) {
      toast.error('Please login to request service');
      return;
    }

    if (!currentLocation) {
      toast.error('Location is required to request service');
      return;
    }

    try {
      setIsRequestingService(true);
      
      // Require selections from modal; fall back to defaults only if explicitly set
      const selectedVehicleType = vehicleTypeFilter;
      const selectedServiceType = serviceTypeFilter;

      if (!selectedVehicleType || !selectedServiceType) {
        toast.error('Please select vehicle type and service type');
        return;
      }
      
      // Get service label for description
      const serviceLabel = serviceTypes.find(s => s.value === selectedServiceType)?.label || selectedServiceType;
      const vehicleLabel = vehicleTypes.find(v => v.value === selectedVehicleType)?.label || selectedVehicleType;
      
      // Price estimate based on selected service range (with vehicle multiplier)
      const range = getServicePriceRange(mechanic, selectedServiceType);
      const vehicleMultiplier = selectedVehicleType === 'truck' ? 1.5 : (selectedVehicleType === 'bus' ? 1.8 : 1);
      const estMin = Math.round((range.min || mechanic.priceRange?.min || 0) * vehicleMultiplier);
      const estMax = Math.round((range.max || mechanic.priceRange?.max || 0) * vehicleMultiplier);
      const midpoint = Math.round((estMin + estMax) / 2);

      const requestData = {
        mechanicId: mechanic._id,
        vehicleType: selectedVehicleType,
        problemType: selectedServiceType || selectedServiceKeys[0],
        description: `${serviceLabel} service needed for ${vehicleLabel}`,
        pickupLocation: {
          type: 'Point',
          coordinates: [currentLocation[0], currentLocation[1]],
          address: `Location: ${currentLocation[1].toFixed(4)}, ${currentLocation[0].toFixed(4)}`
        },
        priority: 'medium',
        isEmergency: false,
        estimatedCost: midpoint,
        selectedServices: selectedServiceKeys.map(k => ({ key: k, label: serviceTypes.find(s => s.value === k)?.label }))
      };

      console.log('Sending request:', requestData);
      const response = await requestsAPI.createRequest(requestData);
      
      if (response.success) {
        toast.success(`Service request sent to ${mechanic.userId?.name || 'mechanic'}!`);
        const reqId = response.data?.request?._id;
        setActiveRequestId(reqId);
        // Join private request room and broadcast to nearby mechanics via server helper
        try {
          if (emit && typeof emit === 'function' && reqId) {
            console.log('Joining request room', reqId);
            emit('join_request_room', { requestId: reqId });
            // Emit both events for compatibility
            emit('new_request', { requestId: reqId });
            emit('request:create', {
              requestId: reqId,
              mechanicId: mechanic._id,
              userId: user?._id,
              userLocation: { coordinates: [currentLocation[0], currentLocation[1]] }
            });
          }
        } catch (e) {
          console.warn('Socket emit failed', e);
        }
        setSelectedMechanic(null);
        
        // Show success message with mechanic details
        setTimeout(() => {
          toast.success(`${mechanic.userId?.name} will be notified. Please wait for response.`);
        }, 1000);
        
        // Optionally redirect to request tracking after 2 seconds
        setTimeout(() => {
          if (response.data?.request?._id) {
            window.location.href = `/request/${response.data.request._id}`;
          }
        }, 3000);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Find Mechanics</h1>
              <p className="text-gray-600 mt-1">Locate nearby mechanics for assistance</p>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Navigation className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">
                {currentLocation ? 'Location detected' : 'Detecting location...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
              
              {/* Search Radius */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Radius: {searchRadius} km
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Vehicle Type Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type
                </label>
                <select
                  value={vehicleTypeFilter}
                  onChange={(e) => setVehicleTypeFilter(e.target.value)}
                  className="w-full input"
                >
                  <option value="">All Vehicles</option>
                  {vehicleTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Service Type Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
                </label>
                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  className="w-full input"
                >
                  <option value="">All Services</option>
                  {serviceTypes.map(service => (
                    <option key={service.value} value={service.value}>
                      {service.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={loadNearbyMechanics}
                className="w-full btn btn-primary flex items-center justify-center space-x-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search Mechanics</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Map and Results */}
          <div className="lg:col-span-2">
            {/* Map */}
            <div className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
              <MechanicFinderMap
                mechanics={mechanics}
                userLocation={currentLocation ? { coordinates: currentLocation } : null}
                onMechanicSelect={setSelectedMechanic}
                height="400px"
                radiusKm={searchRadius}
              />
            </div>

            {/* Mechanics List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Available Mechanics ({mechanics.length})
              </h3>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="lg" />
                </div>
              ) : mechanics.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No mechanics found in your area</p>
                  <p className="text-sm text-gray-400 mt-1">Try increasing the search radius</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {mechanics.map((mechanic) => (
                    <motion.div
                      key={mechanic._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{mechanic.userId?.name || 'Unknown'}</h4>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Star className="w-4 h-4 text-yellow-400" />
                                <span>{mechanic.rating || 'New'}</span>
                                <span>•</span>
                                <span>{mechanic.distance?.toFixed(1) || 'N/A'} km away</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Vehicle Types</p>
                              <div className="flex flex-wrap gap-1">
                                {mechanic.vehicleTypes?.slice(0, 3).map(type => (
                                  <span key={type} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                    {type}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Skills</p>
                              <div className="flex flex-wrap gap-1">
                                {mechanic.skills?.slice(0, 2).map(skill => (
                                  <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                    {typeof skill === 'string' ? skill.replace('_', ' ') : skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Phone className="w-4 h-4" />
                                <span>{mechanic.userId?.phone || 'N/A'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <DollarSign className="w-4 h-4" />
                                <span>{mechanic.priceRange?.min || 200}-{mechanic.priceRange?.max || 2000} BDT</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <div className={`flex items-center space-x-1 text-sm ${
                                mechanic.isAvailable ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {mechanic.isAvailable ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <AlertCircle className="w-4 h-4" />
                                )}
                                <span>{mechanic.isAvailable ? 'Available' : 'Busy'}</span>
                              </div>
                              
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => navigate(`/mechanic-profile/${mechanic._id}`)}
                                  className="btn btn-outline btn-sm"
                                >
                                  View Profile
                                </button>
                                <button
                                  onClick={() => setSelectedMechanic(mechanic)}
                                  disabled={!mechanic.isAvailable || isRequestingService}
                                  className="btn btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isRequestingService ? (
                                    <LoadingSpinner size="sm" color="white" />
                                  ) : (
                                    'Request Service'
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Uber-Style Pickup Modal */}
      <AnimatePresence>
        {selectedMechanic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
            onClick={() => setSelectedMechanic(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 500 }}
              className="bg-white rounded-t-3xl w-full max-w-md mx-4 mb-0 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white rounded-t-3xl border-b p-6 pb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Choose a service</h2>
                  <button
                    onClick={() => setSelectedMechanic(null)}
                    className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Mechanic Info */}
                <div className="flex items-center space-x-3 mt-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedMechanic.userId?.name || selectedMechanic.name || 'Mechanic'}</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span>{selectedMechanic.rating?.toFixed(1) || '5.0'}</span>
                      <span>•</span>
                      <span>{selectedMechanic.distance?.toFixed(1) || '0.0'} km away</span>
                      <span>•</span>
                      <span>{selectedMechanic.experience || 0} years exp</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Options */}
              <div className="p-6 space-y-4">
                {/* Vehicle Type Selection */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Select Vehicle Type <span className="text-red-500">*</span></h4>
                  {!vehicleTypeFilter && (
                    <p className="text-sm text-red-500 mb-2">Please select your vehicle type</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {vehicleTypes.filter(type => 
                      !selectedMechanic.vehicleTypes || 
                      selectedMechanic.vehicleTypes.includes(type.value)
                    ).map(type => {
                      const Icon = type.icon;
                      const basePrice = selectedMechanic.baseRate || selectedMechanic.priceRange?.min || 500;
                      const multiplier = type.value === 'truck' ? 1.5 : type.value === 'bus' ? 1.8 : 1;
                      const price = Math.round(basePrice * multiplier);
                      
                      return (
                        <button
                          key={type.value}
                          onClick={() => setVehicleTypeFilter(type.value)}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                            vehicleTypeFilter === type.value
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <Icon className={`w-8 h-8 ${
                              vehicleTypeFilter === type.value ? 'text-blue-600' : 'text-gray-600'
                            }`} />
                            <div className="text-center">
                              <p className={`font-medium text-sm ${
                                vehicleTypeFilter === type.value ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {type.label}
                              </p>
                              <p className={`text-xs ${
                                vehicleTypeFilter === type.value ? 'text-blue-600' : 'text-gray-600'
                              }`}>
                                ৳{price}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Service Type Selection */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Select Service Type <span className="text-red-500">*</span></h4>
                  {!serviceTypeFilter && (
                    <p className="text-sm text-red-500 mb-2">Please select the type of service you need</p>
                  )}
                  <div className="space-y-2">
                    {serviceTypes.map(service => {
                      const Icon = service.icon;
                      const range = getServicePriceRange(selectedMechanic, service.value);
                      const selected = selectedServiceKeys.includes(service.value);
                      return (
                        <button
                          key={service.value}
                          onClick={() => {
                            setServiceTypeFilter(service.value);
                            setSelectedServiceKeys(prev => prev.includes(service.value)
                              ? prev.filter(k => k !== service.value)
                              : [...prev, service.value]);
                          }}
                          className={`w-full p-4 rounded-xl border-2 transition-all duration-200 flex items-center space-x-3 ${
                            selected
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className={`w-6 h-6 ${
                            selected ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                          <div className="flex-1 text-left">
                            <p className={`font-medium ${
                              selected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {service.label}
                            </p>
                            <p className={`text-sm ${
                              selected ? 'text-blue-600' : 'text-gray-600'
                            }`}>
                              {service.description}
                            </p>
                            <div className="text-xs text-gray-700 mt-1">
                              ৳{range.min} - ৳{range.max}
                            </div>
                          </div>
                          {selected && (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pricing Summary */}
                {vehicleTypeFilter && selectedServiceKeys.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600">Default Range</span>
                      <span className="font-medium">৳{selectedMechanic.priceRange?.min ?? 0} - ৳{selectedMechanic.priceRange?.max ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600">Vehicle Type</span>
                      <span className="font-medium">{vehicleTypes.find(v => v.value === vehicleTypeFilter)?.label}</span>
                    </div>
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      {selectedServiceKeys.map(key => {
                        const range = getServicePriceRange(selectedMechanic, key);
                        const label = serviceTypes.find(s => s.value === key)?.label || key;
                        const mult = vehicleTypeFilter === 'truck' ? 1.5 : (vehicleTypeFilter === 'bus' ? 1.8 : 1);
                        const min = Math.round((range.min || 0) * mult);
                        const max = Math.round((range.max || 0) * mult);
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{label}</span>
                            <span className="font-medium">৳{min} - ৳{max}</span>
                          </div>
                        );
                      })}
                    </div>
                    {(() => {
                      const mult = vehicleTypeFilter === 'truck' ? 1.5 : (vehicleTypeFilter === 'bus' ? 1.8 : 1);
                      let totalMin = 0, totalMax = 0;
                      selectedServiceKeys.forEach(key => {
                        const range = getServicePriceRange(selectedMechanic, key);
                        totalMin += Math.round((range.min || 0) * mult);
                        totalMax += Math.round((range.max || 0) * mult);
                      });
                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-gray-900">Total Estimate</span>
                          <span className="text-lg font-bold text-green-600">৳{totalMin} - ৳{totalMax}</span>
                        </div>
                      );
                    })()}
                    <p className="text-xs text-gray-500 mt-2">*Final price may vary based on actual service required</p>
                  </div>
                )}

                {/* Request Button */}
                <div className="space-y-3">
                  {(!vehicleTypeFilter || !serviceTypeFilter) && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <p className="text-sm text-red-700 font-medium">
                          Please select both vehicle type and service type to continue
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleRequestService(selectedMechanic)}
                    disabled={!vehicleTypeFilter || selectedServiceKeys.length === 0 || isRequestingService}
                    className={`w-full font-bold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                      !vehicleTypeFilter || !serviceTypeFilter
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : isRequestingService
                        ? 'bg-blue-500 text-white cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg transform hover:scale-[1.02]'
                    }`}
                  >
                    {isRequestingService ? (
                      <>
                        <LoadingSpinner size="sm" color="white" />
                        <span>Sending Request...</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="w-5 h-5" />
                        <span>
                          {!vehicleTypeFilter || selectedServiceKeys.length === 0 
                            ? 'Select Options Above' 
                            : 'Request Service'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FindMechanics;
