import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Edit3, 
  Save, 
  X, 
  Eye, 
  EyeOff,
  Lock,
  Star,
  Calendar,
  Shield,
  Building2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Map from '../components/Map';
import ProfilePictureUpload from '../components/ProfilePictureUpload';

const Profile = () => {
  const { user, mechanic, updateProfile, changePassword, updateUser } = useAuth();
  
  // Debug logging
  console.log('Profile component - User:', user);
  console.log('Profile component - Mechanic:', mechanic);
  console.log('Profile component - User role:', user?.role);
  console.log('Profile component - Mechanic garage:', mechanic?.garage);
  const { currentLocation, setManualLocation } = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
    reset: resetProfile,
    setValue: setProfileValue
  } = useForm({
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || ''
    }
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch
  } = useForm();

  const watchNewPassword = watch('newPassword');

  React.useEffect(() => {
    if (user) {
      setProfileValue('name', user.name || '');
      setProfileValue('phone', user.phone || '');
      setProfileValue('email', user.email || '');
    }
  }, [user, setProfileValue]);

  const onProfileSubmit = async (data) => {
    try {
      setIsLoading(true);
      await updateProfile(data);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      setIsLoading(true);
      await changePassword(data.currentPassword, data.newPassword);
      toast.success('Password changed successfully!');
      setIsChangingPassword(false);
      resetPassword();
    } catch (error) {
      console.error('Password change failed:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    resetProfile({
      name: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || ''
    });
  };

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    resetPassword();
  };

  const handleLocationUpdate = async () => {
    if (currentLocation) {
      try {
        await setManualLocation(currentLocation.coordinates, currentLocation.address);
        toast.success('Location updated successfully!');
      } catch (error) {
        toast.error('Failed to update location');
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600">Manage your account settings and preferences</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="text-center">
                <div className="mx-auto mb-4">
                  <ProfilePictureUpload
                    currentImage={user?.profileImage}
                    onImageChange={(url) => {
                      try { updateUser({ ...user, profileImage: url }); } catch (e) {}
                    }}
                    size="large"
                  />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
                <p className="text-gray-600 capitalize">{user.role}</p>
                
                {user.role === 'mechanic' && mechanic && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600">
                        {mechanic.rating} ({mechanic.totalRatings} reviews)
                      </span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {mechanic.experience} years experience
                      </span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span className={`text-sm px-2 py-1 rounded-full ${
                        mechanic.verificationStatus === 'verified'
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {mechanic.verificationStatus === 'verified' ? 'Verified' : 'Pending Verification'}
                      </span>
                    </div>
                    {mechanic.garage && (
                      <div className="flex items-center justify-center space-x-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {mechanic.garage.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Profile Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2 space-y-8"
          >
            {/* Personal Information */}
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn btn-outline btn-sm flex items-center space-x-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      {...registerProfile('name', { 
                        required: 'Name is required',
                        minLength: { value: 2, message: 'Name must be at least 2 characters' }
                      })}
                      className={`input w-full ${profileErrors.name ? 'border-red-300' : ''}`}
                      placeholder="Enter your full name"
                    />
                    {profileErrors.name && (
                      <p className="text-red-500 text-sm mt-1">{profileErrors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      {...registerProfile('phone', { 
                        required: 'Phone number is required',
                        pattern: {
                          value: /^(\+8801|01)[3-9]\d{8}$/,
                          message: 'Please enter a valid Bangladeshi phone number'
                        }
                      })}
                      className={`input w-full ${profileErrors.phone ? 'border-red-300' : ''}`}
                      placeholder="01XXXXXXXXX"
                    />
                    {profileErrors.phone && (
                      <p className="text-red-500 text-sm mt-1">{profileErrors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      {...registerProfile('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Please enter a valid email address'
                        }
                      })}
                      className={`input w-full ${profileErrors.email ? 'border-red-300' : ''}`}
                      placeholder="your@email.com"
                    />
                    {profileErrors.email && (
                      <p className="text-red-500 text-sm mt-1">{profileErrors.email.message}</p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn btn-primary flex items-center space-x-2"
                    >
                      {isLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Save Changes</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="btn btn-outline flex items-center space-x-2"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Full Name</p>
                      <p className="font-medium">{user.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Phone Number</p>
                      <p className="font-medium">{user.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Email Address</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Location Information */}
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Location</h3>
                {currentLocation && (
                  <button
                    onClick={handleLocationUpdate}
                    className="btn btn-outline btn-sm flex items-center space-x-2"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Update</span>
                  </button>
                )}
              </div>

              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Current Location</p>
                  <p className="font-medium">
                    {currentLocation?.address || 'Location not set'}
                  </p>
                  {currentLocation && (
                    <p className="text-sm text-gray-400 mt-1">
                      Last updated: {new Date(currentLocation.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white rounded-xl shadow-soft p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Security</h3>
                {!isChangingPassword && (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="btn btn-outline btn-sm flex items-center space-x-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Change Password</span>
                  </button>
                )}
              </div>

              {isChangingPassword ? (
                <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        {...registerPassword('currentPassword', { 
                          required: 'Current password is required'
                        })}
                        className={`input w-full pr-10 ${passwordErrors.currentPassword ? 'border-red-300' : ''}`}
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.currentPassword && (
                      <p className="text-red-500 text-sm mt-1">{passwordErrors.currentPassword.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        {...registerPassword('newPassword', { 
                          required: 'New password is required',
                          minLength: { value: 6, message: 'Password must be at least 6 characters' }
                        })}
                        className={`input w-full pr-10 ${passwordErrors.newPassword ? 'border-red-300' : ''}`}
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="text-red-500 text-sm mt-1">{passwordErrors.newPassword.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        {...registerPassword('confirmPassword', { 
                          required: 'Please confirm your new password',
                          validate: value => value === watchNewPassword || 'Passwords do not match'
                        })}
                        className={`input w-full pr-10 ${passwordErrors.confirmPassword ? 'border-red-300' : ''}`}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <p className="text-red-500 text-sm mt-1">{passwordErrors.confirmPassword.message}</p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn btn-primary flex items-center space-x-2"
                    >
                      {isLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Change Password</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPasswordChange}
                      className="btn btn-outline flex items-center space-x-2"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center space-x-3">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Password</p>
                    <p className="font-medium">••••••••</p>
                  </div>
                </div>
              )}
            </div>

            {/* Garage Information - Only for Mechanics */}
            {user.role === 'mechanic' && mechanic?.garage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-white rounded-xl shadow-soft p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <Building2 className="w-5 h-5 text-primary-600" />
                    <span>Garage Information</span>
                  </h3>
                </div>

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

                  {mechanic.garage.location && mechanic.garage.location.coordinates && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-2">Garage Location</p>
                      <div className="border rounded-lg overflow-hidden">
                        <Map
                          center={[mechanic.garage.location.coordinates[1], mechanic.garage.location.coordinates[0]]}
                          zoom={15}
                          height="200px"
                          markers={[{
                            id: 'garage',
                            lat: mechanic.garage.location.coordinates[1],
                            lng: mechanic.garage.location.coordinates[0],
                            color: '#3B82F6',
                            size: 'large',
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
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
