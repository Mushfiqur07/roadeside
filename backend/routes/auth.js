const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Base ping for this router to avoid confusing 404s on GET /api/auth
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Auth API', endpoints: ['POST /register', 'POST /login', 'POST /admin/login', 'GET /me', 'PUT /profile', 'PUT /change-password'] });
});

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register new user or mechanic
// @access  Public
router.post('/register', async (req, res) => {
  console.log('Registration request received:', {
    body: req.body,
    headers: req.headers,
    method: req.method,
    url: req.url
  });
  
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      location,
      // Mechanic-specific fields
      vehicleTypes,
      skills,
      experience,
      serviceRadius,
      priceRange,
      tools,
      nidNumber,
      licenseNumber,
      emergencyContact,
      // Garage fields
      garageName,
      garageAddress,
      garageLocation
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        message: 'Name, email, password, and phone are required',
        success: false
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email already exists',
        success: false
      });
    }

    // Check if phone number already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        message: 'User with this phone number already exists',
        success: false
      });
    }

    // Create user
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone.trim(),
      role: role || 'user'
    };

    // Handle location data properly
    if (location && location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      // Validate coordinates are numbers
      const [lng, lat] = location.coordinates;
      if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
        userData.location = {
          type: 'Point',
          coordinates: [lng, lat],
          address: location.address || ''
        };
      }
    }

    const user = new User(userData);
    await user.save();

    // If registering as mechanic, create mechanic profile
    if (role === 'mechanic') {
      // Debug: Log all received data
      console.log('🔍 Mechanic registration data received:', {
        vehicleTypes,
        skills,
        experience,
        garageName,
        garageAddress,
        garageLocation,
        nidNumber,
        licenseNumber
      });

      // More flexible validation - only require essential fields
      const missingFields = [];
      
      // Check vehicleTypes - must be array with at least one item
      if (!vehicleTypes || !Array.isArray(vehicleTypes) || vehicleTypes.length === 0) {
        missingFields.push('vehicleTypes');
      }
      
      // Check skills - must be array with at least one item
      if (!skills || !Array.isArray(skills) || skills.length === 0) {
        missingFields.push('skills');
      }
      
      // Check experience - allow 0 as valid value
      if (experience === undefined || experience === null || experience === '') {
        missingFields.push('experience');
      }
      
      // Check garage name - must not be empty
      if (!garageName || garageName.trim() === '') {
        missingFields.push('garageName');
      }
      
      // Check garage address - must not be empty
      if (!garageAddress || garageAddress.trim() === '') {
        missingFields.push('garageAddress');
      }
      
      // Check garage location - must have valid coordinates
      if (!garageLocation || !garageLocation.coordinates || !Array.isArray(garageLocation.coordinates) || garageLocation.coordinates.length !== 2) {
        missingFields.push('garageLocation');
      }
      
      console.log('🔍 Missing fields check:', { 
        missingFields, 
        hasVehicleTypes: !!vehicleTypes, 
        vehicleTypesLength: Array.isArray(vehicleTypes) ? vehicleTypes.length : 'not array',
        hasSkills: !!skills, 
        skillsLength: Array.isArray(skills) ? skills.length : 'not array',
        hasExperience: experience !== undefined,
        experienceValue: experience,
        garageName: garageName,
        garageAddress: garageAddress,
        garageLocation: garageLocation,
        garageLocationCoords: garageLocation?.coordinates
      });
      
      if (missingFields.length > 0) {
        // Delete the user if essential mechanic data is incomplete
        await User.findByIdAndDelete(user._id);
        console.log('❌ Registration failed - missing fields:', missingFields);
        return res.status(400).json({
          message: `Required mechanic fields missing: ${missingFields.join(', ')}`,
          success: false,
          missingFields,
          receivedData: {
            vehicleTypes,
            skills,
            experience,
            garageName,
            garageAddress,
            garageLocation
          }
        });
      }

      const mechanicData = {
        userId: user._id,
        vehicleTypes: Array.isArray(vehicleTypes) ? vehicleTypes : [vehicleTypes].filter(Boolean),
        skills: Array.isArray(skills) ? skills : [skills].filter(Boolean),
        experience: parseInt(experience) || 0,
        serviceRadius: parseInt(serviceRadius) || 10,
        priceRange: {
          min: parseInt(priceRange?.min) || 200,
          max: parseInt(priceRange?.max) || 2000
        },
        tools: tools || [],
        documents: {
          nidNumber: nidNumber || '',
          licenseNumber: licenseNumber || ''
        },
        emergencyContact: emergencyContact || {
          name: 'Emergency Contact',
          phone: phone,
          relation: 'Self'
        },
        // Garage information - required for all mechanics
        garage: {
          name: garageName.trim(),
          address: garageAddress.trim(),
          location: {
            type: 'Point',
            coordinates: garageLocation.coordinates // [longitude, latitude]
          }
        },
        // Current location: set from user location if provided, otherwise default to garage location
        currentLocation: userData.location && userData.location.coordinates && 
                        userData.location.coordinates[0] !== 0 && userData.location.coordinates[1] !== 0
          ? { type: 'Point', coordinates: userData.location.coordinates, lastUpdated: new Date() }
          : { type: 'Point', coordinates: garageLocation.coordinates, lastUpdated: new Date() },
        // Default registration state for mechanics - auto-verify and make available for demo
        verificationStatus: 'verified',
        isAvailable: true,
        rating: 5.0, // Default rating
        totalRatings: 0,
        completedJobs: 0,
        // The following defaults are already set above; keep only fallbacks where needed
        serviceRadius: parseInt(serviceRadius) || 10, // Default 10km radius
        priceRange: (priceRange && typeof priceRange === 'object') ? {
          min: parseInt(priceRange.min) || 200,
          max: parseInt(priceRange.max) || 2000
        } : { min: 200, max: 2000 },
        tools: Array.isArray(tools) && tools.length > 0 ? tools : ['basic_toolkit']
      };

      // Remove redundant assignments since we already set defaults above
      console.log('Creating mechanic with data:', mechanicData);
      
      const mechanic = new Mechanic(mechanicData);
      await mechanic.save();
      
      console.log('Mechanic created successfully:', mechanic._id);
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Return user data without password
    const userResponse = user.getPublicProfile();

    res.status(201).json({
      message: `${role === 'mechanic' ? 'Mechanic' : 'User'} registered successfully`,
      success: true,
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({
        message: 'Validation error',
        errors,
        success: false
      });
    }

    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        message: `${field} already exists`,
        success: false
      });
    }

    res.status(500).json({
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user and return JWT token
// @access  Public
const loginHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        success: false
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
        success: false
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated. Please contact support.',
        success: false
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid email or password',
        success: false
      });
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Get mechanic data if user is a mechanic
    let mechanicData = null;
    if (user.role === 'mechanic') {
      mechanicData = await Mechanic.findOne({ userId: user._id });
    }

    // Return user data without password
    const userResponse = user.getPublicProfile();

    res.json({
      message: 'Login successful',
      success: true,
      data: {
        user: userResponse,
        mechanic: mechanicData,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
};

// Public: normal login
router.post('/login', loginHandler);

// Public: admin login alias (same as normal login)
router.post('/admin/login', loginHandler);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // Get mechanic data if user is a mechanic
    let mechanicData = null;
    if (user.role === 'mechanic') {
      mechanicData = await Mechanic.findOne({ userId: user._id });
    }

    res.json({
      message: 'Profile retrieved successfully',
      success: true,
      data: {
        user: user.getPublicProfile(),
        mechanic: mechanicData
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this route
    delete updates.password;
    delete updates.email;
    delete updates.role;

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    res.json({
      message: 'Profile updated successfully',
      success: true,
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors,
        success: false
      });
    }

    res.status(500).json({
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required',
        success: false
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: 'New password must be at least 6 characters long',
        success: false
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        message: 'Current password is incorrect',
        success: false
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully',
      success: true
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

module.exports = router;
