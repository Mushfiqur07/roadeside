const express = require('express');
const mongoose = require('mongoose');
const Mechanic = require('../models/Mechanic');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { authenticateToken, requireMechanic } = require('../middleware/auth');
const MechanicChangeRequest = require('../models/MechanicChangeRequest');
const MechanicChangeLog = require('../models/MechanicChangeLog');
const PricingPolicy = require('../models/PricingPolicy');
const Request = require('../models/Request');

const router = express.Router();

// @route   GET /api/mechanics/nearby
// @desc    Get available mechanics near a location
// @access  Public
router.get('/nearby', async (req, res) => {
  try {
    const { longitude, latitude, vehicleType, maxDistance = 50000, includeUnavailable = 'false' } = req.query; // Increased to 50km for better coverage

    if (!longitude || !latitude) {
      return res.status(400).json({
        message: 'Longitude and latitude are required',
        success: false
      });
    }

    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);
    const maxDist = parseInt(maxDistance);

    if (isNaN(lng) || isNaN(lat) || lng === 0 || lat === 0) {
      return res.status(400).json({
        message: 'Invalid longitude or latitude - coordinates cannot be zero',
        success: false
      });
    }

    // Find available mechanics nearby
    const mechanics = await Mechanic.findAvailableNearby(lng, lat, vehicleType, maxDist, includeUnavailable === 'true');

    // Calculate distance for each mechanic
    const mechanicsWithDistance = mechanics.map(mechanic => {
      const distance = mechanic.getDistanceFrom(lng, lat);
      return {
        ...mechanic.toObject(),
        distance: distance
      };
    });

    // Sort by distance
    mechanicsWithDistance.sort((a, b) => a.distance - b.distance);

    res.json({
      message: 'Nearby mechanics retrieved successfully',
      success: true,
      data: {
        mechanics: mechanicsWithDistance,
        count: mechanicsWithDistance.length,
        searchParams: {
          location: [lng, lat],
          vehicleType: vehicleType || 'all',
          maxDistance: maxDist
        }
      }
    });

  } catch (error) {
    console.error('Get nearby mechanics error:', error);
    res.status(500).json({
      message: 'Failed to get nearby mechanics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   POST /api/mechanics/match
// @desc    Match user with an available nearby mechanic
// @access  Private (User)
router.post('/match', authenticateToken, async (req, res) => {
  try {
    const { longitude, latitude, vehicleType } = req.body;
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      return res.status(400).json({ success: false, message: 'Valid longitude and latitude are required' });
    }
    const candidates = await Mechanic.findAvailableNearby(longitude, latitude, vehicleType, 20000);
    if (!candidates.length) {
      return res.status(404).json({ success: false, message: 'No available mechanics nearby' });
    }
    const mechanic = candidates[0];
    return res.json({ success: true, message: 'Mechanic matched successfully', data: { mechanic } });
  } catch (error) {
    console.error('Mechanic match error:', error);
    return res.status(500).json({ success: false, message: 'Failed to match mechanic', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
});

// @route   GET /api/mechanics/:id
// @desc    Get mechanic details by ID
// @access  Public
router.get('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId to prevent CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`Invalid ObjectId received: "${id}"`);
      return res.status(400).json({
        message: 'Invalid mechanic ID format',
        success: false
      });
    }

    console.log(`Fetching mechanic with valid ObjectId: ${id}`);

    const mechanic = await Mechanic.findById(id)
      .populate('userId', 'name phone profileImage location createdAt');

    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic not found',
        success: false
      });
    }

    res.json({ message: 'Mechanic details retrieved successfully', success: true, data: { mechanic } });

  } catch (error) {
    console.error('Get mechanic details error:', error);
    res.status(500).json({
      message: 'Failed to get mechanic details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/mechanics/:id/reviews
// @desc    Get reviews for a mechanic (from requests' user ratings)
// @access  Public
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid mechanic ID format' });
    }

    const reviews = await Request.find({ mechanicId: id, 'rating.userRating': { $ne: null } })
      .select('rating createdAt userId problemType')
      .populate('userId', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(200);

    const formatted = reviews.map(r => ({
      id: r._id,
      rating: r.rating?.userRating || null,
      comment: r.rating?.userComment || '',
      date: r.createdAt,
      user: r.userId ? { id: r.userId._id, name: r.userId.name, profileImage: r.userId.profileImage } : null,
      requestType: r.problemType
    }));

    return res.json({ success: true, message: 'Reviews loaded', data: { reviews: formatted } });
  } catch (error) {
    console.error('Get mechanic reviews error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load reviews' });
  }
});

// @route   GET /api/mechanics/:id/history
// @desc    Get mechanic history analytics and performance data
// @access  Private (Mechanic self or Admin)
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid mechanic ID format', success: false });
    }

    const mechanic = await Mechanic.findById(id).populate('userId', 'name');
    if (!mechanic) {
      return res.status(404).json({ message: 'Mechanic not found', success: false });
    }

    // Authorization: mechanic can view only their own, admin can view any
    const isSelf = String(mechanic.userId?._id) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Access denied', success: false });
    }

    // Aggregate requests for analytics
    const mechObjectId = new mongoose.Types.ObjectId(id);

    const [completedRequests, totals, byMonth, byCategory, ratingsTrend, geoPoints, responseTimes, earningsByMonth] = await Promise.all([
      // Completed requests list (last 100)
      require('../models/Request').find({ mechanicId: mechObjectId, status: 'completed' })
        .select('createdAt vehicleType problemType actualCost rating userId pickupLocation timeline')
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .limit(100),

      // Totals and averages
      require('../models/Request').aggregate([
        { $match: { mechanicId: mechObjectId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            earnings: { $sum: { $ifNull: ['$actualCost', 0] } },
            avgRating: { $avg: '$rating.userRating' }
          }
        }
      ]),

      // Earnings by month (last 12 months)
      require('../models/Request').aggregate([
        { $match: { mechanicId: mechObjectId, status: 'completed' } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, amount: { $sum: { $ifNull: ['$actualCost', 0] } }, count: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } }
      ]),

      // Jobs by category
      require('../models/Request').aggregate([
        { $match: { mechanicId: mechObjectId } },
        { $group: { _id: '$problemType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Ratings trend over time
      require('../models/Request').aggregate([
        { $match: { mechanicId: mechObjectId, 'rating.userRating': { $ne: null } } },
        { $project: { createdAt: 1, rating: '$rating.userRating' } },
        { $sort: { createdAt: 1 } }
      ]),

      // Geo points for heatmap (completed and accepted jobs)
      require('../models/Request').aggregate([
        { $match: { mechanicId: mechObjectId, 'pickupLocation.coordinates.0': { $ne: 0 }, 'pickupLocation.coordinates.1': { $ne: 0 } } },
        { $project: { _id: 0, coordinates: '$pickupLocation.coordinates', weight: { $cond: [{ $eq: ['$status', 'completed'] }, 1.5, 1] } } }
      ]),

      // Response time analytics
      require('../models/Request').aggregate([
        { $match: { mechanicId: mechObjectId } },
        {
          $group: {
            _id: null,
            avgAcceptMins: { $avg: { $divide: [{ $subtract: ['$timeline.acceptedAt', '$timeline.requestedAt'] }, 1000 * 60] } },
            avgArriveMins: { $avg: { $divide: [{ $subtract: ['$timeline.arrivedAt', '$timeline.acceptedAt'] }, 1000 * 60] } },
            avgCompleteMins: { $avg: { $divide: [{ $subtract: ['$timeline.completedAt', '$timeline.startedAt'] }, 1000 * 60] } }
          }
        }
      ]),

      // Earnings by month from payments (net to mechanic)
      Payment.aggregate([
        { $match: { mechanicId: mechObjectId, status: 'completed' } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, amount: { $sum: '$netToMechanic' }, count: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } }
      ])
    ]);

    const totalsObj = totals[0] || { total: 0, completed: 0, cancelled: 0, rejected: 0, earnings: 0, avgRating: 0 };
    const successRate = totalsObj.total > 0 ? Math.round((totalsObj.completed / totalsObj.total) * 100) : 0;

    res.json({
      message: 'Mechanic analytics retrieved successfully',
      success: true,
      data: {
        mechanic: { _id: mechanic._id, name: mechanic.userId?.name || 'Unknown' },
        totals: { ...totalsObj, successRate },
        earningsByMonth: earningsByMonth.length ? earningsByMonth : byMonth,
        jobsByCategory: byCategory,
        ratingsTrend,
        geoPoints,
        responseTimes: responseTimes[0] || { avgAcceptMins: null, avgArriveMins: null, avgCompleteMins: null },
        recentCompleted: completedRequests
      }
    });
  } catch (error) {
    console.error('Get mechanic analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch mechanic analytics', success: false });
  }
});

// @route   PUT /api/mechanics/availability
// @desc    Toggle mechanic availability
// @access  Private (Mechanic only)
router.put('/availability', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { isAvailable, currentLocation } = req.body;

    const mechanic = await Mechanic.findOne({ userId: req.user._id });

    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic profile not found',
        success: false
      });
    }

    // Update availability
    if (typeof isAvailable === 'boolean') {
      mechanic.isAvailable = isAvailable;

      // When enabling availability without a provided currentLocation, fallback to garage location
      if (isAvailable === true) {
        const hasNewLocation = currentLocation && Array.isArray(currentLocation.coordinates) && currentLocation.coordinates.length === 2 && !(currentLocation.coordinates[0] === 0 && currentLocation.coordinates[1] === 0);
        const hasExistingLocation = Array.isArray(mechanic.currentLocation?.coordinates) && mechanic.currentLocation.coordinates.length === 2 && !(mechanic.currentLocation.coordinates[0] === 0 && mechanic.currentLocation.coordinates[1] === 0);
        if (!hasNewLocation && !hasExistingLocation && mechanic.garage?.location?.coordinates) {
          mechanic.currentLocation = {
            type: mechanic.garage.location.type || 'Point',
            coordinates: mechanic.garage.location.coordinates,
            lastUpdated: new Date()
          };
        }
      }
    }

    // Update current location if provided
    if (currentLocation && currentLocation.coordinates) {
      mechanic.currentLocation = currentLocation;
    }

    await mechanic.save();

    res.json({
      message: `Availability ${mechanic.isAvailable ? 'enabled' : 'disabled'} successfully`,
      success: true,
      data: {
        mechanic: {
          _id: mechanic._id,
          isAvailable: mechanic.isAvailable,
          currentLocation: mechanic.currentLocation
        }
      }
    });

  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({
      message: 'Failed to update availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/mechanics/location
// @desc    Update mechanic's current location
// @access  Private (Mechanic only)
router.put('/location', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { coordinates } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({
        message: 'Valid coordinates [longitude, latitude] are required',
        success: false
      });
    }

    const [longitude, latitude] = coordinates;

    if (isNaN(longitude) || isNaN(latitude) || longitude === 0 || latitude === 0) {
      return res.status(400).json({
        message: 'Invalid coordinates - coordinates cannot be zero',
        success: false
      });
    }

    const mechanic = await Mechanic.findOne({ userId: req.user._id });

    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic profile not found',
        success: false
      });
    }

    // Update location
    mechanic.currentLocation.coordinates = [longitude, latitude];
    mechanic.currentLocation.lastUpdated = new Date();

    await mechanic.save();

    res.json({
      message: 'Location updated successfully',
      success: true,
      data: {
        location: mechanic.currentLocation
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      message: 'Failed to update location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/mechanics/profile
// @desc    Update mechanic profile
// @access  Private (Mechanic only)
router.put('/profile', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const updates = req.body;

    // Remove fields that shouldn't be updated via this route
    delete updates.userId;
    delete updates.rating;
    delete updates.totalRatings;
    delete updates.completedJobs;
    delete updates.verificationStatus;

    const mechanic = await Mechanic.findOne({ userId: req.user._id }).populate('userId', 'name phone email profileImage');

    if (!mechanic) {
      return res.status(404).json({ message: 'Mechanic profile not found', success: false });
    }

    // Determine sensitive fields and policy gates
    const sensitiveFields = ['garage', 'documents'];
    const hasSensitive = Object.keys(updates).some((k) => sensitiveFields.includes(k));

    // Pricing policy gate for priceRange
    let requiresReview = false;
    let diffs = {};

    // Compute diffs for logging and potential change request
    const computeDiff = (key, fromVal, toVal) => {
      if (typeof toVal === 'undefined') return;
      const fromJson = JSON.stringify(fromVal);
      const toJson = JSON.stringify(toVal);
      if (fromJson !== toJson) diffs[key] = { from: fromVal, to: toVal };
    };

    // Validate servicePrices shape if provided
    if (updates.servicePrices && typeof updates.servicePrices === 'object') {
      const allowedSkills = new Set([
        'engine_repair','tire_change','battery_jump','fuel_delivery','lockout_service','towing','brake_repair','electrical_repair','oil_change','ac_repair','general_maintenance'
      ]);
      const cleanMap = {};
      for (const [key, value] of Object.entries(updates.servicePrices)) {
        if (!allowedSkills.has(key)) continue; // ignore unknown keys
        if (!value || (typeof value.min !== 'number' && typeof value.max !== 'number')) continue;
        const minVal = typeof value.min === 'number' ? Math.max(0, value.min) : undefined;
        const maxVal = typeof value.max === 'number' ? Math.max(0, value.max) : undefined;
        // If both defined and min > max, swap
        let finalMin = minVal;
        let finalMax = maxVal;
        if (typeof finalMin === 'number' && typeof finalMax === 'number' && finalMin > finalMax) {
          const t = finalMin; finalMin = finalMax; finalMax = t;
        }
        cleanMap[key] = {};
        if (typeof finalMin === 'number') cleanMap[key].min = finalMin;
        if (typeof finalMax === 'number') cleanMap[key].max = finalMax;
        if (Object.keys(cleanMap[key]).length === 0) delete cleanMap[key];
      }
      updates.servicePrices = cleanMap;
    }

    // Compare fields
    computeDiff('skills', mechanic.skills, updates.skills);
    computeDiff('tools', mechanic.tools, updates.tools);
    computeDiff('workingHours', mechanic.workingHours, updates.workingHours);
    computeDiff('serviceRadius', mechanic.serviceRadius, updates.serviceRadius);
    computeDiff('priceRange', mechanic.priceRange, updates.priceRange);
    computeDiff('servicePrices', mechanic.servicePrices, updates.servicePrices);
    computeDiff('garage', mechanic.garage, updates.garage);
    computeDiff('documents', mechanic.documents, updates.documents);

    // Price policy evaluation
    if (updates.priceRange) {
      try {
        const policy = await PricingPolicy.findOne().sort({ updatedAt: -1 });
        const maxDelta = policy?.maxPriceDeltaFraction ?? 0.3;
        const defaultMin = policy?.defaultMin ?? 100;
        const defaultMax = policy?.defaultMax ?? 5000;

        const currentMin = mechanic.priceRange?.min ?? defaultMin;
        const currentMax = mechanic.priceRange?.max ?? defaultMax;
        const nextMin = typeof updates.priceRange.min === 'number' ? updates.priceRange.min : currentMin;
        const nextMax = typeof updates.priceRange.max === 'number' ? updates.priceRange.max : currentMax;

        const minDeltaOk = Math.abs(nextMin - currentMin) <= currentMin * maxDelta;
        const maxDeltaOk = Math.abs(nextMax - currentMax) <= currentMax * maxDelta;

        if (!minDeltaOk || !maxDeltaOk) {
          requiresReview = true;
        }
      } catch (e) {
        // If policy fetch fails, fall back to immediate update within schema validation
      }
    }

    if (hasSensitive || requiresReview) {
      // Create change request for admin review
      const changeRequest = await MechanicChangeRequest.create({
        mechanicId: mechanic._id,
        requestedBy: req.user._id,
        fieldsChanged: diffs
      });

      return res.status(202).json({
        message: 'Changes submitted for admin review',
        success: true,
        data: { requestId: changeRequest._id, pending: true }
      });
    }

    // Apply immediate updates for non-sensitive within policy
    Object.assign(mechanic, updates, { updatedAt: new Date() });
    await mechanic.save();

    // Log change
    if (Object.keys(diffs).length) {
      await MechanicChangeLog.create({ mechanicId: mechanic._id, actorId: req.user._id, diffs });
    }

    res.json({
      message: 'Mechanic profile updated successfully',
      success: true,
      data: {
        mechanic
      }
    });

  } catch (error) {
    console.error('Update mechanic profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors,
        success: false
      });
    }

    res.status(500).json({
      message: 'Failed to update mechanic profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/mechanics/profile
// @desc    Get mechanic's own profile
// @access  Private (Mechanic only)
router.get('/profile/me', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ userId: req.user._id })
      .populate('userId', 'name phone email profileImage location createdAt');

    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic profile not found',
        success: false
      });
    }

    res.json({
      message: 'Mechanic profile retrieved successfully',
      success: true,
      data: {
        mechanic
      }
    });

  } catch (error) {
    console.error('Get mechanic profile error:', error);
    res.status(500).json({
      message: 'Failed to get mechanic profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/mechanics
// @desc    Get all mechanics with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      vehicleType,
      skills,
      minRating,
      isAvailable,
      verificationStatus = 'verified'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { verificationStatus };

    if (vehicleType) {
      query.vehicleTypes = vehicleType;
    }

    if (skills) {
      query.skills = { $in: skills.split(',') };
    }

    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    // Get mechanics with pagination
    const mechanics = await Mechanic.find(query)
      .populate('userId', 'name phone profileImage location createdAt')
      .sort({ rating: -1, completedJobs: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Mechanic.countDocuments(query);

    res.json({
      message: 'Mechanics retrieved successfully',
      success: true,
      data: {
        mechanics,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get mechanics error:', error);
    res.status(500).json({
      message: 'Failed to get mechanics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/mechanics/profile
// @desc    Get current mechanic's profile
// @access  Private (Mechanic only)
router.get('/profile', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ userId: req.user._id })
      .populate('userId', 'name email phone profileImage')
      .select('-__v');

    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic profile not found',
        success: false
      });
    }

    res.json({
      message: 'Mechanic profile retrieved successfully',
      success: true,
      data: {
        mechanic
      }
    });

  } catch (error) {
    console.error('Get mechanic profile error:', error);
    res.status(500).json({
      message: 'Failed to get mechanic profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   POST /api/mechanics/fix-coordinates
// @desc    Fix mechanics with invalid coordinates (admin only)
// @access  Private (Admin only)
router.post('/fix-coordinates', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied - Admin only',
        success: false
      });
    }

    // Find mechanics with invalid coordinates
    const mechanicsWithInvalidCoords = await Mechanic.find({
      $or: [
        { 'currentLocation.coordinates': [0, 0] },
        { 'currentLocation.coordinates': { $exists: false } },
        { 'garage.location.coordinates': [0, 0] }
      ]
    });

    let fixedCount = 0;
    const defaultDhakaCoords = [90.4125, 23.8103]; // Default to Dhaka

    for (const mechanic of mechanicsWithInvalidCoords) {
      let needsUpdate = false;

      // Fix currentLocation if invalid
      if (!mechanic.currentLocation?.coordinates || 
          mechanic.currentLocation.coordinates[0] === 0 || 
          mechanic.currentLocation.coordinates[1] === 0) {
        
        if (mechanic.garage?.location?.coordinates && 
            mechanic.garage.location.coordinates[0] !== 0 && 
            mechanic.garage.location.coordinates[1] !== 0) {
          // Use garage location
          mechanic.currentLocation = {
            type: 'Point',
            coordinates: mechanic.garage.location.coordinates,
            lastUpdated: new Date()
          };
        } else {
          // Use default Dhaka coordinates
          mechanic.currentLocation = {
            type: 'Point',
            coordinates: defaultDhakaCoords,
            lastUpdated: new Date()
          };
        }
        needsUpdate = true;
      }

      // Fix garage location if invalid
      if (!mechanic.garage?.location?.coordinates || 
          mechanic.garage.location.coordinates[0] === 0 || 
          mechanic.garage.location.coordinates[1] === 0) {
        
        mechanic.garage.location = {
          type: 'Point',
          coordinates: defaultDhakaCoords
        };
        needsUpdate = true;
      }

      if (needsUpdate) {
        await mechanic.save();
        fixedCount++;
      }
    }

    res.json({
      message: `Fixed coordinates for ${fixedCount} mechanics`,
      success: true,
      data: {
        totalFound: mechanicsWithInvalidCoords.length,
        fixed: fixedCount
      }
    });

  } catch (error) {
    console.error('Fix coordinates error:', error);
    res.status(500).json({
      message: 'Failed to fix coordinates',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   POST /api/mechanics/fix-availability
// @desc    Fix mechanics availability status (admin only)
// @access  Private (Admin only)
router.post('/fix-availability', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied - Admin only',
        success: false
      });
    }

    // Find mechanics that need availability updates
    const mechanics = await Mechanic.find({
      verificationStatus: 'verified',
      isAvailable: false
    });

    let updatedCount = 0;

    for (const mechanic of mechanics) {
      await Mechanic.findByIdAndUpdate(mechanic._id, { isAvailable: true });
      updatedCount++;
    }

    res.json({
      message: `Updated ${updatedCount} mechanics to available status`,
      success: true,
      updatedCount
    });

  } catch (error) {
    console.error('Error fixing mechanic availability:', error);
    res.status(500).json({
      message: 'Server error while fixing availability',
      success: false
    });
  }
});

module.exports = router;
