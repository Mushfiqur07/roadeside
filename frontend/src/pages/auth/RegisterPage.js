import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { useForm } from 'react-hook-form';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin, 
  Wrench,
  Car,
  Bike,
  Truck,
  Award,
  FileText,
  Building2
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingSpinner from '../../components/LoadingSpinner';
import { LocationPickerMap } from '../../components/Map';

const RegisterPage = () => {
  const { register: registerUser, isAuthenticated, isLoading } = useAuth();
  const { getCurrentLocation, currentLocation } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userType, setUserType] = useState(searchParams.get('role') || 'user');
  const [garageLocation, setGarageLocation] = useState(null);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
    setValue,
    getValues
  } = useForm({
    defaultValues: {
      role: userType,
      vehicleTypes: [],
      skills: []
    }
  });

  const watchedPassword = watch('password');

  // Handle vehicle type checkbox changes
  const handleVehicleTypeChange = (value, checked) => {
    if (checked) {
      setSelectedVehicleTypes(prev => [...prev, value]);
    } else {
      setSelectedVehicleTypes(prev => prev.filter(item => item !== value));
    }
  };

  // Handle skills checkbox changes
  const handleSkillChange = (value, checked) => {
    if (checked) {
      setSelectedSkills(prev => [...prev, value]);
    } else {
      setSelectedSkills(prev => prev.filter(item => item !== value));
    }
  };

  // Select all vehicle types
  const selectAllVehicleTypes = () => {
    setSelectedVehicleTypes(vehicleTypes.map(v => v.value));
  };

  // Deselect all vehicle types
  const deselectAllVehicleTypes = () => {
    setSelectedVehicleTypes([]);
  };

  // Select all skills
  const selectAllSkills = () => {
    const allSkills = [
      'engine_repair', 'tire_change', 'battery_jump', 'electrical_repair',
      'brake_repair', 'oil_change', 'fuel_delivery', 'lockout_service', 'towing'
    ];
    setSelectedSkills(allSkills);
  };

  // Deselect all skills
  const deselectAllSkills = () => {
    setSelectedSkills([]);
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Get current location on mount
  useEffect(() => {
    if (!currentLocation) {
      getCurrentLocation();
    }
  }, []);

  // Update form when location is available
  useEffect(() => {
    if (currentLocation) {
      setValue('location.coordinates', currentLocation);
    }
  }, [currentLocation, setValue]);

  const vehicleTypes = [
    { value: 'bike', label: 'Bike/Motorcycle', icon: Bike },
    { value: 'car', label: 'Car', icon: Car },
    { value: 'truck', label: 'Truck', icon: Truck },
    { value: 'bus', label: 'Bus', icon: Car }
  ];

  const skillTypes = [
    'engine_repair',
    'tire_change',
    'battery_jump',
    'fuel_delivery',
    'lockout_service',
    'towing',
    'brake_repair',
    'electrical_repair',
    'ac_repair',
    'general_maintenance'
  ];

  const toolTypes = [
    'basic_toolkit',
    'advanced_toolkit',
    'diagnostic_equipment',
    'welding_equipment',
    'towing_equipment',
    'jump_starter',
    'tire_equipment',
    'electrical_tools'
  ];

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    try {
      // Validate garage location for mechanics
      if (userType === 'mechanic' && !garageLocation) {
        setError('root', { message: 'Please select your garage location on the map' });
        setIsSubmitting(false);
        return;
      }

      // Debug: Log all form data
      console.log('🔍 Form submission data:', {
        formData: data,
        selectedVehicleTypes,
        selectedSkills,
        garageLocation,
        userType
      });

      // Prepare registration data
      const registrationData = {
        name: data.name?.trim(),
        email: data.email?.toLowerCase()?.trim(),
        password: data.password,
        phone: data.phone?.trim(),
        role: userType // Use userType state instead of data.role
      };

      // Debug: Log what role we're sending
      console.log('Sending registration with role:', userType);
      console.log('Form data role:', data.role);
      console.log('Registration data:', registrationData);

      // Add location if available
      if (currentLocation && Array.isArray(currentLocation) && currentLocation.length === 2) {
        // Use actual current location
        registrationData.location = {
          type: 'Point',
          coordinates: [parseFloat(currentLocation[0]), parseFloat(currentLocation[1])],
          address: data.address || ''
        };
      } else if (data.address) {
        // Use default Dhaka coordinates if only address is provided
        registrationData.location = {
          type: 'Point',
          coordinates: [90.4125, 23.8103], // Default to Dhaka
          address: data.address
        };
      }

      // Add mechanic-specific data if registering as mechanic
      if (userType === 'mechanic') {
        console.log('Adding mechanic-specific data...');
        console.log('🔍 Raw form data:', data);
        
        // Use state values for vehicleTypes and skills
        console.log('🔍 Selected arrays:', { selectedVehicleTypes, selectedSkills });
        
        registrationData.vehicleTypes = selectedVehicleTypes;
        registrationData.skills = selectedSkills;
        registrationData.experience = parseInt(data.experience) || 0;
        registrationData.serviceRadius = parseInt(data.serviceRadius) || 10;
        registrationData.priceRange = {
          min: parseInt(data.priceMin) || 200,
          max: parseInt(data.priceMax) || 2000
        };
        registrationData.tools = data.tools || [];
        registrationData.nidNumber = data.nidNumber;
        registrationData.licenseNumber = data.licenseNumber;
        
        // Add garage information
        registrationData.garageName = data.garageName;
        registrationData.garageAddress = data.garageAddress;
        registrationData.garageLocation = garageLocation;
        
        // Debug: Log mechanic data being sent
        console.log('🔍 Frontend - Mechanic data being sent:', {
          vehicleTypes: registrationData.vehicleTypes,
          skills: registrationData.skills,
          experience: registrationData.experience,
          garage: {
            name: registrationData.garageName,
            address: registrationData.garageAddress,
            location: registrationData.garageLocation
          }
        });
        
        // Debug: Log complete registration data
        console.log('🔍 Complete registration data:', registrationData);
        console.log('🔍 Data types check:', {
          vehicleTypes: Array.isArray(registrationData.vehicleTypes),
          vehicleTypesLength: registrationData.vehicleTypes?.length,
          skills: Array.isArray(registrationData.skills),
          skillsLength: registrationData.skills?.length,
          experience: typeof registrationData.experience,
          experienceValue: registrationData.experience
        });
        
        // Additional validation check with detailed error messages
        if (!selectedVehicleTypes || selectedVehicleTypes.length === 0) {
          setError('root', { message: 'Please select at least one vehicle type you can service' });
          setIsSubmitting(false);
          return;
        }
        
        if (!selectedSkills || selectedSkills.length === 0) {
          setError('root', { message: 'Please select at least one skill or service you can provide' });
          setIsSubmitting(false);
          return;
        }
        
        // Validate experience field
        if (!data.experience || data.experience.trim() === '') {
          setError('root', { message: 'Please enter your years of experience' });
          setIsSubmitting(false);
          return;
        }
        
        // Validate garage name
        if (!data.garageName || data.garageName.trim() === '') {
          setError('root', { message: 'Please enter your garage name' });
          setIsSubmitting(false);
          return;
        }
        
        // Validate garage address
        if (!data.garageAddress || data.garageAddress.trim() === '') {
          setError('root', { message: 'Please enter your garage address' });
          setIsSubmitting(false);
          return;
        }
        
        
        if (!registrationData.garageLocation || !registrationData.garageLocation.coordinates) {
          setError('root', { message: 'Please select your garage location on the map (this is required for mechanic registration)' });
          setIsSubmitting(false);
          return;
        }
      }

      const result = await registerUser(registrationData);
      
      if (result.success) {
        // Debug: Log the result to see the structure
        console.log('Registration result:', result);
        console.log('User data:', result.user);
        console.log('Data.user:', result.data?.user);
        
        // Role-based redirect using the result data
        const userRole = result.data?.user?.role || result.user?.role;
        console.log('Detected user role:', userRole);
        
        if (userRole === 'mechanic') {
          console.log('Redirecting to mechanic dashboard');
          navigate('/mechanic/dashboard', { replace: true });
        } else if (userRole === 'admin') {
          console.log('Redirecting to admin dashboard');
          navigate('/admin/dashboard', { replace: true });
        } else {
          console.log('Redirecting to user dashboard');
          navigate('/dashboard', { replace: true });
        }
      } else {
        setError('root', { message: result.error });
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle specific error cases
      if (error.response?.data?.message) {
        setError('root', { message: error.response.data.message });
      } else if (error.response?.data?.errors) {
        // Handle validation errors from backend
        const errorMessages = error.response.data.errors.map(err => err.message || err).join(', ');
        setError('root', { message: `Validation error: ${errorMessages}` });
      } else if (error.message) {
        setError('root', { message: error.message });
      } else {
        setError('root', { message: 'Registration failed. Please check all required fields and try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
              <Wrench className="w-7 h-7 text-white" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Join RoadAssist BD
          </h2>
          <p className="text-gray-600">
            {userType === 'mechanic' 
              ? 'Register as a mechanic and start helping people on the road'
              : 'Create your account to get roadside assistance anytime'
            }
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white shadow-soft rounded-lg p-6 sm:p-8"
        >
          {/* User Type Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              I want to register as:
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setUserType('user')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  userType === 'user'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className="w-8 h-8 mx-auto mb-2" />
                <div className="font-medium">User</div>
                <div className="text-sm text-gray-500">Get roadside help</div>
              </button>
              
              <button
                type="button"
                onClick={() => setUserType('mechanic')}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  userType === 'mechanic'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Wrench className="w-8 h-8 mx-auto mb-2" />
                <div className="font-medium">Mechanic</div>
                <div className="text-sm text-gray-500">Provide services</div>
              </button>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <input
              {...register('role')}
              type="hidden"
              value={userType}
            />

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('name', {
                      required: 'Name is required',
                      minLength: { value: 2, message: 'Name must be at least 2 characters' }
                    })}
                    type="text"
                    className={`input pl-10 ${errors.name ? 'border-red-500' : ''}`}
                    placeholder="Enter your full name"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('phone', {
                      required: 'Phone number is required',
                      pattern: {
                        value: /^01[3-9]\d{8}$/,
                        message: 'Enter valid BD phone number (01XXXXXXXXX)'
                      }
                    })}
                    type="tel"
                    className={`input pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  type="email"
                  className={`input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Password must be at least 6 characters' }
                    })}
                    type={showPassword ? 'text' : 'password'}
                    className={`input pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                    placeholder="Create password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: value => value === watchedPassword || 'Passwords do not match'
                    })}
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={`input pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Confirm password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  {...register('address')}
                  className="textarea pl-10"
                  rows={3}
                  placeholder="Enter your address (optional)"
                />
              </div>
            </div>

            {/* Mechanic-specific fields */}
            {userType === 'mechanic' && (
              <div className="space-y-6 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Wrench className="w-5 h-5 mr-2" />
                  Mechanic Information
                </h3>

                {/* Vehicle Types */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Vehicle Types You Service <span className="text-red-500">*</span>
                      {selectedVehicleTypes.length > 0 && (
                        <span className="ml-2 text-sm text-green-600 font-normal">
                          ({selectedVehicleTypes.length} selected)
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllVehicleTypes}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        Select All
                      </button>
                      {selectedVehicleTypes.length > 0 && (
                        <button
                          type="button"
                          onClick={deselectAllVehicleTypes}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {vehicleTypes.map((vehicle) => {
                      const Icon = vehicle.icon;
                      return (
                        <label key={vehicle.value} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            value={vehicle.value}
                            checked={selectedVehicleTypes.includes(vehicle.value)}
                            onChange={(e) => handleVehicleTypeChange(vehicle.value, e.target.checked)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <Icon className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{vehicle.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.vehicleTypes && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <span className="mr-1">⚠️</span>
                      {errors.vehicleTypes.message}
                    </p>
                  )}
                </div>

                {/* Skills Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Skills & Services <span className="text-red-500">*</span>
                      {selectedSkills.length > 0 && (
                        <span className="ml-2 text-sm text-green-600 font-normal">
                          ({selectedSkills.length} selected)
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllSkills}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        Select All
                      </button>
                      {selectedSkills.length > 0 && (
                        <button
                          type="button"
                          onClick={deselectAllSkills}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { value: 'engine_repair', label: 'Engine Repair' },
                      { value: 'tire_change', label: 'Tire Change' },
                      { value: 'battery_jump', label: 'Battery Jump' },
                      { value: 'electrical_repair', label: 'Electrical Repair' },
                      { value: 'brake_repair', label: 'Brake Repair' },
                      { value: 'oil_change', label: 'Oil Change' },
                      { value: 'fuel_delivery', label: 'Fuel Delivery' },
                      { value: 'lockout_service', label: 'Lockout Service' },
                      { value: 'towing', label: 'Towing Service' }
                    ].map((skill) => (
                      <label key={skill.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          value={skill.value}
                          checked={selectedSkills.includes(skill.value)}
                          onChange={(e) => handleSkillChange(skill.value, e.target.checked)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm">{skill.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.skills && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <span className="mr-1">⚠️</span>
                      {errors.skills.message}
                    </p>
                  )}
                </div>

                {/* Experience and Service Radius */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Experience (Years)
                    </label>
                    <input
                      {...register('experience', {
                        required: userType === 'mechanic' ? 'Experience is required' : false,
                        min: { value: 0, message: 'Experience cannot be negative' }
                      })}
                      type="number"
                      min="0"
                      max="50"
                      className={`input ${errors.experience ? 'border-red-500' : ''}`}
                      placeholder="Years of experience"
                    />
                    {errors.experience && (
                      <p className="mt-1 text-sm text-red-600">{errors.experience.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Radius (KM)
                    </label>
                    <input
                      {...register('serviceRadius')}
                      type="number"
                      min="1"
                      max="50"
                      defaultValue="10"
                      className="input"
                      placeholder="Service radius in km"
                    />
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Price Range (BDT)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        {...register('priceMin')}
                        type="number"
                        min="0"
                        defaultValue="200"
                        className="input"
                        placeholder="Minimum price"
                      />
                    </div>
                    <div>
                      <input
                        {...register('priceMax')}
                        type="number"
                        min="0"
                        defaultValue="2000"
                        className="input"
                        placeholder="Maximum price"
                      />
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NID Number
                    </label>
                    <input
                      {...register('nidNumber', {
                        required: userType === 'mechanic' ? 'NID number is required' : false
                      })}
                      type="text"
                      className={`input ${errors.nidNumber ? 'border-red-500' : ''}`}
                      placeholder="National ID number"
                    />
                    {errors.nidNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.nidNumber.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Number
                    </label>
                    <input
                      {...register('licenseNumber', {
                        required: userType === 'mechanic' ? 'License number is required' : false
                      })}
                      type="text"
                      className={`input ${errors.licenseNumber ? 'border-red-500' : ''}`}
                      placeholder="Driving license number"
                    />
                    {errors.licenseNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.licenseNumber.message}</p>
                    )}
                  </div>
                </div>

                {/* Garage Information */}
                <div className="space-y-6 border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Building2 className="w-5 h-5 mr-2" />
                    Garage Information
                  </h3>

                  {/* Garage Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Garage Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        {...register('garageName', {
                          required: userType === 'mechanic' ? 'Garage name is required for mechanic registration' : false,
                          minLength: {
                            value: 2,
                            message: 'Garage name must be at least 2 characters long'
                          }
                        })}
                        type="text"
                        className={`input pl-10 ${errors.garageName ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'}`}
                        placeholder="Enter your garage name (e.g., 'ABC Auto Service')"
                      />
                    </div>
                    {errors.garageName && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <span className="mr-1">⚠️</span>
                        {errors.garageName.message}
                      </p>
                    )}
                  </div>

                  {/* Garage Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Garage Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <textarea
                        {...register('garageAddress', {
                          required: userType === 'mechanic' ? 'Garage address is required for mechanic registration' : false,
                          minLength: {
                            value: 10,
                            message: 'Please provide a complete address (at least 10 characters)'
                          }
                        })}
                        className={`textarea pl-10 ${errors.garageAddress ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'}`}
                        rows={3}
                        placeholder="Enter your complete garage address (street, area, city)"
                      />
                    </div>
                    {errors.garageAddress && (
                      <p className="mt-1 text-sm text-red-600 flex items-center">
                        <span className="mr-1">⚠️</span>
                        {errors.garageAddress.message}
                      </p>
                    )}
                  </div>

                  {/* Garage Location Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Garage Location <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-600 mb-3">
                      Click on the map to select your garage location
                    </p>
                    <div className="border rounded-lg overflow-hidden">
                      <LocationPickerMap
                        onLocationSelect={(location) => {
                          setGarageLocation(location);
                          console.log('Garage location selected:', location);
                        }}
                        initialLocation={garageLocation}
                      />
                    </div>
                    {garageLocation && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Location Selected</span>
                        </div>
                        <p className="text-sm text-green-700 mt-1">{garageLocation.address}</p>
                        <p className="text-xs text-green-600 mt-1">
                          Coordinates: {garageLocation.coordinates[1].toFixed(6)}, {garageLocation.coordinates[0].toFixed(6)}
                        </p>
                      </div>
                    )}
                    {!garageLocation && userType === 'mechanic' && (
                      <p className="mt-1 text-sm text-red-600">Please select your garage location on the map</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errors.root && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{errors.root.message}</p>
              </div>
            )}

            {/* Terms and Conditions */}
            <div className="flex items-start space-x-2">
              <input
                {...register('acceptTerms', {
                  required: 'You must accept the terms and conditions'
                })}
                type="checkbox"
                className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label className="text-sm text-gray-600">
                I agree to the{' '}
                <Link to="/terms" className="text-primary-600 hover:text-primary-500">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary-600 hover:text-primary-500">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {errors.acceptTerms && (
              <p className="text-sm text-red-600">{errors.acceptTerms.message}</p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" color="white" />
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Sign in here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RegisterPage;
