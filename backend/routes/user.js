const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Request = require('../models/Request');
const Mechanic = require('../models/Mechanic');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const { authenticateToken } = require('../middleware/auth');
const Promotion = require('../models/Promotion');
const Subscription = require('../models/Subscription');

const router = express.Router();

// Base ping for this router
router.get('/', (req, res) => {
  return res.json({ success: true, message: 'User API', endpoints: ['GET /dashboard','GET /requests','POST /requests','GET /request/:id'] });
});

const send = (res, { success = true, status = 200, message = 'Data retrieved successfully', data = {} } = {}) => {
  return res.status(status).json({ success, message, data });
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
  }
  next();
};

// GET /api/user/dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const [total, active, completed, cancelled, last5, totalPaid] = await Promise.all([
      Request.countDocuments({ userId }),
      Request.countDocuments({ userId, status: { $in: ['pending', 'accepted', 'on_way', 'arrived', 'working'] } }),
      Request.countDocuments({ userId, status: 'completed' }),
      Request.countDocuments({ userId, status: { $in: ['cancelled', 'rejected', 'failed'] } }),
      Request.find({ userId }).sort({ createdAt: -1 }).limit(5).populate([
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
      ]),
      Payment.aggregate([{ $match: { userId } }, { $group: { _id: null, sum: { $sum: '$amount' } } }])
    ]);

    const totalPaidAmount = totalPaid[0]?.sum || 0;

    return send(res, {
      message: 'User dashboard retrieved successfully',
      data: {
        stats: { total, active, completed, cancelled, totalPaid: totalPaidAmount },
        recentRequests: last5
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get dashboard', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// GET /api/user/requests
router.get('/requests', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString()
], handleValidation, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (status) query.status = status;

    const [requests, total] = await Promise.all([
      Request.find(query)
        .populate([
          { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Request.countDocuments(query)
    ]);

    return send(res, {
      message: 'User requests retrieved successfully',
      data: {
        requests,
        pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get requests', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// POST /api/user/requests
router.post('/requests', authenticateToken, [
  body('vehicleType').isString().notEmpty(),
  body('problemType').isString().notEmpty(),
  body('description').isString().isLength({ min: 5 }),
  body('pickupLocation').custom(v => !!(v && v.coordinates && Array.isArray(v.coordinates) && v.coordinates.length === 2 && v.address)),
  body('mechanicId').optional().isString()
], handleValidation, async (req, res) => {
  try {
    const { mechanicId, ...rest } = req.body;
    let targetMechanic = null;
    if (mechanicId) {
      targetMechanic = await Mechanic.findById(mechanicId).populate('userId', 'name phone');
      if (!targetMechanic) return res.status(404).json({ success: false, message: 'Selected mechanic not found' });
    }

    const request = new Request({ ...rest, userId: req.user._id, mechanicId: mechanicId || null, status: 'pending', estimatedCost: rest.estimatedCost || (targetMechanic?.baseRate || 500) });
    await request.save();
    await request.populate([{ path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }]);

    // Socket events
    const io = req.app.get('io');
    if (io) {
      io.to('mechanics').emit('new_request', { requestId: request._id, request });
      if (mechanicId && targetMechanic) io.to(`user_${targetMechanic.userId._id}`).emit('new_request_notification', { request, message: `নতুন কাজ এসেছে` });
    }

    return send(res, { status: 201, message: 'Service request created successfully', data: { request } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create request', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// GET /api/user/request/:id
router.get('/request/:id', authenticateToken, [param('id').isString()], handleValidation, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate([
      { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
    ]);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (String(request.userId) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });
    return send(res, { message: 'Request details retrieved successfully', data: { request } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get request', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// PUT /api/user/request/:id
router.put('/request/:id', authenticateToken, [
  param('id').isString(),
  body('status').optional().isString().isIn(['accepted','pending','active','in_progress','on_way','arrived','working','completed','cancelled','rejected','failed']),
  body('actualCost').optional().isFloat({ min: 0 })
], handleValidation, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (String(request.userId) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });

    const { status, actualCost } = req.body;
    
    // 🚫 PREVENT CANCELLATION: Block cancellation if mechanic has started journey
    if (status === 'cancelled') {
      const nonCancellableStatuses = ['on_way', 'in_progress', 'arrived', 'working'];
      if (nonCancellableStatuses.includes(request.status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot cancel request. Mechanic has ${request.status === 'on_way' ? 'started the journey' : 'begun working'}. Please contact the mechanic directly for any concerns.` 
        });
      }
    }
    
    if (status) request.status = status;
    if (actualCost !== undefined) request.actualCost = actualCost;
    await request.save();
    await request.populate([{ path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }]);

    return send(res, { message: 'Request updated successfully', data: { request } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update request', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

module.exports = router;
// Alias: profile getter consistent with README expectations
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    return res.json({ success: true, message: 'Profile retrieved successfully', data: { user: req.user.getPublicProfile() } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
});

// Public/authorized promotions endpoints (basic)
// GET /api/user/promotions/active
router.get('/promotions/active', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const promos = await Promotion.find({ isActive: true, startsAt: { $lte: now }, endsAt: { $gte: now } }).sort({ startsAt: 1 });
    return send(res, { message: 'Active promotions', data: { promotions: promos } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to load promotions' });
  }
});

// Subscriptions endpoints (user)
// GET /api/user/subscription
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const sub = await Subscription.findOne({ userId: req.user._id, status: 'active' });
    return send(res, { message: 'Subscription fetched', data: { subscription: sub } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch subscription' });
  }
});

// POST /api/user/subscription
router.post('/subscription', authenticateToken, async (req, res) => {
  try {
    const { planId = 'basic', planName = 'Basic Membership', price = 299, period = 'monthly' } = req.body || {};
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    if (period === 'yearly') endsAt.setFullYear(endsAt.getFullYear() + 1); else endsAt.setMonth(endsAt.getMonth() + 1);
    const doc = await Subscription.create({ userId: req.user._id, planId, planName, price, period, benefits: ['priority_response', 'discount_10'], startsAt, endsAt, status: 'active' });
    return send(res, { status: 201, message: 'Subscription created', data: { subscription: doc } });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Failed to create subscription' });
  }
});

// DELETE /api/user/subscription
router.delete('/subscription', authenticateToken, async (req, res) => {
  try {
    const doc = await Subscription.findOneAndUpdate({ userId: req.user._id, status: 'active' }, { status: 'cancelled', endsAt: new Date() }, { new: true });
    return send(res, { message: 'Subscription cancelled', data: { subscription: doc } });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Failed to cancel subscription' });
  }
});



