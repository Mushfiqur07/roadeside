const express = require('express');
const mongoose = require('mongoose');
const Request = require('../models/Request');
const Mechanic = require('../models/Mechanic');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Payment = require('../models/Payment');
const { authenticateToken, requireMechanic } = require('../middleware/auth');

const router = express.Router();

// Base ping
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Requests API', endpoints: ['POST /','GET /:id','PUT /:id/status','PUT /:id/accept','PUT /:id/complete'] });
});

// @route   POST /api/requests
// @desc    Create new service request
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      mechanicId,
      vehicleType,
      problemType,
      description,
      pickupLocation,
      priority = 'medium',
      isEmergency = false,
      estimatedCost,
      selectedServices = []
    } = req.body;

    // Validate required fields
    if (!vehicleType || !problemType || !description || !pickupLocation) {
      return res.status(400).json({
        message: 'Vehicle type, problem type, description, and pickup location are required',
        success: false
      });
    }

    if (!pickupLocation.coordinates || !pickupLocation.address) {
      return res.status(400).json({
        message: 'Pickup location must include coordinates and address',
        success: false
      });
    }

    // If mechanicId is provided, validate it
    let targetMechanic = null;
    if (mechanicId) {
      targetMechanic = await Mechanic.findById(mechanicId).populate('userId', 'name phone');
      if (!targetMechanic) {
        return res.status(404).json({
          message: 'Selected mechanic not found',
          success: false
        });
      }
    }

    // Calculate estimate: if selectedServices provided, sum mechanic-defined prices
    let finalEstimate = estimatedCost;
    let pricedServices = [];
    let vehicleMultiplier = 1;
    if (vehicleType === 'truck') vehicleMultiplier = 1.5;
    else if (vehicleType === 'bus') vehicleMultiplier = 1.8;

    if (targetMechanic && Array.isArray(selectedServices) && selectedServices.length) {
      try {
        const sp = targetMechanic.servicePrices || {};
        let sum = 0;
        pricedServices = selectedServices.map(svc => {
          const key = typeof svc === 'string' ? svc : (svc.key || svc.value || svc);
          const label = svc.label || String(key).replace('_', ' ');
          const entry = sp[key] || sp.get?.(key) || {};
          const unit = typeof entry.max === 'number' && entry.max > 0 ? entry.max : (typeof entry.min === 'number' ? entry.min : 0);
          const unitAdjusted = Math.round(unit * vehicleMultiplier);
          sum += unitAdjusted;
          return { key, label, unitPrice: unitAdjusted };
        });
        if (sum > 0) finalEstimate = sum;
      } catch {}
    }

    // Create new request
    const requestData = {
      userId: req.user._id,
      mechanicId: mechanicId || null,
      vehicleType,
      problemType,
      description,
      pickupLocation,
      priority,
      isEmergency,
      estimatedCost: finalEstimate || (targetMechanic?.baseRate || 500),
      // Populate an estimated range using mechanic priceRange or per-service ranges
      estimatedCostRange: (() => {
        const range = { min: 0, max: 0 };
        try {
          if (targetMechanic) {
            // If selected services have individual ranges, sum mins and maxes
            if (Array.isArray(selectedServices) && selectedServices.length && targetMechanic.servicePrices) {
              let minSum = 0;
              let maxSum = 0;
              const sp = targetMechanic.servicePrices;
              selectedServices.forEach(svc => {
                const key = typeof svc === 'string' ? svc : (svc.key || svc.value || svc);
                const entry = sp[key] || sp.get?.(key) || { min: 0, max: 0 };
                const minAdj = Math.round((Number(entry.min) || 0) * (vehicleMultiplier || 1));
                const maxAdj = Math.round((Number(entry.max) || 0) * (vehicleMultiplier || 1));
                minSum += minAdj;
                maxSum += maxAdj > 0 ? maxAdj : minAdj;
              });
              range.min = minSum;
              range.max = maxSum || minSum;
            } else if (targetMechanic.priceRange) {
              const min = Number(targetMechanic.priceRange.min) || 0;
              const max = Number(targetMechanic.priceRange.max) || 0;
              range.min = Math.round(min * (vehicleMultiplier || 1));
              range.max = Math.round((max || min) * (vehicleMultiplier || 1));
            }
          }
        } catch {}
        return range;
      })(),
      selectedServices: pricedServices,
      vehicleMultiplier,
      status: 'pending'
    };

    const request = new Request(requestData);
    await request.save();

    // Populate user and mechanic data
    await request.populate([
      { path: 'userId', select: 'name phone profileImage' },
      { path: 'mechanicId', populate: { path: 'userId', select: 'name phone' } }
    ]);

    // Send Socket.IO notification to specific mechanic or all nearby mechanics
    const io = req.app.get('io');
    console.log('Socket.IO instance available:', !!io);
    
    if (io) {
      if (mechanicId && targetMechanic) {
        // Send to specific mechanic
        const targetRoom = `user_${targetMechanic.userId._id}`;
        console.log(`🔔 Sending request notification to specific mechanic room: ${targetRoom}`);
        console.log('Target mechanic:', targetMechanic.userId.name);
        console.log('Request data being sent:', {
          requestId: request._id,
          problemType: request.problemType,
          vehicleType: request.vehicleType,
          userLocation: request.pickupLocation.address
        });
        
        io.to(targetRoom).emit('new_request_notification', {
          type: 'NEW_REQUEST',
          request: request,
          message: `New ${problemType.replace('_', ' ')} request from ${req.user.name}`,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Sent request notification to mechanic ${targetMechanic.userId.name} in room ${targetRoom}`);
      } else {
        // Find nearby available mechanics and send targeted notifications
        const [longitude, latitude] = request.pickupLocation.coordinates;
        const nearbyMechanics = await Mechanic.findAvailableNearby(
          longitude, 
          latitude, 
          request.vehicleType, 
          20000 // 20km radius
        );

        console.log(`🔔 Found ${nearbyMechanics.length} nearby mechanics for request ${request._id}`);
        
        // Send targeted notifications to nearby mechanics
        nearbyMechanics.forEach(mechanic => {
          const mechanicUserId = mechanic.userId._id.toString();
          io.to(`user_${mechanicUserId}`).emit('new_request_notification', {
            type: 'NEW_REQUEST',
            request: {
              _id: request._id,
              vehicleType: request.vehicleType,
              problemType: request.problemType,
              description: request.description,
              pickupLocation: request.pickupLocation,
              priority: request.priority,
              isEmergency: request.isEmergency,
              user: request.userId,
              distance: mechanic.getDistanceFrom(longitude, latitude)
            },
            message: `New ${problemType.replace('_', ' ')} request available`,
            timestamp: new Date().toISOString()
          });
        });
        
        console.log(`✅ Sent targeted notifications to ${nearbyMechanics.length} nearby mechanics`);
      }
      
      // Also emit to admin room for monitoring
      io.to('admins').emit('new_request_created', {
        type: 'REQUEST_CREATED',
        request: request,
        message: `New request created by ${req.user.name}`,
        timestamp: new Date().toISOString()
      });
      
      console.log('✅ Notified admins of new request creation');
    } else {
      console.error('❌ Socket.IO instance not available - notifications not sent!');
    }

    res.status(201).json({
      message: mechanicId 
        ? `Service request sent to ${targetMechanic.userId?.name || 'mechanic'}` 
        : 'Service request created successfully',
      success: true,
      data: {
        request
      }
    });

  } catch (error) {
    console.error('Create request error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors,
        success: false
      });
    }

    res.status(500).json({
      message: 'Failed to create request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/requests/:id/start-journey
// @desc    Mechanic started journey to user
// @access  Private (Mechanic only)
router.put('/:id/start-journey', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id).populate('userId', 'name phone');

    if (!request) {
      return res.status(404).json({ message: 'Request not found', success: false });
    }

    let mechanic = await Mechanic.findOne({ userId: req.user._id });
    if (mechanic && (!mechanic.userId?.name || !mechanic.userId?.phone)) {
      mechanic = await Mechanic.findById(mechanic._id).populate('userId', 'name phone');
    }
    if (!mechanic || !request.mechanicId || request.mechanicId.toString() !== mechanic._id.toString()) {
      return res.status(403).json({ message: 'Only assigned mechanic can start journey', success: false });
    }

    request.status = 'on_way';
    request.timeline = request.timeline || {};
    request.timeline.onWayAt = new Date();
    await request.save();
    await request.populate([
      { path: 'userId', select: 'name phone profileImage' },
      { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.userId._id}`).emit('request:on_way', { requestId: request._id, request, status: 'on_way' });
      io.to('mechanics').emit('request:on_way', { requestId: request._id, request, status: 'on_way' });
      io.to(`request_${request._id}`).emit('request:on_way', { requestId: request._id, request, status: 'on_way' });
      
      // 🚀 AUTO-START LOCATION SHARING: Signal mechanic to start location sharing
      io.to(`user_${mechanic.userId._id}`).emit('auto_start_location_sharing', { 
        requestId: request._id, 
        message: 'Location sharing started automatically' 
      });
      
      // Compatibility events
      io.to(`request_${request._id}`).emit('request_status_changed', {
        requestId: request._id,
        status: 'in_progress',
        message: 'Mechanic started journey - Location sharing enabled',
        updatedBy: mechanic.userId?.name || 'Mechanic',
        timestamp: new Date()
      });
    }

    res.json({ message: 'Journey started', success: true, data: { request } });
  } catch (error) {
    console.error('Start journey error:', error);
    res.status(500).json({ message: 'Failed to start journey', success: false });
  }
});

// @route   PUT /api/requests/:id/arrived
// @desc    Mechanic arrived at user location
// @access  Private (Mechanic only)
router.put('/:id/arrived', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id).populate('userId', 'name phone');
    if (!request) return res.status(404).json({ message: 'Request not found', success: false });

    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    if (!mechanic || !request.mechanicId || request.mechanicId.toString() !== mechanic._id.toString()) {
      return res.status(403).json({ message: 'Only assigned mechanic can mark arrival', success: false });
    }

    request.status = 'arrived';
    request.timeline = request.timeline || {};
    request.timeline.arrivedAt = new Date();
    await request.save();
    await request.populate([
      { path: 'userId', select: 'name phone profileImage' },
      { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.userId._id}`).emit('request:arrived', { requestId: request._id, request, status: 'arrived' });
      io.to('mechanics').emit('request:arrived', { requestId: request._id, request, status: 'arrived' });
      io.to(`request_${request._id}`).emit('request:arrived', { requestId: request._id, request, status: 'arrived' });
      
      // 🛑 AUTO-STOP LOCATION SHARING: Signal mechanic to stop location sharing
      io.to(`user_${mechanic.userId._id}`).emit('auto_stop_location_sharing', { 
        requestId: request._id, 
        message: 'Location sharing stopped automatically - Mechanic arrived' 
      });
      
      io.to(`request_${request._id}`).emit('request_status_changed', {
        requestId: request._id,
        status: 'arrived',
        message: 'Mechanic arrived at location - Location sharing stopped',
        updatedBy: mechanic.userId?.name || 'Mechanic',
        timestamp: new Date()
      });
    }

    res.json({ message: 'Marked arrived', success: true, data: { request } });
  } catch (error) {
    console.error('Arrived error:', error);
    res.status(500).json({ message: 'Failed to mark arrived', success: false });
  }
});

// @route   PUT /api/requests/:id/complete
// @desc    Complete the request
// @access  Private (Mechanic only)
router.put('/:id/complete', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id).populate('userId', 'name phone');
    if (!request) return res.status(404).json({ message: 'Request not found', success: false });

    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    if (!mechanic || !request.mechanicId || request.mechanicId.toString() !== mechanic._id.toString()) {
      return res.status(403).json({ message: 'Only assigned mechanic can complete', success: false });
    }

    request.status = 'completed';
    await request.save();
    await request.populate([
      { path: 'userId', select: 'name phone profileImage' },
      { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.userId._id}`).emit('request:completed', { requestId: request._id, request, status: 'completed' });
      io.to('mechanics').emit('request:completed', { requestId: request._id, request, status: 'completed' });
      io.to(`request_${request._id}`).emit('request:completed', { requestId: request._id, request, status: 'completed' });
      io.to(`request_${request._id}`).emit('request_status_changed', {
        requestId: request._id,
        status: 'completed',
        message: 'Service completed',
        updatedBy: mechanic.userId?.name || 'Mechanic',
        timestamp: new Date()
      });
      io.to(`request_${request._id}`).emit('service_completed', { requestId: request._id });
    }

    res.json({ message: 'Request completed', success: true, data: { request } });
  } catch (error) {
    console.error('Complete error:', error);
    res.status(500).json({ message: 'Failed to complete request', success: false });
  }
});

// @route   PUT /api/requests/:id/payment-completed
// @desc    Mark payment as completed; update earnings and emit events
// @access  Private (User or Admin)
router.put('/:id/payment-completed', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method = 'cash', transactionId = '', commissionRate = 0.1 } = req.body;

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: 'Request not found', success: false });

    // Only requester or admin can confirm payment
    if (request.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied', success: false });
    }

    // Create payment record
    const payment = new Payment({
      requestId: request._id,
      userId: request.userId,
      mechanicId: request.mechanicId,
      amount: amount || request.actualCost || request.estimatedCost || 0,
      method,
      transactionId,
      commissionRate
    });
    await payment.save();

    // Update request
    request.paymentStatus = 'payment_completed';
    request.status = request.status === 'completed' ? 'completed' : 'completed';
    request.actualCost = payment.amount;
    request.payments = request.payments || [];
    request.payments.push(payment._id);
    await request.save();

    // Update mechanic aggregate fields (simple increment)
    if (request.mechanicId) {
      await Mechanic.findByIdAndUpdate(request.mechanicId, {
        $inc: { completedJobs: 0 },
      });
    }

    // Emit real-time notifications
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${request.userId}`).emit('payment:completed', { requestId: request._id, amount: payment.amount });
      if (request.mechanicId) {
        const mech = await Mechanic.findById(request.mechanicId).populate('userId', 'name');
        io.to(`user_${mech.userId._id}`).emit('payment:completed', { requestId: request._id, amount: payment.amount, net: payment.netToMechanic });
      }
      io.to('admins').emit('payment:completed', { requestId: request._id, amount: payment.amount, commission: payment.commissionAmount });
    }

    res.json({ message: 'Payment recorded', success: true, data: { payment, request } });
  } catch (error) {
    console.error('Payment completed error:', error);
    res.status(500).json({ message: 'Failed to record payment', success: false });
  }
});

// @route   GET /api/requests/mechanic/stats
// @desc    Get current mechanic's statistics
// @access  Private
router.get('/mechanic/stats', authenticateToken, requireMechanic, async (req, res) => {
  try {
    console.log('Mechanic stats request for user:', req.user._id);

    // Find mechanic profile
    const mechanic = await Mechanic.findOne({ userId: req.user._id });

    if (!mechanic) {
      console.log('Mechanic profile not found for user:', req.user._id);
      // Return empty stats instead of error for new mechanics
      return res.json({
        message: 'No mechanic profile found - showing default stats for new mechanic',
        success: true,
        data: {
          totalRequests: 0,
          completedRequests: 0,
          activeRequests: 0,
          completionRate: 0
        }
      });
    }

    console.log('Found mechanic profile:', mechanic._id);

    // Get request statistics
    const totalRequests = await Request.countDocuments({ mechanicId: mechanic._id });
    const completedRequests = await Request.countDocuments({ 
      mechanicId: mechanic._id, 
      status: 'completed' 
    });
    const activeRequests = await Request.countDocuments({ 
      mechanicId: mechanic._id, 
      status: { $in: ['active', 'in_progress'] }
    });

    console.log(`Mechanic ${mechanic._id} stats:`, {
      totalRequests,
      completedRequests,
      activeRequests
    });

    // Check if response was already sent (safety check)
    if (res.headersSent) {
      console.warn('Response already sent for mechanic stats request');
      return;
    }

    return res.json({
      message: 'Mechanic statistics retrieved successfully',
      success: true,
      data: {
        totalRequests,
        completedRequests,
        activeRequests,
        completionRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0
      }
    });

  } catch (error) {
    console.error('Get mechanic stats error:', error);
    console.error('Error stack:', error.stack);
    
    // Check if response was already sent (safety check)
    if (res.headersSent) {
      console.warn('Response already sent, cannot send error response');
      return;
    }
    
    return res.status(500).json({
      message: 'Failed to get mechanic statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/requests/mechanic/history
// @desc    Get current mechanic's request history (simplified endpoint)
// @access  Private
router.get('/mechanic/history', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    console.log('Mechanic history request for user:', req.user._id);

    // Find mechanic profile
    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    
    if (!mechanic) {
      console.log('Mechanic profile not found for user:', req.user._id);
      // Return empty result instead of error for new mechanics
      return res.json({
        message: 'No mechanic profile found - this is normal for new mechanics',
        success: true,
        data: {
          requests: [],
          pagination: {
            current: 1,
            pages: 0,
            total: 0,
            totalRequests: 0,
            limit: parseInt(limit)
          }
        }
      });
    }

    console.log('Found mechanic profile:', mechanic._id);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { mechanicId: mechanic._id };
    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        query.status = { $in: status.split(',').map(s => s.trim()).filter(Boolean) };
      } else {
        query.status = status;
      }
    }

    console.log('Querying requests with:', query);

    const requests = await Request.find(query)
      .populate([
        { path: 'userId', select: 'name phone profileImage' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Request.countDocuments(query);

    console.log(`Found ${requests.length} requests for mechanic ${mechanic._id}`);

    res.json({
      message: 'Mechanic requests retrieved successfully',
      success: true,
      data: {
        requests,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          totalRequests: total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get mechanic history error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Failed to get mechanic history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/requests/mechanic/:mechanicId
// @desc    Get specific mechanic's requests (admin or mechanic owner only)
// @access  Private
router.get('/mechanic/:mechanicId', authenticateToken, async (req, res) => {
  try {
    const { mechanicId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Find mechanic to check ownership
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic not found',
        success: false
      });
    }

    // Check if user can access this data
    if (mechanic.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied',
        success: false
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { mechanicId: mechanicId };
    if (status) {
      if (typeof status === 'string' && status.includes(',')) {
        query.status = { $in: status.split(',').map(s => s.trim()).filter(Boolean) };
      } else {
        query.status = status;
      }
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
      message: 'Mechanic requests retrieved successfully',
      success: true,
      data: {
        requests,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          totalRequests: total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get mechanic requests error:', error);
    res.status(500).json({
      message: 'Failed to get mechanic requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/requests/user/history
// @desc    Get current user's request history (simplified endpoint)
// @access  Private
router.get('/user/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user._id;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (status) {
      query.status = status;
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
      message: 'User requests retrieved successfully',
      success: true,
      data: {
        requests,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
          totalRequests: total,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Get user history error:', error);
    res.status(500).json({
      message: 'Failed to get user requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/requests/user/:userId
// @desc    Get user's request history
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Check if user can access this data
    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied',
        success: false
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { userId };
    if (status) {
      query.status = status;
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
      message: 'User requests retrieved successfully',
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
    console.error('Get user requests error:', error);
    res.status(500).json({
      message: 'Failed to get user requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   GET /api/requests/:id
// @desc    Get specific request details
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  console.log(`[Request] Starting GET /requests/${req.params.id} for user ${req.user._id}`);
  
  try {
    const { id } = req.params;

    // Validate ObjectId to avoid CastError 500s
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid request ID format',
        success: false
      });
    }

    console.log(`[Request] Starting database query for request ${id}`);
    const queryStart = Date.now();
    
    const request = await Request.findById(id)
      .populate([
        { path: 'userId', select: 'name phone profileImage' },
        { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
      ])
      .lean(); // Use lean() for better performance when not modifying the document
    
    const queryDuration = Date.now() - queryStart;
    console.log(`[Request] Database query completed in ${queryDuration}ms`);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found',
        success: false
      });
    }

    // Check access permissions
    const isOwner = request.userId._id.toString() === req.user._id.toString();
    let isAssignedMechanic = false;
    
    // Only check mechanic access if user is not the owner and not admin
    if (!isOwner && req.user.role !== 'admin') {
      console.log(`[Request] Checking mechanic access for user ${req.user._id}`);
      const mechanicQueryStart = Date.now();
      
      const mechanic = await Mechanic.findOne({ userId: req.user._id }).select('_id').lean();
      
      const mechanicQueryDuration = Date.now() - mechanicQueryStart;
      console.log(`[Request] Mechanic query completed in ${mechanicQueryDuration}ms`);
      
      isAssignedMechanic = mechanic && request.mechanicId && 
                          request.mechanicId._id.toString() === mechanic._id.toString();
    }

    if (!isOwner && !isAssignedMechanic && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied',
        success: false
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Request] Completed GET /requests/${id} in ${duration}ms`);
    
    // Check if response was already sent (e.g., by timeout middleware)
    if (!res.headersSent) {
      res.json({
        message: 'Request details retrieved successfully',
        success: true,
        data: {
          request
        }
      });
    } else {
      console.warn(`[Request] Response already sent for GET /requests/${id}`);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Request] Failed GET /requests/${req.params.id} after ${duration}ms:`, error);
    
    // Check if response was already sent (e.g., by timeout middleware)
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Failed to get request details',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        success: false
      });
    } else {
      console.warn(`[Request] Error response not sent - headers already sent for GET /requests/${req.params.id}`);
    }
  }
});

// @route   PUT /api/requests/:id/accept
// @desc    Mechanic accepts service request
// @access  Private (Mechanic only)
router.put('/:id/accept', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { id } = req.params;
    const { estimatedArrivalTime, estimatedCost } = req.body;

    // Find the request
    const request = await Request.findById(id).populate('userId', 'name phone');

    if (!request) {
      return res.status(404).json({
        message: 'Request not found',
        success: false
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Request is no longer available',
        success: false
      });
    }

    // Find mechanic profile
    const mechanic = await Mechanic.findOne({ userId: req.user._id });

    if (!mechanic) {
      return res.status(404).json({
        message: 'Mechanic profile not found',
        success: false
      });
    }

    if (!mechanic.isAvailable) {
      return res.status(400).json({
        message: 'You must be available to accept requests',
        success: false
      });
    }

    // Enforce capacity: count active jobs
    const activeCount = await Request.countDocuments({ mechanicId: mechanic._id, status: { $in: ['accepted','in_progress','arrived','working'] } });
    if (activeCount >= (mechanic.maxConcurrentJobs || 1)) {
      return res.status(400).json({
        message: 'Capacity reached. Complete an active job before accepting new ones',
        success: false
      });
    }

    // Update request
    request.mechanicId = mechanic._id;
    // Use 'accepted' to reflect UI state immediately
    request.status = 'accepted';
    request.timeline = request.timeline || {};
    request.timeline.acceptedAt = new Date();
    
    if (estimatedArrivalTime) {
      request.estimatedArrivalTime = new Date(estimatedArrivalTime);
    }
    
    if (estimatedCost) {
      request.estimatedCost = estimatedCost;
    }

    await request.save();

    // Update mechanic availability (optional - mechanic can handle multiple requests)
    // mechanic.isAvailable = false;
    // await mechanic.save();

    // Populate request data
    await request.populate([
      { path: 'userId', select: 'name phone profileImage' },
      { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
    ]);

    // Send Socket.IO notification to user about request acceptance
    const io = req.app.get('io');
    if (io) {
      // Notify the user that their request was accepted
      io.to(`user_${request.userId._id}`).emit('request_accepted_notification', {
        type: 'REQUEST_ACCEPTED',
        request: request,
        mechanic: {
          name: mechanic.userId?.name || 'Mechanic',
          phone: mechanic.userId?.phone,
          rating: mechanic.rating,
          experience: mechanic.experience
        },
        message: `${mechanic.userId?.name || 'A mechanic'} accepted your request and is on the way!`
      });
      
      // Notify all mechanics that this request is no longer available
      io.to('mechanics').emit('request_taken_notification', {
        type: 'REQUEST_TAKEN',
        requestId: request._id,
        message: 'Request has been accepted by another mechanic'
      });
      
      // Also emit normalized channel for frontends
      io.to(`user_${request.userId._id}`).emit('request:accepted', { requestId: request._id, request, status: 'accepted' });
      io.to('mechanics').emit('request:accepted', { requestId: request._id, request, status: 'accepted' });
      io.to(`request_${request._id}`).emit('request:accepted', { requestId: request._id, request, status: 'accepted' });

      // Backward/alternate events some clients listen to
      io.to(`user_${request.userId._id}`).emit('request_accepted', { requestId: request._id, request, status: 'accepted' });
      io.to(`request_${request._id}`).emit('request_status_changed', {
        requestId: request._id,
        status: 'accepted',
        message: 'Request accepted',
        updatedBy: mechanic.userId?.name || 'Mechanic',
        timestamp: new Date()
      });
      console.log(`Sent acceptance notification to user ${request.userId._id}`);

      // Ensure chat exists for this accepted request and notify both parties
      try {
        let chat = await Chat.findOne({ serviceRequestId: request._id });
        if (!chat) {
          chat = await Chat.create({
            serviceRequestId: request._id,
            participants: [
              { userId: request.userId._id, role: 'user' },
              { userId: mechanic.userId._id, role: 'mechanic' }
            ]
          });
        }
        io.to(`user_${request.userId._id}`).emit('chat_ready', { requestId: request._id, chatId: chat._id });
        io.to(`user_${mechanic.userId._id}`).emit('chat_ready', { requestId: request._id, chatId: chat._id });
      } catch (e) {
        console.error('Chat auto-create on accept failed:', e?.message);
      }
    }

    res.json({
      message: 'Request accepted successfully',
      success: true,
      data: {
        request,
        userPhone: request.userId.phone // Return user's phone number
      }
    });

  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({
      message: 'Failed to accept request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/requests/:id/reject
// @desc    Mechanic rejects service request
// @access  Private (Mechanic only)
router.put('/:id/reject', authenticateToken, requireMechanic, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await Request.findById(id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found',
        success: false
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        message: 'Request is no longer available',
        success: false
      });
    }

    // Update request status
    request.status = 'rejected';
    if (reason) {
      request.cancellationReason = reason;
    }

    await request.save();

    res.json({
      message: 'Request rejected successfully',
      success: true,
      data: {
        request
      }
    });

  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({
      message: 'Failed to reject request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

// @route   PUT /api/requests/:id/status
// @desc    Update request status
// @access  Private
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actualCost, notes } = req.body;

    const request = await Request.findById(id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found',
        success: false
      });
    }

    // Check if user owns the request or is the assigned mechanic
    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    const isOwner = request.userId.toString() === req.user._id.toString();
    const isAssignedMechanic = mechanic && request.mechanicId && 
                              request.mechanicId.toString() === mechanic._id.toString();

    if (!isOwner && !isAssignedMechanic && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied',
        success: false
      });
    }

    // Update status
    if (status) {
      // 🚫 PREVENT CANCELLATION: Block cancellation if mechanic has started journey
      if (status === 'cancelled' && isOwner) {
        const nonCancellableStatuses = ['on_way', 'in_progress', 'arrived', 'working'];
        if (nonCancellableStatuses.includes(request.status)) {
          return res.status(400).json({ 
            success: false, 
            message: `Cannot cancel request. Mechanic has ${request.status === 'on_way' ? 'started the journey' : 'begun working'}. Please contact the mechanic directly for any concerns.` 
          });
        }
      }
      
      request.status = status;
    }

    if (actualCost) {
      request.actualCost = actualCost;
    }

    if (notes) {
      request.notes.push({
        author: req.user.role,
        content: notes,
        timestamp: new Date()
      });
    }

    await request.save();

    // If completed, update mechanic stats
    if (status === 'completed' && mechanic && isAssignedMechanic) {
      mechanic.completedJobs += 1;
      await mechanic.save();
    }

    await request.populate([
      { path: 'userId', select: 'name phone profileImage' },
      { path: 'mechanicId', populate: { path: 'userId', select: 'name phone profileImage' } }
    ]);

    res.json({
      message: 'Request status updated successfully',
      success: true,
      data: {
        request
      }
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

// @route   PUT /api/requests/:id/rate
// @desc    Rate a completed request
// @access  Private
router.put('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: 'Rating must be between 1 and 5',
        success: false
      });
    }

    const request = await Request.findById(id);

    if (!request) {
      return res.status(404).json({
        message: 'Request not found',
        success: false
      });
    }

    if (request.status !== 'completed') {
      return res.status(400).json({
        message: 'Can only rate completed requests',
        success: false
      });
    }

    // Check if user is the requester or the mechanic
    const mechanic = await Mechanic.findOne({ userId: req.user._id });
    const isRequester = request.userId.toString() === req.user._id.toString();
    const isMechanic = mechanic && request.mechanicId && 
                      request.mechanicId.toString() === mechanic._id.toString();

    if (!isRequester && !isMechanic) {
      return res.status(403).json({
        message: 'Access denied',
        success: false
      });
    }

    // Update rating based on who is rating
    if (isRequester) {
      request.rating.userRating = rating;
      if (comment) request.rating.userComment = comment;

      // Update mechanic's overall rating
      if (request.mechanicId) {
        const requestMechanic = await Mechanic.findById(request.mechanicId);
        if (requestMechanic) {
          await requestMechanic.updateRating(rating);
        }
      }
    } else if (isMechanic) {
      request.rating.mechanicRating = rating;
      if (comment) request.rating.mechanicComment = comment;
    }

    await request.save();

  // Emit live review update to the mechanic (if requester rated)
  try {
    if (isRequester && request.mechanicId) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${(await Mechanic.findById(request.mechanicId)).userId.toString()}`).emit('review:new', {
          mechanicId: request.mechanicId,
          review: {
            id: request._id,
            rating: request.rating?.userRating || null,
            comment: request.rating?.userComment || '',
            date: request.updatedAt || new Date(),
            user: { id: req.user._id, name: (await User.findById(req.user._id).select('name')).name }
          }
        });
      }
    }
  } catch (e) {
    console.error('review:new emit failed:', e?.message);
  }

    res.json({
      message: 'Rating submitted successfully',
      success: true,
      data: {
        request
      }
    });

  } catch (error) {
    console.error('Rate request error:', error);
    res.status(500).json({
      message: 'Failed to submit rating',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      success: false
    });
  }
});

module.exports = router;
