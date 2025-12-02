import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Wrench, 
  Car, 
  DollarSign, 
  Clock, 
  Star,
  Save,
  Edit3,
  Check,
  X
} from 'lucide-react';
import ProfilePictureUpload from '../../components/ProfilePictureUpload';
import { mechanicsAPI } from '../../api/mechanics';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';
import api from '../../api';

const MechanicProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mechanicData, setMechanicData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reviews, setReviews] = useState([]);
  const { on } = useSocket();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm();

  const vehicleTypes = [
    { value: 'bike', label: 'Bike/Motorcycle', icon: Car },
    { value: 'car', label: 'Car', icon: Car },
    { value: 'truck', label: 'Truck', icon: Car },
    { value: 'bus', label: 'Bus', icon: Car }
  ];

  const skillTypes = [
    { value: 'engine_repair', label: 'Engine Repair' },
    { value: 'tire_change', label: 'Tire Change' },
    { value: 'battery_jump', label: 'Battery Jump' },
    { value: 'fuel_delivery', label: 'Fuel Delivery' },
    { value: 'lockout_service', label: 'Lockout Service' },
    { value: 'towing', label: 'Towing' },
    { value: 'brake_repair', label: 'Brake Repair' },
    { value: 'electrical_repair', label: 'Electrical Repair' },
    { value: 'ac_repair', label: 'AC Repair' },
    { value: 'general_maintenance', label: 'General Maintenance' }
  ];

  const toolTypes = [
    { value: 'basic_toolkit', label: 'Basic Toolkit' },
    { value: 'advanced_toolkit', label: 'Advanced Toolkit' },
    { value: 'diagnostic_equipment', label: 'Diagnostic Equipment' },
    { value: 'welding_equipment', label: 'Welding Equipment' },
    { value: 'towing_equipment', label: 'Towing Equipment' },
    { value: 'jump_starter', label: 'Jump Starter' },
    { value: 'tire_equipment', label: 'Tire Equipment' },
    { value: 'electrical_tools', label: 'Electrical Tools' }
  ];

  const renderServicePriceInputs = (selectedSkills = []) => {
    const skills = Array.isArray(selectedSkills) && selectedSkills.length ? selectedSkills : watch('skills') || [];
    const map = watch('servicePrices') || {};
    return (
      <div className="space-y-3">
        {skills.map((s) => {
          const label = (skillTypes.find(k => k.value === s)?.label) || s.replace('_',' ');
          const cur = map?.[s] || map?.get?.(s) || {};
          return (
            <div key={s} className="grid grid-cols-3 gap-3 items-end">
              <div className="col-span-1">
                <label className="block text-xs text-gray-500 mb-1 capitalize">{label}</label>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min (৳)</label>
                <input type="number" defaultValue={cur.min}
                  {...register(`servicePrices.${s}.min`)} disabled={!isEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max (৳)</label>
                <input type="number" defaultValue={cur.max}
                  {...register(`servicePrices.${s}.max`)} disabled={!isEditing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100" />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Load mechanic data
  useEffect(() => {
    loadMechanicData();
  }, []);

  const loadMechanicData = async () => {
    try {
      setIsLoading(true);

      // Use shared API client so REACT_APP_API_URL is respected
      const profileRes = await mechanicsAPI.getMyProfile();
      const mechanic = profileRes?.data?.mechanic;

      if (mechanic) {
        setMechanicData(mechanic);

        try {
          // Load reviews for this mechanic using the configured API base URL
          const reviewsRes = await api.get(`/mechanics/${mechanic._id}/reviews`);
          setReviews(reviewsRes.data?.data?.reviews || []);
        } catch (e) {
          console.error('Error loading mechanic reviews:', e);
        }
        
        // Populate form with current data
        try {
          setValue('vehicleTypes', mechanic.vehicleTypes || []);
          setValue('skills', mechanic.skills || []);
          setValue('experience', mechanic.experience || 0);
          setValue('serviceRadius', mechanic.serviceRadius || 10);
          setValue('priceRange.min', mechanic.priceRange?.min || 200);
          setValue('priceRange.max', mechanic.priceRange?.max || 2000);
          // Flatten servicePrices map for the form
          try {
            const sp = mechanic.servicePrices || {};
            const obj = {};
            if (sp && typeof sp === 'object') {
              const entries = sp instanceof Map ? Array.from(sp.entries()) : Object.entries(sp);
              entries.forEach(([k, v]) => { obj[k] = { min: v?.min, max: v?.max }; });
            }
            setValue('servicePrices', obj);
          } catch {}
          setValue('tools', mechanic.tools || []);
          setValue('workingHours.start', mechanic.workingHours?.start || '08:00');
          setValue('workingHours.end', mechanic.workingHours?.end || '20:00');
          setValue('garage.name', mechanic.garage?.name || '');
          setValue('garage.address', mechanic.garage?.address || '');
          setValue('documents.nidNumber', mechanic.documents?.nidNumber || '');
          setValue('documents.licenseNumber', mechanic.documents?.licenseNumber || '');
          setValue('emergencyContact.name', mechanic.emergencyContact?.name || '');
          setValue('emergencyContact.phone', mechanic.emergencyContact?.phone || '');
          setValue('emergencyContact.relation', mechanic.emergencyContact?.relation || '');
        } catch (e) {
          console.error('Error populating mechanic form data:', e);
        }
      }
    } catch (error) {
      console.error('Error loading mechanic data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time review updates
  useEffect(() => {
    const off = on('review:new', (payload) => {
      if (!mechanicData?._id) return;
      if (payload?.mechanicId?.toString() !== mechanicData._id.toString()) return;
      setReviews(prev => [payload.review, ...prev]);
    });
    return () => { try { off && off(); } catch {} };
  }, [on, mechanicData?._id]);

  const onSubmit = async (data) => {
    try {
      setIsSaving(true);
      
      // Use central mechanics API helper so base URL and auth are handled
      const result = await mechanicsAPI.updateProfile(data);
      const updatedMechanic = result?.data?.mechanic || result?.mechanic || null;

      if (updatedMechanic) {
        setMechanicData(updatedMechanic);
        toast.success('Profile updated successfully');
      } else {
        toast.success('Profile update submitted');
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageChange = async (newImageUrl) => {
    // Update local auth user image and persist to backend user profile if needed
    try {
      updateUser({ ...user, profileImage: newImageUrl });
    } catch (e) {}
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <ProfilePictureUpload
                  currentImage={user?.profileImage}
                  onImageChange={handleImageChange}
                  size="xlarge"
                />
                <div>
                  <h1 className="text-2xl font-bold text-white">{user?.name}</h1>
                  <p className="text-blue-100">Mechanic Profile</p>
                  <div className="flex items-center mt-2">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-white ml-1">
                      {mechanicData?.rating?.toFixed(1) || '5.0'} ({mechanicData?.totalRatings || 0} reviews)
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        reset();
                      }}
                      className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit(onSubmit)}
                      disabled={isSaving}
                      className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="p-6">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Basic Information */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Basic Information
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle Types
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {vehicleTypes.map((type) => (
                          <label key={type.value} className="flex items-center">
                            <input
                              type="checkbox"
                              value={type.value}
                              {...register('vehicleTypes')}
                              disabled={!isEditing}
                              className="mr-2"
                            />
                            <span className="text-sm">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Skills
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {skillTypes.map((skill) => (
                          <label key={skill.value} className="flex items-center">
                            <input
                              type="checkbox"
                              value={skill.value}
                              {...register('skills')}
                              disabled={!isEditing}
                              className="mr-2"
                            />
                            <span className="text-sm">{skill.label}</span>
                          </label>
                        ))}
                      </div>
                      {/* Per-service prices */}
                      <div className="mt-4 p-3 border rounded-lg">
                        <div className="text-sm font-medium mb-2">Per-service Price Overrides</div>
                        {renderServicePriceInputs()}
                        <div className="text-xs text-gray-500 mt-2">Leave blank to use default price range.</div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Experience (Years)
                      </label>
                      <input
                        type="number"
                        {...register('experience', { min: 0, max: 50 })}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Service Information */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Wrench className="w-5 h-5 mr-2" />
                    Service Information
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Service Radius (km)
                      </label>
                      <input
                        type="number"
                        {...register('serviceRadius', { min: 1, max: 50 })}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price Range
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Minimum (৳)</label>
                          <input
                            type="number"
                            {...register('priceRange.min', { min: 0 })}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Maximum (৳)</label>
                          <input
                            type="number"
                            {...register('priceRange.max', { min: 0 })}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Working Hours
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                          <input
                            type="time"
                            {...register('workingHours.start')}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">End Time</label>
                          <input
                            type="time"
                            {...register('workingHours.end')}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tools & Equipment
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {toolTypes.map((tool) => (
                          <label key={tool.value} className="flex items-center">
                            <input
                              type="checkbox"
                              value={tool.value}
                              {...register('tools')}
                              disabled={!isEditing}
                              className="mr-2"
                            />
                            <span className="text-sm">{tool.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Garage Information */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Garage Information
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Garage Name
                      </label>
                      <input
                        type="text"
                        {...register('garage.name')}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Garage Address
                      </label>
                      <textarea
                        {...register('garage.address')}
                        disabled={!isEditing}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Documents & Emergency Contact */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Documents & Emergency Contact
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        NID Number
                      </label>
                      <input
                        type="text"
                        {...register('documents.nidNumber')}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        License Number
                      </label>
                      <input
                        type="text"
                        {...register('documents.licenseNumber')}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Emergency Contact Name
                      </label>
                      <input
                        type="text"
                        {...register('emergencyContact.name')}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Emergency Contact Phone
                      </label>
                      <input
                        type="tel"
                        {...register('emergencyContact.phone')}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Emergency Contact Relation
                      </label>
                      <input
                        type="text"
                        {...register('emergencyContact.relation')}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Reviews Section */}
            <div className="mt-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Reviews ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No reviews yet</div>
              ) : (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-gray-900">{r.user?.name || 'User'}</div>
                        <div className="text-sm text-gray-500">{new Date(r.date).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={i < Math.round(r.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                        ))}
                        <span className="ml-2 text-sm text-gray-600">{r.rating}</span>
                      </div>
                      {r.comment && <p className="text-gray-700">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MechanicProfilePage;

