const express = require('express');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');
const Request = require('../models/Request');
const Promotion = require('../models/Promotion');
const Subscription = require('../models/Subscription');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const MechanicChangeRequest = require('../models/MechanicChangeRequest');
const MechanicChangeLog = require('../models/MechanicChangeLog');
const PricingPolicy = require('../models/PricingPolicy');
const mongoose = require('mongoose');

const router = express.Router();

// Helper: robust parse for UI formatted date strings like "10/07/2025 , 04:37 PM"
function parseDateFlexible(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input) ? null : input;
  if (typeof input === 'number') return new Date(input);
  let s = String(input).trim();
  s = s.replace(/\s*,\s*/g, ' ').replace(/\s{2,}/g, ' ');
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (m) {
    let [, mm, dd, yyyy, hh, min, ap] = m;
    mm = parseInt(mm, 10) - 1; dd = parseInt(dd, 10); yyyy = parseInt(yyyy, 10);
    hh = parseInt(hh, 10); min = parseInt(min, 10);
    if (/PM/i.test(ap) && hh < 12) hh += 12;
    if (/AM/i.test(ap) && hh === 12) hh = 0;
    const d = new Date(yyyy, mm, dd, hh, min, 0, 0);
    return isNaN(d) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Apply admin authentication to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Simple Settings model (in-memory fallback) using mongoose without a dedicated file
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true, collection: 'settings' });
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingsSchema);

// Default settings
const DEFAULT_SETTINGS = {
  platformName: 'RoadAssist BD',
  commissionRate: 0.1,
  slaMinutes: 45,
  verificationRequired: true,
  maintenanceMode: false
};

async function getAllSettings() {
  const docs = await Setting.find({});
  const map = { ...DEFAULT_SETTINGS };
  docs.forEach(d => { map[d.key] = d.value; });
  return map;
}

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json({ success: true, message: 'Settings loaded', data: settings });
  } catch (e) {
    console.error('Get settings error:', e);
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

// PUT /api/admin/settings
router.put('/settings', async (req, res) => {
  try {
    const updates = req.body || {};
    const keys = Object.keys(updates);
    for (const key of keys) {
      await Setting.findOneAndUpdate({ key }, { key, value: updates[key] }, { upsert: true, new: true });
    }
    const settings = await getAllSettings();
    res.json({ success: true, message: 'Settings updated', data: settings });
  } catch (e) {
    console.error('Update settings error:', e);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// ===== Promotions (Admin) =====
router.get('/promotions', async (req, res) => {
  try {
    const promos = await Promotion.find().sort({ createdAt: -1 });
    res.json({ success: true, message: 'Promotions loaded', data: { promotions: promos } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load promotions' });
  }
});

router.post('/promotions', async (req, res) => {
  try {
    const body = req.body || {};
    // Normalize UI payload → schema fields
    const typeMap = {
      'Percentage Discount': 'percent',
      'Flat Discount': 'flat',
      'Boost Supply': 'boost_supply',
      'percent': 'percent',
      'flat': 'flat',
      'boost_supply': 'boost_supply'
    };

    const payload = {
      name: String(body.name || body.promotionName || '').trim(),
      code: String(body.code || body.promotionCode || '').trim().toUpperCase(),
      description: String(body.description || ''),
      type: typeMap[body.type] || typeMap[body.promotionType] || 'percent',
      value: Number(body.value ?? body.discount ?? 0),
      maxDiscount: Number(body.maxDiscount ?? 0),
      startsAt: parseDateFlexible(body.startsAt) || parseDateFlexible(body.startDate) || new Date(),
      endsAt: parseDateFlexible(body.endsAt) || parseDateFlexible(body.endDate) || new Date(Date.now() + 24*60*60*1000),
      target: ['all','user','area'].includes(String(body.target || 'all')) ? String(body.target || 'all') : 'all',
      isActive: body.isActive !== false,
      createdBy: req.user._id
    };

    // Basic validation
    if (!payload.name || !payload.code) {
      return res.status(400).json({ success: false, message: 'name and code are required' });
    }
    if (!(payload.startsAt instanceof Date) || isNaN(payload.startsAt)) {
      return res.status(400).json({ success: false, message: 'Invalid startsAt/startDate' });
    }
    if (!(payload.endsAt instanceof Date) || isNaN(payload.endsAt)) {
      return res.status(400).json({ success: false, message: 'Invalid endsAt/endDate' });
    }
    if (payload.endsAt <= payload.startsAt) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }

    const doc = await Promotion.create(payload);
    res.json({ success: true, message: 'Promotion created', data: { promotion: doc } });
  } catch (e) {
    console.error('Create promotion error:', e);
    const message = e?.code === 11000 ? 'Promotion code already exists' : (e?.message || 'Failed to create promotion');
    res.status(400).json({ success: false, message });
  }
});

router.put('/promotions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Promotion.findByIdAndUpdate(id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.json({ success: true, message: 'Promotion updated', data: { promotion: doc } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Failed to update promotion' });
  }
});

router.delete('/promotions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Promotion.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.json({ success: true, message: 'Promotion deleted' });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Failed to delete promotion' });
  }
});

// ===== Subscriptions (Admin) =====
router.get('/subscriptions', async (req, res) => {
  try {
    const subs = await Subscription.find().populate('userId', 'name email phone').sort({ createdAt: -1 });
    res.json({ success: true, message: 'Subscriptions loaded', data: { subscriptions: subs } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load subscriptions' });
  }
});

router.put('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Subscription.findByIdAndUpdate(id, { status: 'cancelled', endsAt: new Date() }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Subscription not found' });
    res.json({ success: true, message: 'Subscription cancelled', data: { subscription: doc } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message || 'Failed to cancel subscription' });
  }
});

// Maintenance controls
router.post('/maintenance/start', async (req, res) => {
  try {
    const { reason } = req.body || {};
    await Setting.findOneAndUpdate({ key: 'maintenanceMode' }, { key: 'maintenanceMode', value: true }, { upsert: true, new: true });
    // Log activity
    await Setting.findOneAndUpdate(
      { key: 'maintenanceLog' },
      { $push: { value: { action: 'start', at: new Date(), by: req.user?._id, reason } } },
      { upsert: true, new: true }
    );
    // Notify via socket
    const io = req.app.get('io');
    if (io) io.emit('maintenance:started', { reason, at: new Date() });
    res.json({ success: true, message: 'Maintenance mode enabled' });
  } catch (e) {
    console.error('Start maintenance error:', e);
    res.status(500).json({ success: false, message: 'Failed to start maintenance' });
  }
});

router.post('/maintenance/stop', async (req, res) => {
  try {
    await Setting.findOneAndUpdate({ key: 'maintenanceMode' }, { key: 'maintenanceMode', value: false }, { upsert: true, new: true });
    await Setting.findOneAndUpdate(
      { key: 'maintenanceLog' },
      { $push: { value: { action: 'stop', at: new Date(), by: req.user?._id } } },
      { upsert: true, new: true }
    );
    const io = req.app.get('io');
    if (io) io.emit('maintenance:stopped', { at: new Date() });
    res.json({ success: true, message: 'Maintenance mode disabled' });
  } catch (e) {
    console.error('Stop maintenance error:', e);
    res.status(500).json({ success: false, message: 'Failed to stop maintenance' });
  }
});

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    // Get counts
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalMechanics = await User.countDocuments({ role: 'mechanic' });
    const pendingMechanics = await Mechanic.countDocuments({ verificationStatus: 'pending' });
    const verifiedMechanics = await Mechanic.countDocuments({ verificationStatus: 'verified' });
    const totalRequests = await Request.countDocuments();
    const activeRequests = await Request.countDocuments({ 
      status: { $in: ['pending', 'accepted', 'in_progress', 'arrived', 'working'] } 
    });
    const completedRequests = await Request.countDocuments({ status: 'completed' });
    const availableMechanics = await Mechanic.countDocuments({ isAvailable: true, verificationStatus: 'verified' });

    // Get recent requests
    const recentRequests = await Request.find()
      .populate([
        { path: 'userId', select: 'name phone' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }
      ])
      .sort({ createdAt: -1 })
      .limit(10);

    // Get request statistics by status
    const requestStats = await Request.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Compute revenue, average rating and average response time (completed requests)
    const kpiAgg = await Request.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$actualCost' },
          averageRating: { $avg: '$rating.userRating' },
          avgResponseTimeMs: { $avg: { $subtract: ['$timeline.completedAt', '$timeline.requestedAt'] } }
        }
      }
    ]);

    const totalRevenue = kpiAgg[0]?.totalRevenue || 0;
    const averageRating = kpiAgg[0]?.averageRating || 0;
    const avgResponseTime = kpiAgg[0]?.avgResponseTimeMs ? Math.round((kpiAgg[0].avgResponseTimeMs / (1000 * 60)) * 10) / 10 : 0; // minutes

    // Get monthly request trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await Request.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      message: 'Dashboard data retrieved successfully',
      success: true,
      data: {
        overview: {
          totalUsers,
          totalMechanics,
          totalRequests,
          activeRequests,
          completedRequests,
          availableMechanics,
          pendingMechanics,
          verifiedMechanics,
          totalRevenue,
          averageRating,
          avgResponseTime
        },
        recentRequests,
        requestStats,
        monthlyTrends
      }
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      message: 'Failed to get dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/admin/activity
// @desc    Get recent activity feed
// @access  Private (Admin only)
router.get('/activity', async (req, res) => {
  try {
    // Build recent activity from users, mechanics (verifications), requests (completed/cancelled), and paid requests
    const [recentUsers, recentMechanics, recentRequests, recentPaid] = await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(10).select('name createdAt'),
      Mechanic.find().sort({ updatedAt: -1 }).limit(10).select('verificationStatus updatedAt').populate('userId', 'name'),
      Request.find({ status: { $in: ['completed', 'cancelled'] } }).sort({ updatedAt: -1 }).limit(10).select('status updatedAt').populate('userId', 'name').populate({ path: 'mechanicId', populate: { path: 'userId', select: 'name' } }),
      Request.find({ paymentStatus: 'paid' }).sort({ updatedAt: -1 }).limit(10).select('actualCost updatedAt')
    ]);

    const activities = [];

    recentUsers.forEach(u => activities.push({ type: 'user_registered', user: u.name, timestamp: u.createdAt }));
    recentMechanics.forEach(m => activities.push({ type: m.verificationStatus === 'verified' ? 'mechanic_verified' : m.verificationStatus === 'rejected' ? 'mechanic_rejected' : 'mechanic_updated', user: m.userId?.name, timestamp: m.updatedAt }));
    recentRequests.forEach(r => activities.push({ type: r.status === 'completed' ? 'request_completed' : 'request_cancelled', user: r.userId?.name, mechanic: r.mechanicId?.userId?.name, timestamp: r.updatedAt }));
    recentPaid.forEach(p => activities.push({ type: 'payment_received', amount: p.actualCost, timestamp: p.updatedAt }));

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      message: 'Activity retrieved successfully',
      success: true,
      data: activities.slice(0, 20)
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      message: 'Failed to get recent activity',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filters
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      isActive,
      search
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(query);

    res.json({
      message: 'Users retrieved successfully',
      success: true,
      data: {
        users,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      message: 'Failed to get users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/admin/mechanics
// @desc    Get all mechanics with pagination and filters
// @access  Private (Admin only)
router.get('/mechanics', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isAvailable,
      verificationStatus,
      vehicleType,
      search
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};

    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }

    if (vehicleType) {
      query.vehicleTypes = vehicleType;
    }

    // For search, we need to populate user data
    let mechanics;
    let total;

    if (search) {
      // Use aggregation for search across populated fields
      const pipeline = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $match: {
            ...query,
            $or: [
              { 'user.name': { $regex: search, $options: 'i' } },
              { 'user.email': { $regex: search, $options: 'i' } },
              { 'user.phone': { $regex: search, $options: 'i' } }
            ]
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $skip: skip
        },
        {
          $limit: limitNum
        }
      ];

      mechanics = await Mechanic.aggregate(pipeline);
      
      // Get total count for pagination
      const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
      countPipeline.push({ $count: 'total' });
      const countResult = await Mechanic.aggregate(countPipeline);
      total = countResult[0]?.total || 0;
    } else {
      mechanics = await Mechanic.find(query)
        .populate('userId', 'name email phone profileImage location createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      total = await Mechanic.countDocuments(query);
    }

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

// @route   GET /api/admin/requests
// @desc    Get all requests with pagination and filters
// @access  Private (Admin only)
router.get('/requests', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      vehicleType,
      priority,
      startDate,
      endDate
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};

    if (status) {
      query.status = status;
    }

    if (vehicleType) {
      query.vehicleType = vehicleType;
    }

    if (priority) {
      query.priority = priority;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const requests = await Request.find(query)
      .populate([
        { path: 'userId', select: 'name phone profileImage' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Request.countDocuments(query);

    res.json({
      message: 'Requests retrieved successfully',
      success: true,
      data: {
        requests,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      message: 'Failed to get requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (activate/deactivate)
// @access  Private (Admin only)
router.put('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/admin/mechanics/:id/verification
// @desc    Update mechanic verification status
// @access  Private (Admin only)
router.put('/mechanics/:id/verification', async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, notes } = req.body;

    const mechanic = await Mechanic.findByIdAndUpdate(
      id,
      { verificationStatus, updatedAt: new Date() },
      { new: true }
    ).populate('userId', 'name email phone');

    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic not found',
        success: false
      });
    }

    // Add admin note if provided
    if (notes) {
      // You could create a separate notes system or add to a notes array
      console.log(`Admin note for mechanic ${id}: ${notes}`);
    }

    res.json({
      message: `Mechanic verification status updated to ${verificationStatus}`,
      success: true,
      data: { mechanic }
    });

  } catch (error) {
    console.error('Update mechanic verification error:', error);
    res.status(500).json({
      message: 'Failed to update mechanic verification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   POST /api/admin/mechanics/backfill-current-location
// @desc    Backfill currentLocation from garage.location for mechanics missing it
// @access  Private (Admin only)
router.post('/mechanics/backfill-current-location', async (req, res) => {
  try {
    const mechanics = await Mechanic.find({
      $or: [
        { 'currentLocation.coordinates': { $exists: false } },
        { 'currentLocation.coordinates': [0, 0] }
      ]
    });

    let updated = 0;
    for (const mech of mechanics) {
      if (mech.garage?.location?.coordinates) {
        mech.currentLocation = {
          type: mech.garage.location.type || 'Point',
          coordinates: mech.garage.location.coordinates,
          lastUpdated: new Date()
        };
        await mech.save();
        updated += 1;
      }
    }

    res.json({
      message: 'Backfill completed',
      success: true,
      data: { total: mechanics.length, updated }
    });

  } catch (error) {
    console.error('Backfill current location error:', error);
    res.status(500).json({ message: 'Failed to backfill current locations', success: false });
  }
});

// @route   PUT /api/admin/requests/:id/status
// @desc    Update a request status (cancel or complete)
// @access  Private (Admin only)
router.put('/requests/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['cancelled', 'completed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status', success: false });
    }

    const request = await Request.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found', success: false });
    }

    request.status = status;
    const now = new Date();
    if (status === 'completed') {
      if (!request.timeline.startedAt) request.timeline.startedAt = request.timeline.arrivedAt || request.timeline.acceptedAt || request.timeline.requestedAt;
      request.timeline.completedAt = now;
    }
    await request.save();

    const populated = await Request.findById(id)
      .populate([{ path: 'userId', select: 'name phone' }, { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }]);

    res.json({
      message: `Request ${status} successfully`,
      success: true,
      data: { request: populated }
    });
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({
      message: 'Failed to update request status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (soft delete by deactivating)
// @access  Private (Admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete by deactivating
    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    // If user is a mechanic, also deactivate mechanic profile
    if (user.role === 'mechanic') {
      await Mechanic.findOneAndUpdate(
        { userId: id },
        { isAvailable: false, updatedAt: new Date() }
      );
    }

    res.json({
      message: 'User deleted successfully',
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// Helper function to get date range based on period
function getDateRange(period, startDate, endDate) {
  const now = new Date();
  let start, end;
  
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        end = now;
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        end = endDate ? new Date(endDate) : now;
        break;
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        end = now;
    }
  }
  
  return { start, end };
}

// @route   GET /api/admin/analytics/requests
// @desc    Get detailed request analytics
// @access  Private (Admin only)
router.get('/analytics/requests', async (req, res) => {
  try {
    const { period = 'month', startDate, endDate, vehicleType, problemType, mechanicId } = req.query;
    
    const { start, end } = getDateRange(period, startDate, endDate);
    
    // Build match query
    const matchQuery = {
      createdAt: { $gte: start, $lte: end }
    };
    
    if (vehicleType) matchQuery.vehicleType = vehicleType;
    if (problemType) matchQuery.problemType = problemType;
    if (mechanicId) matchQuery.mechanicId = new mongoose.Types.ObjectId(mechanicId);

    // Daily requests aggregation
    const dailyRequests = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $in: ['$status', ['accepted', 'in_progress', 'arrived', 'working']] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$actualCost', 0] } },
          avgCost: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$actualCost', null] } }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Vehicle type distribution
    const vehicleTypeDistribution = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$vehicleType',
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$actualCost', 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Problem type distribution
    const problemTypeDistribution = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$problemType',
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          avgCost: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$actualCost', null] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Calculate growth percentages
    const previousPeriod = await Request.aggregate([
      { 
        $match: {
          createdAt: { 
            $gte: new Date(start.getTime() - (end.getTime() - start.getTime())), 
            $lt: start 
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      }
    ]);

    const currentPeriod = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      }
    ]);

    const prevTotal = previousPeriod[0]?.total || 0;
    const currTotal = currentPeriod[0]?.total || 0;
    const prevCompleted = previousPeriod[0]?.completed || 0;
    const currCompleted = currentPeriod[0]?.completed || 0;

    const requestsGrowth = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal * 100) : 0;
    const completedGrowth = prevCompleted > 0 ? ((currCompleted - prevCompleted) / prevCompleted * 100) : 0;

    res.json({
      success: true,
      data: {
        period: { start, end },
        overview: {
          totalRequests: currTotal,
          completedRequests: currCompleted,
          requestsGrowth: Math.round(requestsGrowth * 10) / 10,
          completedGrowth: Math.round(completedGrowth * 10) / 10
        },
        dailyRequests,
        vehicleTypeDistribution,
        problemTypeDistribution
      }
    });

  } catch (error) {
    console.error('Get request analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get request analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/analytics/revenue
// @desc    Get detailed revenue analytics
// @access  Private (Admin only)
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { period = 'month', startDate, endDate, vehicleType, problemType, mechanicId } = req.query;
    
    const { start, end } = getDateRange(period, startDate, endDate);
    
    // Build match query for completed requests only
    const matchQuery = {
      createdAt: { $gte: start, $lte: end },
      status: 'completed'
    };
    
    if (vehicleType) matchQuery.vehicleType = vehicleType;
    if (problemType) matchQuery.problemType = problemType;
    if (mechanicId) matchQuery.mechanicId = new mongoose.Types.ObjectId(mechanicId);

    // Daily revenue aggregation
    const dailyRevenue = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          revenue: { $sum: '$actualCost' },
          count: { $sum: 1 },
          avgOrderValue: { $avg: '$actualCost' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Revenue by vehicle type
    const revenueByVehicleType = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$vehicleType',
          revenue: { $sum: '$actualCost' },
          count: { $sum: 1 },
          avgOrderValue: { $avg: '$actualCost' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Revenue by problem type
    const revenueByProblemType = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$problemType',
          revenue: { $sum: '$actualCost' },
          count: { $sum: 1 },
          avgOrderValue: { $avg: '$actualCost' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Total revenue for period
    const totalRevenue = await Request.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$actualCost' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$actualCost' }
        }
      }
    ]);

    // Previous period for growth calculation
    const previousPeriodRevenue = await Request.aggregate([
      { 
        $match: {
          createdAt: { 
            $gte: new Date(start.getTime() - (end.getTime() - start.getTime())), 
            $lt: start 
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$actualCost' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    const currentRevenue = totalRevenue[0]?.totalRevenue || 0;
    const previousRevenue = previousPeriodRevenue[0]?.totalRevenue || 0;
    const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue * 100) : 0;

    res.json({
      success: true,
      data: {
        period: { start, end },
        overview: {
          totalRevenue: currentRevenue,
          totalOrders: totalRevenue[0]?.totalOrders || 0,
          avgOrderValue: totalRevenue[0]?.avgOrderValue || 0,
          revenueGrowth: Math.round(revenueGrowth * 10) / 10
        },
        dailyRevenue,
        revenueByVehicleType,
        revenueByProblemType
      }
    });

  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get revenue analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/analytics/performance
// @desc    Get performance metrics analytics
// @access  Private (Admin only)
router.get('/analytics/performance', async (req, res) => {
  try {
    const { period = 'month', startDate, endDate, mechanicId } = req.query;
    
    const { start, end } = getDateRange(period, startDate, endDate);
    
    // Build match query
    const matchQuery = {
      createdAt: { $gte: start, $lte: end }
    };
    
    if (mechanicId) matchQuery.mechanicId = new mongoose.Types.ObjectId(mechanicId);

    // Average response time calculation
    const responseTimeStats = await Request.aggregate([
      { $match: { ...matchQuery, status: 'completed', 'timeline.acceptedAt': { $exists: true } } },
      {
        $addFields: {
          responseTimeMinutes: {
            $divide: [
              { $subtract: ['$timeline.acceptedAt', '$timeline.requestedAt'] },
              60000 // Convert to minutes
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTimeMinutes' },
          minResponseTime: { $min: '$responseTimeMinutes' },
          maxResponseTime: { $max: '$responseTimeMinutes' }
        }
      }
    ]);

    // Average rating calculation
    const ratingStats = await Request.aggregate([
      { $match: { ...matchQuery, status: 'completed', 'rating.userRating': { $exists: true } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating.userRating' },
          totalRatings: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating.userRating'
          }
        }
      }
    ]);

    // Top performing mechanics
    const topMechanics = await Request.aggregate([
      { $match: { ...matchQuery, status: 'completed', mechanicId: { $ne: null } } },
      {
        $group: {
          _id: '$mechanicId',
          completedJobs: { $sum: 1 },
          avgRating: { $avg: '$rating.userRating' },
          totalEarnings: { $sum: '$actualCost' },
          avgResponseTime: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$timeline.acceptedAt', null] }, { $ne: ['$timeline.requestedAt', null] }] },
                { $divide: [{ $subtract: ['$timeline.acceptedAt', '$timeline.requestedAt'] }, 60000] },
                null
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'mechanics',
          localField: '_id',
          foreignField: '_id',
          as: 'mechanic'
        }
      },
      { $unwind: '$mechanic' },
      {
        $lookup: {
          from: 'users',
          localField: 'mechanic.userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $addFields: {
          performanceScore: {
            $add: [
              { $multiply: ['$completedJobs', 10] },
              { $multiply: ['$avgRating', 20] },
              { $multiply: [{ $divide: [60, { $ifNull: ['$avgResponseTime', 60] }] }, 5] }
            ]
          }
        }
      },
      { $sort: { performanceScore: -1 } },
      { $limit: 10 }
    ]);

    // Previous period comparison for growth
    const previousPeriodStats = await Request.aggregate([
      { 
        $match: {
          createdAt: { 
            $gte: new Date(start.getTime() - (end.getTime() - start.getTime())), 
            $lt: start 
          },
          status: 'completed',
          'rating.userRating': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating.userRating' },
          totalCompleted: { $sum: 1 }
        }
      }
    ]);

    const currentAvgRating = ratingStats[0]?.avgRating || 0;
    const previousAvgRating = previousPeriodStats[0]?.avgRating || 0;
    const ratingGrowth = previousAvgRating > 0 ? ((currentAvgRating - previousAvgRating) / previousAvgRating * 100) : 0;

    res.json({
      success: true,
      data: {
        period: { start, end },
        overview: {
          avgResponseTime: Math.round((responseTimeStats[0]?.avgResponseTime || 0) * 10) / 10,
          avgRating: Math.round((currentAvgRating || 0) * 10) / 10,
          totalRatings: ratingStats[0]?.totalRatings || 0,
          ratingGrowth: Math.round(ratingGrowth * 10) / 10
        },
        topMechanics,
        responseTimeStats: responseTimeStats[0] || {},
        ratingStats: ratingStats[0] || {}
      }
    });

  } catch (error) {
    console.error('Get performance analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get legacy analytics data (kept for backward compatibility)
// @access  Private (Admin only)
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Request analytics
    const requestAnalytics = await Request.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          avgCost: { $avg: '$actualCost' }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    // Vehicle type distribution
    const vehicleTypeStats = await Request.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$vehicleType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Problem type distribution
    const problemTypeStats = await Request.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$problemType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Top performing mechanics
    const topMechanics = await Request.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'completed',
          mechanicId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$mechanicId',
          completedJobs: { $sum: 1 },
          avgRating: { $avg: '$rating.userRating' },
          totalEarnings: { $sum: '$actualCost' }
        }
      },
      {
        $lookup: {
          from: 'mechanics',
          localField: '_id',
          foreignField: '_id',
          as: 'mechanic'
        }
      },
      {
        $unwind: '$mechanic'
      },
      {
        $lookup: {
          from: 'users',
          localField: 'mechanic.userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $sort: { completedJobs: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      message: 'Analytics data retrieved successfully',
      success: true,
      data: {
        period,
        requestAnalytics,
        vehicleTypeStats,
        problemTypeStats,
        topMechanics
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      message: 'Failed to get analytics data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// ===== Mechanic change requests moderation =====
// GET pending/approved/rejected change requests
router.get('/mechanic-change-requests', async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (status) query.status = status;

    const [items, total] = await Promise.all([
      MechanicChangeRequest.find(query)
        .populate({ path: 'mechanicId', populate: { path: 'userId', select: 'name email phone' } })
        .populate('requestedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      MechanicChangeRequest.countDocuments(query)
    ]);

    res.json({ success: true, message: 'Change requests loaded', data: { items, pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum } } });
  } catch (e) {
    console.error('List change requests error:', e);
    res.status(500).json({ success: false, message: 'Failed to load change requests' });
  }
});

// POST approve change request
router.post('/mechanic-change-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await MechanicChangeRequest.findById(id);
    if (!doc || doc.status !== 'pending') return res.status(404).json({ success: false, message: 'Pending request not found' });

    const mech = await Mechanic.findById(doc.mechanicId);
    if (!mech) return res.status(404).json({ success: false, message: 'Mechanic not found' });

    // Apply changes
    const fields = doc.fieldsChanged || {};
    Object.keys(fields).forEach((k) => {
      const toVal = fields[k]?.to;
      if (typeof toVal !== 'undefined') {
        mech.set(k, toVal);
      }
    });
    mech.updatedAt = new Date();
    await mech.save();

    // Log and close request
    await MechanicChangeLog.create({ mechanicId: mech._id, actorId: req.user._id, diffs: fields });
    doc.status = 'approved';
    doc.reviewerId = req.user._id;
    doc.reviewerNotes = req.body?.notes || '';
    doc.decidedAt = new Date();
    await doc.save();

    res.json({ success: true, message: 'Change request approved and applied', data: { mechanic: mech, request: doc } });
  } catch (e) {
    console.error('Approve change request error:', e);
    res.status(500).json({ success: false, message: 'Failed to approve change request' });
  }
});

// POST reject change request
router.post('/mechanic-change-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await MechanicChangeRequest.findById(id);
    if (!doc || doc.status !== 'pending') return res.status(404).json({ success: false, message: 'Pending request not found' });

    doc.status = 'rejected';
    doc.reviewerId = req.user._id;
    doc.reviewerNotes = req.body?.notes || '';
    doc.decidedAt = new Date();
    await doc.save();

    res.json({ success: true, message: 'Change request rejected', data: { request: doc } });
  } catch (e) {
    console.error('Reject change request error:', e);
    res.status(500).json({ success: false, message: 'Failed to reject change request' });
  }
});

// ===== Pricing policy endpoints =====
router.get('/policies/pricing', async (req, res) => {
  try {
    const policy = await PricingPolicy.findOne().sort({ updatedAt: -1 });
    res.json({ success: true, message: 'Pricing policy loaded', data: { policy } });
  } catch (e) {
    console.error('Get pricing policy error:', e);
    res.status(500).json({ success: false, message: 'Failed to load pricing policy' });
  }
});

router.put('/policies/pricing', async (req, res) => {
  try {
    const payload = req.body || {};
    let policy = await PricingPolicy.findOne().sort({ updatedAt: -1 });
    if (!policy) {
      policy = await PricingPolicy.create(payload);
    } else {
      Object.assign(policy, payload);
      await policy.save();
    }
    res.json({ success: true, message: 'Pricing policy updated', data: { policy } });
  } catch (e) {
    console.error('Update pricing policy error:', e);
    res.status(400).json({ success: false, message: e.message || 'Failed to update pricing policy' });
  }
});

module.exports = router;
