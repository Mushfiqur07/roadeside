const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Base ping
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Upload API', endpoints: ['POST /profile-picture', 'DELETE /profile-picture'] });
});

// Ensure uploads directory exists
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'profiles');

// Create directory if it doesn't exist
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsRoot);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// @route   POST /api/upload/profile-picture
// @desc    Upload profile picture
// @access  Private
router.post('/profile-picture', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No file uploaded',
        success: false
      });
    }

    const fileUrl = `/uploads/profiles/${req.file.filename}`;
    
    // Update user's profile image
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: fileUrl },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    res.json({
      message: 'Profile picture uploaded successfully',
      success: true,
      data: {
        profileImage: fileUrl,
        user
      }
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(uploadsRoot, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      message: 'Failed to upload profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   DELETE /api/upload/profile-picture
// @desc    Delete profile picture
// @access  Private
router.delete('/profile-picture', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    // Delete old profile image file if it exists
    if (user.profileImage && user.profileImage.startsWith('/uploads/profiles/')) {
      const fileName = path.basename(user.profileImage);
      const filePath = path.join(uploadsRoot, fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update user's profile image to empty
    user.profileImage = '';
    await user.save();

    res.json({
      message: 'Profile picture deleted successfully',
      success: true,
      data: {
        profileImage: '',
        user
      }
    });

  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      message: 'Failed to delete profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

module.exports = router;


