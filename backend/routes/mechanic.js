const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const Request = require('../models/Request');
const Mechanic = require('../models/Mechanic');
const Payment = require('../models/Payment');
const { authenticateToken, requireMechanic } = require('../middleware/auth');

const router = express.Router();

const send = (res, { success = true, status = 200, message = 'Data retrieved successfully', data = {} } = {}) => res.status(status).json({ success, message, data });
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation error', errors: errors.array() });
  next();
};

// GET /api/mechanic/dashboard
router.get('/dashboard', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    if (!mechanic) return res.status(404).json({ success: false, message: 'Mechanic profile not found' });

    const [totalAssigned, completed, active, earningsAgg, last5] = await Promise.all([
      Request.countDocuments({ mechanicId: mechanic._id }),
      Request.countDocuments({ mechanicId: mechanic._id, status: 'completed' }),
      Request.countDocuments({ mechanicId: mechanic._id, status: { $in: ['accepted','on_way','arrived','working'] } }),
      Payment.aggregate([{ $match: { mechanicId: mechanic._id, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$netToMechanic' } } }]),
      Request.find({ mechanicId: mechanic._id }).sort({ createdAt: -1 }).limit(5).populate([{ path: 'userId', select: 'name phone profileImage' }])
    ]);

    return send(res, {
      message: 'Mechanic dashboard retrieved successfully',
      data: {
        stats: {
          totalAssigned,
          completed,
          active,
          earnings: earningsAgg[0]?.total || 0
        },
        recentRequests: last5
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get dashboard', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// GET /api/mechanic/requests
router.get('/requests', authenticateToken, requireMechanic, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString()
], handleValidation, async (req, res) => {
  try {
    const mech = await Mechanic.findOne({ userId: req.user._id });
    if (!mech) return res.status(404).json({ success: false, message: 'Mechanic profile not found' });
    const { page = 1, limit = 10, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const queryObj = { mechanicId: mech._id };
    if (status) queryObj.status = status;
    const [requests, total] = await Promise.all([
      Request.find(queryObj)
        .populate([{ path: 'userId', select: 'name phone profileImage' }])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Request.countDocuments(queryObj)
    ]);
    return send(res, { message: 'Mechanic requests retrieved successfully', data: { requests, pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum } } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get requests', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// GET /api/mechanic/history
router.get('/history', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const mech = await Mechanic.findOne({ userId: req.user._id });
    if (!mech) return res.status(404).json({ success: false, message: 'Mechanic profile not found' });
    const requests = await Request.find({ mechanicId: mech._id, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate([{ path: 'userId', select: 'name phone profileImage' }]);

    // Attach payment info (amount and net to mechanic)
    const ids = requests.map(r => r._id);
    const payments = await Payment.find({ requestId: { $in: ids } });
    const byRequest = new Map(payments.map(p => [String(p.requestId), p]));
    const requestsWithPayment = requests.map(r => {
      const p = byRequest.get(String(r._id));
      const obj = r.toObject();
      obj.payment = p ? { _id: p._id, amount: p.amount, netToMechanic: p.netToMechanic, method: p.method, createdAt: p.createdAt } : null;
      return obj;
    });

    // Also compute total earnings from payments
    const totalEarnings = payments.reduce((sum, p) => sum + (p.netToMechanic || 0), 0);

    return send(res, { message: 'Mechanic history retrieved successfully', data: { requests: requestsWithPayment, totals: { earnings: Math.round(totalEarnings * 100) / 100, count: requests.length } } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to get history', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// PUT /api/mechanic/requests/:id/accept
router.put('/requests/:id/accept', authenticateToken, requireMechanic, [param('id').isString()], handleValidation, async (req, res) => {
  try {
    const mech = await Mechanic.findOne({ userId: req.user._id }).populate('userId', 'name phone');
    if (!mech) return res.status(404).json({ success: false, message: 'Mechanic profile not found' });
    const request = await Request.findById(req.params.id).populate('userId', 'name phone');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is no longer available' });
    // Enforce capacity in this legacy endpoint too
    const activeCount = await Request.countDocuments({ mechanicId: mech._id, status: { $in: ['accepted','in_progress','arrived','working'] } });
    if (activeCount >= (mech.maxConcurrentJobs || 1)) {
      return send(res, { status: 400, success: false, message: 'Capacity reached. Complete an active job before accepting new ones' });
    }

    request.mechanicId = mech._id;
    request.status = 'accepted';
    await request.save();
    await request.populate([{ path: 'userId', select: 'name phone profileImage' }, { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.userId._id}`).emit('request:accepted', { requestId: request._id, request, status: 'accepted' });
      io.to('mechanics').emit('request:accepted', { requestId: request._id, request, status: 'accepted' });
    }

    return send(res, { message: 'Request accepted successfully', data: { request } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to accept request', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

// PUT /api/mechanic/requests/:id/complete
router.put('/requests/:id/complete', authenticateToken, requireMechanic, [param('id').isString(), body('amount').optional().isFloat({ min: 0 })], handleValidation, async (req, res) => {
  try {
    const mech = await Mechanic.findOne({ userId: req.user._id });
    if (!mech) return res.status(404).json({ success: false, message: 'Mechanic profile not found' });
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (String(request.mechanicId) !== String(mech._id)) return res.status(403).json({ success: false, message: 'Only assigned mechanic can complete' });
    request.status = 'completed';
    if (req.body.amount !== undefined) request.actualCost = req.body.amount;
    await request.save();
    await request.populate([{ path: 'userId', select: 'name phone profileImage' }, { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.userId._id}`).emit('request:completed', { requestId: request._id, request, status: 'completed' });
      io.to('mechanics').emit('request:completed', { requestId: request._id, request, status: 'completed' });
    }

    return send(res, { message: 'Request marked completed', data: { request } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to complete request', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
});

module.exports = router;


