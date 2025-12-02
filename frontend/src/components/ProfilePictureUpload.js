import React, { useState, useRef } from 'react';
import { Camera, Upload, X, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { uploadProfilePicture, deleteProfilePicture } from '../api/upload';
import toast from 'react-hot-toast';

const ProfilePictureUpload = ({ 
  currentImage, 
  onImageChange, 
  size = 'large',
  disabled = false 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32',
    xlarge: 'w-40 h-40'
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    handleUpload(file);
  };

  const handleUpload = async (file) => {
    setIsUploading(true);
    try {
      const response = await uploadProfilePicture(file);
      if (response.success) {
        onImageChange(response.data.profileImage);
        toast.success('Profile picture updated successfully');
        setPreview(null);
      } else {
        toast.error(response.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentImage) return;

    setIsUploading(true);
    try {
      const response = await deleteProfilePicture();
      if (response.success) {
        onImageChange('');
        toast.success('Profile picture removed');
        setPreview(null);
      } else {
        toast.error(response.message || 'Failed to delete image');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';
  const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

  const normalizeUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
    return url;
  };

  const displayImage = preview || normalizeUrl(currentImage);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div
          className={`
            ${sizeClasses[size]} 
            rounded-full border-2 border-dashed border-gray-300 
            flex items-center justify-center cursor-pointer
            hover:border-blue-400 transition-colors duration-200
            ${disabled ? 'cursor-not-allowed opacity-50' : ''}
            ${isUploading ? 'animate-pulse' : ''}
          `}
          onClick={handleClick}
        >
          {displayImage ? (
            <img
              src={displayImage}
              alt="Profile"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-gray-400" />
          )}
          
          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
              />
            </div>
          )}
        </div>

        {displayImage && !isUploading && !disabled && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      <div className="text-center">
        <button
          onClick={handleClick}
          disabled={disabled || isUploading}
          className={`
            inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
            transition-colors duration-200
            ${disabled || isUploading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          {isUploading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
              />
              Uploading...
            </>
          ) : displayImage ? (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Change Photo
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </>
          )}
        </button>
        
        <p className="text-xs text-gray-500 mt-1">
          Max 5MB, JPG/PNG/GIF
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
    </div>
  );
};

export default ProfilePictureUpload;

